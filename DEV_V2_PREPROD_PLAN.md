# DEV V2 PREPROD — État actuel et plan d’exécution

Date de référence : 2026-05-04

## 0) Mise à jour de cadrage — avancement réel

### Réalisé dans cette phase

- `README.md` mis à jour pour refléter l’état réel V2 préprod.
- `DEV_V2_PREPROD_PLAN.md` créé pour historiser l’existant et ordonner les chantiers.
- Correctif technique immédiat livré sur les erreurs TypeScript de `app/dashboard/patient/[id]/client-page.tsx`.
- Typage `Message.meta` sécurisé dans `components/patient/message-thread.tsx` pour l’historique de statuts.
- Étape 6 — Durcissement sécurité livrée :
  - Cookies SSR durcis (`httpOnly`, `secure`, `sameSite: 'strict'`).
  - RLS renforcé via `supabase/migrations/20260506_step6_security_hardening.sql`.
  - PII retiré des emails externes avec référence opaque `DOS-XXXXXXXXXX`.
  - Logger enrichi (`user_id`, `role`, `patient_id`) avec masquage des champs sensibles.
- Correctif bloquant appliqué sur `lib/email-templates.ts` pour relance locale.
- Application relancée et validée localement sur `http://localhost:3000`.

### Statut qualité vérifié

- `npm run type-check` : OK
- `npm run lint` : OK (warnings existants, 0 erreur)
- `npm run build` : OK
- `npm run format:check` : KO (écarts de formatage historiques sur de nombreux fichiers)
- `npm run check` : KO uniquement à cause de `format:check`
- Problems workspace : 0 erreur bloquante

### Cadence d’exécution recommandée à partir d’ici

- Batch A : Étapes 1 à 3 (fondations code et architecture)
- Batch B : Étapes 4 à 6 (sécurité, autorisation, validation) — livré
- Batch C : Étapes 7 et 8 (UX ciblée et évolutivité) — prochain lot

## 1) Historisation de l’état actuel (code réel)

### Architecture

- Les routes API patient sont déjà séparées par usage :
  - `app/api/patients/route.ts`
  - `app/api/patients/[id]/change-status/route.ts`
  - `app/api/patients/[id]/messages/route.ts`
  - `app/api/patients/[id]/commercial-data/route.ts`
  - `app/api/patients/[id]/update-summary/route.ts`
- Standard de handler déjà en place via `lib/api/route-handler.ts`.
- Logique métier aujourd’hui distribuée entre routes, `lib/access-control.ts` et `lib/workflow-v2.ts`.

### Sécurité

- Contrôle session et redirection centralisés dans `proxy.ts`.
- Contrôle rôle/email staff dans `lib/access-control.ts`.
- Service role key encapsulée côté serveur uniquement dans `lib/supabase/service-role.ts`.
- RLS renforcé via `supabase/migrations/20260503_guard_staff_access.sql` et `supabase/migrations/20260506_step6_security_hardening.sql`.
- Cookies SSR forcés en mode strict (`httpOnly`, `secure`, `sameSite: 'strict'`).

### Workflow et validations

- Workflow opérationnel dans `lib/workflow-v2.ts` + API `change-status`.
- Actions contextualisées côté UI (`components/workflow-actions.tsx`) et revalidées côté API.
- Validation Zod appliquée sur les payloads des routes `app/api/patients/*` et `app/api/notify`.

### UX

- Détail patient structuré en onglets + timeline visuelle (`app/dashboard/patient/[id]/client-page.tsx`, `components/workflow-timeline.tsx`).
- Filtres messages déjà disponibles (type, thème, auteur, date).
- Dashboard avec recherche, filtres statut, tri et pagination (`app/dashboard/page.tsx`, `components/dashboard/patient-list.tsx`).

### Notifications et audit

- Notifications in-app + email via `lib/notifications.ts` et `lib/email-templates.ts`.
- Emails externes assainis : aucune donnée patient sensible dans le subject/body, référence opaque utilisée.
- Logger structuré enrichi avec contexte métier + masquage récursif des champs sensibles.

## 2) Plan d’exécution Dev (ordre recommandé)

### Étape 0 — Baseline technique

1. Geler l’état preprod et lister écarts DB/code.
2. Vérifier schéma réel `patient_messages` et `notifications` en base.
3. Valider la couverture RLS table par table.

Livrables : matrice “table x policy”, backlog de migration SQL.

### Étape 1 — Constants et types unifiés

1. Créer `lib/constants.ts` (`ROLES`, `STATUSES`).
2. Référencer ces types dans `workflow-v2`, `access-control`, API routes, composants.
3. Supprimer les unions dupliquées.

Critère d’acceptation : aucune string de rôle/statut “hardcodée” hors constants.

### Étape 2 — Domaine patient dédié

1. Créer `lib/domain/patients/types.ts`.
2. Créer `lib/domain/patients/workflow.ts` pur (sans I/O).
3. Créer `lib/domain/patients/service.ts` pour CRUD/mutations Supabase.
4. Créer `lib/domain/patients/events.ts` pour émission des événements métier.

Critère d’acceptation : routes API réduites à orchestration + validation + réponse.

### Étape 3 — CQRS light

1. Créer `lib/queries/patients.ts` (listes, détail, filtres, tri).
2. Créer `lib/commands/patients.ts` (create, status transition, message, commercial update).
3. Faire migrer `app/dashboard/page.tsx` et routes API vers queries/commands.

Critère d’acceptation : lecture et écriture découplées, sans duplication de requêtes.

### Étape 4 — Autorisation centralisée unique

1. Ajouter `canPerformAction(role, action, patient)` avec retour structuré :
   - `allowed`
   - `reason`
   - `fieldsLocked`
2. Brancher API + UI sur ce point unique.
3. Retirer checks dispersés.

Critère d’acceptation : toute action métier passe par la même API d’autorisation.

### Étape 5 — Zod au centre du flux

1. Étendre `lib/validations.ts` avec schémas dédiés :
   - `PatientCreateSchema`
   - `StatusChangeSchema`
   - `MessageSchema`
   - `CommercialDataUpdateSchema`
2. Valider toutes les payloads API avant traitement.
3. Réexporter types inférés pour front/back.

Critère d’acceptation : 100% des routes `app/api/patients/*` et `app/api/notify` validées Zod.

### Étape 6 — Durcissement sécurité (Livrée ✅)

1. Cookies SSR : forcer `httpOnly`, `secure`, `sameSite: 'strict'` dans le flux proxy/server.
2. RLS : ajouter/renforcer `USING` + `WITH CHECK` par table sensible (`patients`, `patient_messages`, `notifications`).
3. Notification email : supprimer données sensibles du subject/body, garder lien sécurisé + ID opaque.
4. Logger : enrichir contexte `user_id`, `role`, `patient_id` + masquage champs sensibles.

Critère d’acceptation : aucun PII/santé dans logs et emails externes.

### Étape 7 — UX workflow ciblée

1. Timeline enrichie : statut + date + auteur.
2. Actions contextualisées : micro-textes explicatifs et masquage action non pertinente.
3. Messages : séparation clinique/logistique + ancre “depuis dernière connexion”.
4. Repères rôle : bandeau explicite + raccourcis “actions du jour”.

Critère d’acceptation : parcours lisible en moins de 2 clics par rôle.

### Étape 8 — Préparation évolutivité

1. Introduire `severity: 'info' | 'action_required'` pour notifications.
2. Préparer modèle de rôles configurable en base tout en conservant compat mapping actuel.
3. Ajouter vue admin multi-dossiers : filtres métier + tri dernière activité + recherche.

Critère d’acceptation : extension de rôles/notifications sans refonte API majeure.

## 3) Priorisation de livraison

- Sprint 1 : Étapes 1 à 3
- Sprint 2 : Étapes 4 à 6 — livré
- Sprint 3 : Étapes 7 et 8 — prochain lot

## 4) Contrôles à exécuter à chaque lot

- `npm run type-check`
- `npm run lint`
- `npm run format:check`
- `npm run build`
