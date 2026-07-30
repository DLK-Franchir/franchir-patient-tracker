---
name: franchir-questionnaire-pathology-send
description: proactive - cervical/lombaire questionnaire send and pathology switch on tracker patient dossier (form_types, resync, newSession, bridge). Use when adding send buttons, changing pathology before/after link issue, or debugging wrong parcours (NDI vs ODI).
---

Tu es l'agent **envoi questionnaire par pathologie** (tracker → questionnaires).

## Cartographie

| Couche | Fichier / endpoint |
|--------|-------------------|
| UI fiche patient | `components/patient/questionnaire-patient-card.tsx`, modale `questionnaire-dispatch-modal.tsx`, `client-page.tsx` |
| API tracker | `POST /api/patients/[id]/questionnaire-link` (`sendEmail: false`) + `…/questionnaire-dispatch-confirm` |
| Orchestration | `lib/integrations/issue-questionnaire-link.ts` — dispatch staff ; voir `franchir-questionnaire-dispatch` |
| Sync SoT | `lib/integrations/questionnaire-portal.ts` → `patient-upsert` |
| DB tracker | `patients.form_types` (`TEXT[]`, cervical / lombaire / les deux) |
| DB questionnaires | `neuro_patients.form_types` |
| Lien patient | `issue-and-send.ts` → URL `?forms=cervical` ou `?forms=cervical,lombaire` |
| Runtime parcours | `layout.tsx` + `resolveSpineRegions` |

## Règles métier (à ne jamais violer)

1. **Lien = `neuro_patients.form_types` au moment de l'émission** (via resync tracker avant `questionnaire-link`).
2. **Changement de pathologie avec session `in_progress`** → `newSession: true` obligatoire (sinon réponses cervical/lombaire mélangées).
3. **Dossier `completed`** → 409, nouveau dossier patient requis.
4. **Combiné cervical+lombaire** : parcours dual supporté (PR #8) ; URL `forms=cervical,lombaire`.
5. **`patientEmail`** toujours passé au bridge si correction tracker récente.

## Workflow implémentation / debug

1. Vérifier `patients.form_types` tracker vs `neuro_patients.form_types`.
2. Tracer : update tracker → `syncPatientToQuestionnaires` → `issueQuestionnaireLink`.
3. Confirmer param `forms` dans l'email Resend (lien généré).
4. Si mauvais parcours : session réutilisée sans `newSession` après switch ?

## Livrable

Checklist pathologie (cervical / lombaire / combiné), preuves DB + URL lien, recommandation `newSession`.
