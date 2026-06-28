# @franchir/synthesis-contract

Shared types and UI primitives for Anamneze synthesis between **questionnaires** and **tracker**.

Consumed via `file:` dependency:

- Questionnaires: `file:./packages/synthesis-contract`
- Tracker: `file:../Franchir_Questionnaires_Patients/packages/synthesis-contract`

## Contents

- `FunctionalScoreRow`, `OrientationSummaryField` — API contract types
- `birth-date-display` — JJ/MM/AAAA parsing (single source of truth)
- `spine-region-label` — parcours labels (`Cervical + Lombaire`, etc.)
- `FunctionalScoreBars`, `OrientationFieldGrid` — shared presentational components

Questionnaires owns score **builders** (`synthesis-functional-scores.ts`); tracker renders the preview payload only.
