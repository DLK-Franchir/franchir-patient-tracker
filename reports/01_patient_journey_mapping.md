# 01 — Cartographie du parcours patient et traçabilité des événements

**Périmètre :** Tracker Marcel (prod `zdmeidekszdrzmjuasee`), lecture seule, 2026-09-14.
**Sources :** `lib/workflow-v2.ts`, `lib/dashboard-summary.ts`, `lib/patient-work-context.ts`, `app/api/patients/**`, `lib/notifications.ts`, `lib/integrations/**`, Edge Function de sync ; agrégats prod sur `patient_messages` / `patients` (aucune identité).

---

## 1. Acteurs

| Rôle (`profiles.role`) | Acteur métier | Responsabilités dans le workflow |
|---|---|---|
| `marcel` | Coordinateur (Marcel, Philippe) | crée le dossier, prépare/envoie le questionnaire, soumet à revue, complète, confirme devis et date, assigne le chirurgien, ferme/réouvre, peut « passer en refusé » |
| `gilles` | Médecin réviseur (Dr Dubois) | valide médicalement (+ recommande 1–2 chirurgiens), demande un complément, refuse ; périmètre limité (pas de brouillons, pas de fermés) |
| `franchir` | Commercial / coordination Franchir | budget indicatif, dates proposées, assignation chirurgien, fermeture/réouverture |
| `admin` | Supervision | toutes les actions |
| Chirurgien (`surgeons`) | externe, **sans compte tracker** | reçoit un e-mail d'assignation ; consulte le dossier via le portail clinicien questionnaires |
| Patient | externe | remplit le questionnaire Anamneze via lien magique ; n'interagit jamais avec le tracker |

---

## 2. Machine à états

### 2.1 Statuts effectifs

Espace réel = 7 codes DB → 7 `GlobalStatus` (le code applicatif ne raisonne qu'en `GlobalStatus`) :

| `GlobalStatus` | Code DB posé par le code | Libellé cockpit | Qui doit agir (`getWorkflowHandoff`) |
|---|---|---|---|
| `draft` | `prospect_created` | Brouillon / Dossier créé | marcel |
| `medical_review` | `medical_review` | Revue médicale | gilles |
| `medical_more_info` | `need_info` | À compléter | marcel |
| `commercial_in_progress` | `validated_medical` | Commercial | franchir (devis/dates) **et** marcel (confirmations) |
| `scheduled` | `surgery_scheduled` | Programmé | personne (`pendingActor: null`) |
| `rejected` | `rejected_medical` | Refusé | marcel/franchir/admin peuvent réouvrir |
| `closed` | `case_closed` | Fermé | personne ; réouverture possible |

### 2.2 Transitions (`POST /api/patients/[id]/change-status`)

| `action_id` | Rôles autorisés (`canPerformWorkflowAction`) | Depuis | Vers (code DB) | Écritures `patients` | Entrée obligatoire | Notifications in-app (`STATUS_NOTIFICATION_RULES` / commerciales) |
|---|---|---|---|---|---|---|
| `submit_to_medical` | marcel, admin | `draft` | `medical_review` | `current_status_id` | — | gilles |
| `resubmit_to_medical` | marcel, admin | `medical_more_info` | `medical_review` | `current_status_id` | message optionnel | gilles |
| `approve_medical` | gilles, admin | `medical_review` | `validated_medical` | `current_status_id` ; `assigned_surgeon_id` si `surgeonId` fourni | 1–2 `surgeonIds` actifs | marcel, franchir, admin ; e-mail chirurgien si assigné |
| `request_more_info` | gilles, admin | `medical_review` | `need_info` | `current_status_id` | message (infos manquantes) | marcel, franchir, admin |
| `reject_medical` | gilles, **marcel**, admin | tout non terminal | `rejected_medical` | `current_status_id` | justification | marcel, franchir, admin |
| `assign_surgeon` | marcel, franchir, admin | `commercial_in_progress`, `scheduled` | (inchangé) | `assigned_surgeon_id` | `surgeonId` | e-mail chirurgien uniquement |
| `add_budget` | franchir, admin | `commercial_in_progress` | (inchangé) | `quote_amount` (parsé depuis texte libre) | budget | franchir, admin |
| `propose_dates` | franchir, admin | `commercial_in_progress` | (inchangé) | `proposed_date` (**1re date parsable** du texte) | dates (1–3, texte) | franchir, admin |
| `confirm_quote` | marcel, admin | `commercial_in_progress` | `surgery_scheduled` **si** `date_accepted` déjà vrai, sinon inchangé | `quote_accepted = true` | — | gilles, franchir, admin |
| `confirm_date` | marcel, admin | `commercial_in_progress` | `surgery_scheduled` **si** `quote_accepted` déjà vrai, sinon inchangé | `date_accepted = true` | — | (via statut si programmé : tous) |
| `close_case` | marcel, franchir, admin | tout sauf `rejected`/`closed` | `case_closed` | `current_status_id` | motif optionnel | **aucune** (pas de règle `case_closed`) |
| `reopen_case` | admin, marcel, franchir | `rejected`, `closed` | `prospect_created` | `current_status_id` | raison | **aucune en pratique** : la règle est indexée `draft` alors que le code posé est `prospect_created` |

Chaque action journalise **une** ligne `patient_messages` :
`kind = status_change` (si changement de code) sinon `action` ; `topic = commercial` si `action_id` contient `quote|date|budget|propose`, sinon `medical` ; `meta = {action_id, old_status?, new_status?}`.

Gardes transverses : dossier `case_closed` → toute écriture non-admin refusée sauf `reopen_case` (`patient-archive-guard`) ; Gilles → 403 hors périmètre (`patient-role-scope-guard`, statuts `medical_review`, `medical_more_info`, `commercial_in_progress`, `scheduled`, `rejected`).

### 2.3 Sous-état questionnaire (indépendant du statut workflow)

```
null ──(prepare: questionnaire-link, url renvoyée)──▶ null  [événement audit questionnaire_prepare]
null ──(dispatch-confirm: Marcel a copié/envoyé)────▶ sent   [questionnaire_sent_at, événement questionnaire_staff_dispatch]
sent ──(callback session-status, service-role)──────▶ completed [questionnaire_completed_at, questionnaire_summary ; AUCUN événement]
*    ──(reconcile depuis portail, dashboard)────────▶ completed / null [AUCUN événement]
```

Changement de pathologie (`form_types`) ou de langue passe par `questionnaire-link` (force `newSession`) et est tracé dans `meta.form_types` / `meta.questionnaire_language` de l'événement `questionnaire_*`. Révocation du lien : non tracée côté tracker.

### 2.4 Sous-parcours imagerie / documents

Upload direct navigateur → Storage, puis `finalize` insère `patient_documents` (horodatage = `created_at` de la ligne, auteur = `uploaded_by`). Suppression : aucune trace. Exports DICOM : événements `audit` (`dicom_study_export_async_create/_build`). Forward best-effort vers le portail chirurgien.

### 2.5 Synchronisation vers l'app questionnaires

Trigger `sync_patient_to_questionnaires` sur **tout** INSERT/UPDATE `patients` → Edge Function → upsert `neuro_patients` (identité, résumé clinique, `form_types`, statut workflow, chirurgien assigné avec `overrideSurgeonAssignment`). Le chirurgien voit le dossier dans son portail dès que `assigned_surgeon_id` est renseigné et que son e-mail est en annuaire.

---

## 3. Parcours nominal (phases)

| Phase | Déclencheur | Statut | Responsable | Données produites | Événements disponibles |
|---|---|---|---|---|---|
| 0. Création | Marcel saisit nom, e-mail, téléphone, pathologie, langue, résumé | `prospect_created` | marcel | `patients.*`, notifications « Nouveau dossier créé » (staff) + « Nouveau patient à examiner » (Gilles, trigger) | `system/create_patient` (depuis 2026-09-11) ; sinon `patients.created_at` + notifications |
| 1. Questionnaire | Marcel prépare le lien → copie/mailto → confirme | (inchangé) / sous-état `sent` | marcel puis patient | `questionnaire_sent_at`, puis callback `completed` | `questionnaire_prepare`, `questionnaire_staff_dispatch` ; complétion **sans événement** |
| 2. Soumission | Marcel soumet | `medical_review` | gilles | — | `status_change/submit_to_medical` |
| 3. Revue médicale | Gilles valide / demande complément / refuse | `validated_medical` / `need_info` / `rejected_medical` | gilles → marcel ou franchir | `assigned_surgeon_id` éventuel ; recommandations **dans `body` uniquement** | `approve_medical`, `request_more_info`, `reject_medical` |
| 3b. Complément | Marcel complète (messages) et renvoie | `medical_review` | marcel | — | messages `kind=message` + `resubmit_to_medical` |
| 4. Commercial | Franchir saisit budget/dates (action ou PATCH direct) ; Marcel confirme ; assignation chirurgien | `validated_medical` | franchir + marcel | `quote_amount`, `proposed_date`, `quote_accepted`, `date_accepted`, `assigned_surgeon_id` | `add_budget`, `propose_dates`, `confirm_quote`, `confirm_date`, `assign_surgeon` ; **PATCH `commercial-data` non tracé** |
| 5. Programmé | 2e confirmation (devis + date) | `surgery_scheduled` | personne | — | `status_change` vers `surgery_scheduled` |
| 6. Clôture / réouverture | Marcel/Franchir ferment ; réouverture vers brouillon | `case_closed` → `prospect_created` | — | — | `close_case`, `reopen_case` |

Aucune phase « intervention réalisée », « post-op » ou « facturation » n'existe dans le modèle applicatif (les codes `surgery_done` / `completed` en base sont inatteignables).

---

## 4. Taxonomie observée des événements (`patient_messages`, prod, 272 lignes)

| `kind` | `topic` | `action_id` | Lignes | Période | Structure `meta` |
|---|---|---|---:|---|---|
| `message` | `medical` | — | 176 | 02-2026 → 09-2026 | `{}` |
| `status_change` | `medical` | `submit_to_medical` | 29 | | `old_status`, `new_status`, `action_id` |
| `status_change` | `medical` | `approve_medical` | 21 | | idem |
| `status_change` | `medical` | `reject_medical` | 4 (3 marcel, 1 gilles) | | idem |
| `status_change` | `medical` | `close_case` | 5 | 07-2026 | idem |
| `status_change` | `medical` | `reopen_case` | 1 | | idem |
| `status_change` | `medical` | `request_more_info` | 1 | 06-2026 | idem |
| `status_change` | `commercial` | `confirm_date` | 2 | 05-2026 | idem |
| `action` | `medical` | `assign_surgeon` | 22 (dont 1 `source=ops_sql`) | 06-2026 → | `action_id` seul — **pas de `surgeon_id`, pas d'ancien chirurgien** |
| `action` | `commercial` | `confirm_quote` | 3 | | `action_id` |
| `action` | `commercial` | `add_budget` | 1 | 07-2026 | `action_id` — montant dans `body` |
| `action` | `audit` | `dicom_study_export_async_*` | 4 | 09-2026 | `file_count`, `part_count`, `series_count`, … |
| `action` | `audit` / `system` | `questionnaire_prepare`, `questionnaire_staff_dispatch` | 2 | 09-2026 | `form_types`, `questionnaire_language`, `dispatch_mode`, `email_sent` |
| `system` | `audit` | `create_patient` | 1 | 09-2026 | `form_types`, `questionnaire_language`, `questionnaire_email_sent`, `questionnaire_dispatch_deferred` |

Transitions observées : `prospect_created→medical_review` 29 · `medical_review→validated_medical` 21 · `medical_review→rejected_medical` 4 · `validated_medical→surgery_scheduled` 2 · `surgery_scheduled→case_closed` 2 · `validated_medical→case_closed` 2 · `prospect_created→case_closed` 1 · `case_closed→prospect_created` 1 · `medical_review→need_info` 1.

Contrôles d'intégrité (prod) : 63 transitions ; **0 rupture de chaîne** (`old_status` = `new_status` précédent) ; **0 `meta` manquant** ; 29 premières transitions toutes depuis `prospect_created` ; 4 dossiers sans aucun `status_change` ; **1 dossier** dont le statut courant ne correspond pas au dernier événement (modification hors application : script ops `case_closed`) ; 32 / 33 dossiers sans événement de création.

---

## 5. Capacité de reconstruction — verdict par question

| # | Question | Verdict | Source(s) | Précision / limites |
|---|---|---|---|---|
| 1 | **Changements de statut** | **Oui — précis** | `patient_messages.kind='status_change'`, `meta.old_status/new_status/action_id`, `author_id/role`, `created_at` | Chaîne cohérente à 100 % sur la prod. Angles morts : changements par SQL direct non journalisés (1 cas) ; statut initial `prospect_created` implicite (pas d'événement de création avant 09-2026) → utiliser `patients.created_at`. |
| 2 | **Changements de responsable** | **Partiel** | (a) chirurgien : `action/assign_surgeon` + `approve_medical` avec assignation ; (b) responsable staff : dérivé du statut | (a) L'événement existe (cohérent : 0 dossier avec chirurgien sans événement) mais `meta` ne porte **ni `surgeon_id` ni l'ancien chirurgien** → le nom n'est que dans `body` (texte) ; l'historique des réassignations exige un parsing. (b) Le « responsable » (marcel/gilles/franchir) n'est **pas stocké** : il est une fonction déterministe du `GlobalStatus` (`getWorkflowHandoff`), reconstructible à partir des `status_change`, à condition de figer la version des règles. |
| 3 | **Actions attendues** | **Dérivable, non stocké** | `getWorkflowHandoff`, `getAvailableActions`, `isMinePatient` sur `GlobalStatus` + `quote_accepted`, `date_accepted`, `quote_amount`, `proposed_date` | Aucune table de tâches, aucune échéance, aucune priorité persistée. Reconstruction « à l'instant T » possible en rejouant les `status_change` ; mais les flags commerciaux n'ont pas d'historique (voir #4), donc l'attendu commercial à T est approximatif. |
| 4 | **Actions réalisées** | **Partiel** | `patient_messages` (`status_change`, `action`, `system`, `message`) ; `patient_documents.created_at` ; `notifications.created_at` | Tracées : 12 actions workflow, messages, préparation/dispatch questionnaire, exports imagerie, création (récent). **Non tracées :** `PATCH commercial-data` (devis/date saisis hors action), `PATCH update-summary` (résumé clinique, SharePoint), suppression de documents, révocation lien, complétion questionnaire (callback), reconcile automatiques, lecture des notifications. Le `topic` des messages libres est toujours `medical` (le `topic` envoyé par l'UI est ignoré côté API) → impossible de distinguer messagerie médicale / commerciale a posteriori. |
| 5 | **Délais** | **Partiel** | `created_at` des `status_change` ; `patients.created_at` ; `questionnaire_sent_at` / `questionnaire_completed_at` ; `proposed_date` | Durées inter-étapes (création→soumission, soumission→décision médicale, validation→programmation, etc.) calculables à la seconde. Limites : `patients.updated_at` **non maintenu** (pas de trigger) → pas d'horloge de dernière activité, utiliser `max(patient_messages.created_at)` ; `questionnaire_sent_at` backfillé (imprécis avant 2026-07-17) ; aucune date cible / SLA / échéance en base ; date d'intervention = `proposed_date` (une seule valeur, écrasable) — pas de date confirmée distincte, `calendar_events` vide. |
| 6 | **Devis** | **Faible** | `patients.quote_amount`, `quote_accepted` ; événements `add_budget` (montant en texte), `confirm_quote` | Table `quotes` vide (0). Un seul montant, sans historique, sans devise/conditions, sans version ; les modifications via `PATCH commercial-data` ne laissent aucune trace. Prod : 1 événement `add_budget`, 3 `confirm_quote`, 1 dossier avec montant. Le statut `quote_issued` existe en base mais est inatteignable → pas d'événement « devis envoyé au patient ». |
| 7 | **Relances** | **Non (staff) / Partiel (questionnaire)** | `notifications` (527, `is_read` sans `read_at`) ; événements `questionnaire_resend` / `questionnaire_prepare` / `questionnaire_staff_dispatch` | Aucun concept de relance, rappel ou échéance. Les notifications tracent la **diffusion** (qui a été prévenu, quand) mais pas la relance ni la lecture datée ; les e-mails Resend ne sont pas journalisés en base. Les renvois de lien questionnaire sont tracés depuis 09-2026 seulement. L'alerte « stuck-sent » (health) est calculée à la volée, non persistée. |
| 8 | **Blocages médicaux et administratifs** | **Partiel (médical) / Non (administratif)** | `request_more_info` (motif dans `body`), `reject_medical` (justification dans `body`), `resubmit_to_medical`, `close_case` (motif optionnel) | Blocage médical = statut `need_info` + texte libre (1 occurrence prod) ; refus = `rejected_medical`. **Le refus administratif (Marcel « passer en mode refusé ») utilise le même `action_id` et le même code** que le refus médical de Gilles → distinguable uniquement par `author_role`. Aucun code de motif, aucun champ « bloqué par / en attente de », `medical_decisions` vide. Blocages administratifs (pièces, paiement, disponibilité) : non modélisés. |

Synthèse : le journal `patient_messages` est **fiable pour la trajectoire de statut** (qui, quand, de quel code vers quel code) mais **pauvre en valeurs structurées** (chirurgien, montant, dates, motifs) et **incomplet pour les écritures hors workflow** (PATCH directs, callbacks, documents). Les tables prévues pour ces besoins (`quotes`, `calendar_events`, `medical_decisions`, `audit_logs`) sont vides.

---

## 6. Écarts et questions ouvertes pour la phase d'analyse

1. Faut-il considérer `patient_messages` comme **la** source d'audit officielle (et documenter `audit_logs` comme abandonné) ?
2. Les `meta` des actions doivent-ils être enrichis (ex. `surgeon_id`, `previous_surgeon_id`, `quote_amount`, `proposed_date`, `reason_code`) pour rendre les questions 2, 6 et 8 reconstructibles sans parsing ?
3. Les écritures **hors** `change-status` (`commercial-data`, `update-summary`, callback questionnaire, documents) doivent-elles être journalisées ?
4. Le refus « administratif » de Marcel doit-il devenir une action / un statut distinct du refus médical ?
5. `updated_at` doit-il être remis sous trigger, ou la « dernière activité » doit-elle être définie comme `max(patient_messages.created_at)` ?
6. Le `topic` des messages libres doit-il être honoré par l'API pour permettre la séparation médical / commercial (et rendre la policy Gilles sur `topic` pertinente) ?
7. Les 4 codes statut inatteignables (`quote_issued`, `quote_accepted`, `surgery_done`, `completed`) doivent-ils être retirés du référentiel prod ou mappés explicitement dans `GLOBAL_STATUS_DB_CODES` ?

Aucune de ces questions n'a fait l'objet d'une modification : ce document est un état des lieux.
