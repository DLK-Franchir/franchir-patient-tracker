# @franchir/synthesis-contract

Shared types and UI primitives for Anamneze synthesis between **questionnaires**
(owner) and **tracker** (vendored pin).

## Ownership

| Repo | Rôle | Dependency |
|------|------|------------|
| `Franchir_Questionnaires_Patients` | **Source de vérité** — éditer ici | `file:./packages/synthesis-contract` |
| `franchir-patient-tracker` | Copie pinée pour builds Vercel isolés | `file:./packages/synthesis-contract` |

Après chaque changement de contrat :

```bash
# depuis questionnaires
npm run contract:sync   # copie → ../franchir-patient-tracker
npm run contract:check  # échoue si drift / versions divergentes
```

Semver dans `package.json` + entrée dans `CHANGELOG.md` (même PR).

| Bump | Quand |
|------|--------|
| **patch** | helpers, classes CSS, docs, tests |
| **minor** | champs preview / exports additifs |
| **major** | rename/remove champs `QuestionnaireSynthesisPreview` ou props UI partagées |

## Contents

- `FunctionalScoreRow`, `OrientationSummaryField`, `QuestionnaireSynthesisPreview`
- `birth-date-display`, `spine-region-label`, `severityClassForRow`
- `FunctionalScoreBars`, `OrientationFieldGrid`

Questionnaires owns score **builders** ; tracker renders the preview payload only.
