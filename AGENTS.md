# Franchir Patient Tracker — contexte agent

## Cartographie

| Rôle | URL | Repo | Supabase |
|------|-----|------|----------|
| Tracker Marcel (ce repo) | https://patients.franchir.eu | `franchir-patient-tracker` | `zdmeidekszdrzmjuasee` |
| Questionnaires | https://questionnaire.franchir.eu | `Franchir_Questionnaires_Patients` | `vsnjahkrsqxbvspwhaka` |

**Hors prod :** fork `*-unified`, Abacus, Anaconda.

## Anamneze / pont (P0–P2)

- Health pont : `GET /api/internal/bridge/health`
- Bearer M2M : `lib/security/service-bearer.ts`
- Stuck-sent : `patients.questionnaire_sent_at`
- Docs ops / matrice / blueprint : **repo questionnaires** (`docs/ops/BRIDGE_OPS_RUNBOOK.md`, `IDENTITY_SYNC_MATRIX.md`, `BLUEPRINT_ANAMNEZE_PERENNE.md`)
- Agent : `.cursor/agents/franchir-anamneze-bridge.md`
- Rule Cursor : `.cursor/rules/anamneze-bridge.mdc`

## Règles rapides

1. Source de vérité identité = colonnes `patients.*` → sync neuro
2. Callback entrant : `TRACKER_RETURN_TOKEN` ; sortant sync : `TRACKER_SYNC_SERVICE_TOKEN`
3. Pas de PHI / secrets dans logs ou PR
4. Fix bridge = deux PR si les deux apps changent
5. Après redeploy : smoke pont depuis le repo questionnaires
