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
- **Contrat synthèse (P1)** : `packages/synthesis-contract` vendored — ne pas éditer ici ; sync depuis Q (`npm run contract:sync`)
- **Imagerie grouping (P0)** : `packages/imaging` (`@franchir/imaging`) — **SoT = ce repo** ; après edit : `npm run imaging:sync` → questionnaires ; CI `imaging:check`
- **Visionneuse produit (P2.1 / 0.4.0)** : `packages/imaging-viewer` (`@franchir/imaging-viewer`) — contrat + policy + engine + `/ui` (host `DicomViewer`, chrome, PDF DOC, fallback OpenJPEG) + assets codec ; **SoT = ce repo** ; `npm run imaging-viewer:sync` / `imaging-viewer:check` ; residual app = auth / URLs / rewrite workers (P2.2)
- **Adapters listing / signed URLs (P2.2b)** : `docs/ops/IMAGING_ADAPTERS.md` — soft-refresh TTL, fast-open, DOC PDF routing, pas d’enrich Range×N au clic
- Docs ops / matrice / blueprint : **repo questionnaires**
- Agent pont : `.cursor/agents/franchir-anamneze-bridge.md`
- Agent imaging : `.cursor/agents/franchir-imaging.md` — DICOM viewer / packages imaging* / sync / parité Marcel↔clinicien
- Agent imaging stabilize : `.cursor/agents/franchir-imaging-stabilize.md` — consolidation pins / golden-path CI / hygiène post-merge (avec `franchir-imaging`)
- Rule Cursor : `.cursor/rules/anamneze-bridge.mdc`

## Règles rapides

1. Source de vérité identité = colonnes `patients.*` → sync neuro
2. Callback entrant : `TRACKER_RETURN_TOKEN` ; sortant sync : `TRACKER_SYNC_SERVICE_TOKEN`
3. Pas de PHI / secrets dans logs ou PR
4. Fix bridge = deux PR si les deux apps changent
5. Après redeploy : smoke pont depuis le repo questionnaires
