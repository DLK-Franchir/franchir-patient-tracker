---
name: franchir-questionnaire-dispatch
description: proactive - staff questionnaire link dispatch (prepare → copy/mailto modal, no opaque Resend auto-send). Use when changing Envoyer Cervical/Lombaire flow, email draft copy-paste for Marcel Outlook/Gmail, sendEmail=false bridge contract, or questionnaire completion rate via manual staff send.
---

Tu es l’agent **dispatch questionnaire staff** (tracker → questionnaires).

## Objectif produit

Remplacer l’envoi Resend opaque (souvent spam) par :

1. Sélection pathologie + langue (inchangé)
2. Bouton **Préparer l’envoi**
3. Modale : objet + corps + lien magique → **Tout copier** (primary) / **Copier le lien** / **mailto** (secondaire)
4. Marcel marque **J’ai envoyé** → statut `sent`

Canal prioritaire = boîte mail / WhatsApp de Marcel. Resend reste optionnel / legacy.

## Cartographie

| Couche | Fichier |
|--------|---------|
| UI fiche | `components/patient/questionnaire-patient-card.tsx` |
| Modale | `components/patient/questionnaire-dispatch-modal.tsx` |
| Client page | `app/dashboard/patient/[id]/client-page.tsx` |
| Issue API | `POST /api/patients/[id]/questionnaire-link` |
| Confirm API | `POST /api/patients/[id]/questionnaire-dispatch-confirm` |
| Orchestration | `lib/integrations/issue-questionnaire-link.ts` |
| Draft texte | `lib/integrations/questionnaire-email-draft.ts` |
| Contrat Q | `docs/ops/QUESTIONNAIRE_DISPATCH.md` |
| Création patient | `app/api/patients/route.ts` — **plus d’auto-send** |

## Contrat pont (repo questionnaires — PR jumelle)

`POST /api/integrations/tracker/questionnaire-link` accepte :

```json
{
  "trackerPatientId": "uuid",
  "newSession": false,
  "patientEmail": "…",
  "sendEmail": false
}
```

Réponse attendue (staff M2M only) :

```json
{
  "emailSent": false,
  "expiresAt": "ISO",
  "url": "https://questionnaire.franchir.eu/…",
  "emailDraft": { "subject": "…", "textBody": "…" }
}
```

- `sendEmail: false` → **ne pas** appeler Resend ; retourner `url` (+ draft si dispo).
- Absent / `true` → comportement legacy Resend.
- Ne jamais logger le token URL (PHI).

## Règles

1. **Sélection ≠ envoi** — boutons Cervical/Lombaire/Combiné sélectionnent ; validation = Préparer.
2. **URL révélée uniquement** au staff gestionnaire (marcel/admin/franchir), via API tracker auth.
3. **`sent` / `questionnaire_sent_at`** = Marcel a confirmé l’envoi **ou** Resend legacy `emailSent`.
4. **Copier tout** = chemin critique ; mailto = confort (limites URL / client mail).
5. Fix = **2 PR** si Q change aussi. Pas de PHI dans logs/PR.
6. Ne pas renvoyer « pour tester » sur dossier existant (ops Resend).

## Workflow implémentation / debug

1. Vérifier Q accepte `sendEmail: false` et renvoie `url`.
2. Tracker : prepare → modale peuplée → copy → confirm-dispatch.
3. Legacy : si pas de `url` mais `emailSent` → banner mode Resend auto.
4. Création dossier : pas d’issue auto ; Marcel prépare depuis la fiche.
5. Audit : `questionnaire_prepare` / `questionnaire_staff_dispatch` / legacy resend.

## Livrable

Checklist UI + contrat pont + preuves (copie / mailto / confirm → `sent`) sans secrets ni PHI.
