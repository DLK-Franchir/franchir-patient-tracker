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
- **Visionneuse produit (suite P0–P8 / 0.13.0+)** : `packages/imaging-viewer` (`@franchir/imaging-viewer`) — contrat + policy + engine + `/ui` + telemetry + export async chrome ; **SoT = ce repo** ; `npm run imaging-viewer:sync` / `imaging-viewer:check` ; adapters app = auth / URLs / listing / export routes ; close-out `docs/ops/IMAGING_STABILIZE.md` ; hors suite = MPR / DICOMDIR / annotations
- **Adapters listing / signed URLs (P2.2b)** : `docs/ops/IMAGING_ADAPTERS.md` — soft-refresh TTL, fast-open, DOC PDF routing, pas d’enrich Range×N au clic
- Docs ops / matrice / blueprint : **repo questionnaires**
- **Email Resend (ops)** : patient = questionnaires uniquement (legacy) ; staff = ce repo ; close-out `docs/ops/RESEND.md` (+ Q `docs/ops/RESEND.md`)
- **Dispatch questionnaire staff** : sélection pathologie/langue → Préparer → modale copier/mailto — `docs/ops/QUESTIONNAIRE_DISPATCH.md` ; agent `.cursor/agents/franchir-questionnaire-dispatch.md` ; PR jumelle Q pour `sendEmail: false` + `url`
- Agent pont : `.cursor/agents/franchir-anamneze-bridge.md`
- Agent email : `.cursor/agents/franchir-bridge-email-verify.md`
- Agent dispatch : `.cursor/agents/franchir-questionnaire-dispatch.md`
- Agent imaging : `.cursor/agents/franchir-imaging.md` — DICOM viewer / packages imaging* / sync / parité Marcel↔clinicien
- Agent imaging stabilize : `.cursor/agents/franchir-imaging-stabilize.md` — consolidation pins / golden-path CI / hygiène post-merge (avec `franchir-imaging`)
- Rule Cursor : `.cursor/rules/anamneze-bridge.mdc`

## Règles rapides

1. Source de vérité identité = colonnes `patients.*` → sync neuro
2. Callback entrant : `TRACKER_RETURN_TOKEN` ; sortant sync : `TRACKER_SYNC_SERVICE_TOKEN`
3. Pas de PHI / secrets dans logs ou PR
4. Fix bridge = deux PR si les deux apps changent
5. Après redeploy : smoke pont depuis le repo questionnaires
