---
name: franchir-dashboard-summary
description: proactive - dashboard cockpit summary (role-aware actions, pipeline chips, URL filters focus=mine/waiting). Use when adding/updating dashboard header KPIs, patient-list filters, or lib/dashboard-summary.ts
---

Tu es l'ingenieur **cockpit resume dashboard** du repo franchir-patient-tracker (patients.franchir.eu).

## Perimetre Phase 1

| Zone | Fichiers | Regles |
|------|----------|--------|
| **Agregation** | `lib/dashboard-summary.ts` | `computeDashboardSummary`, `getFocusPatientIds`, `getDashboardPriorityBanner` |
| **Page serveur** | `app/dashboard/page.tsx` | Fetch leger tous patients (id + workflow_statuses.code) ; param URL `focus=mine\|waiting\|all` |
| **Header cockpit** | `components/dashboard/dashboard-summary.tsx` | Banniere priorite + chips cliquables |
| **Liste** | `components/dashboard/patient-list.tsx` | Rendu header au-dessus filtres ; hint filtre actif ; sync chips / formulaire |
| **Tests** | `lib/dashboard-summary.test.ts` | vitest — pas de logique workflow dupliquee |

## Reutilisation workflow-v2 (OBLIGATOIRE)

Ne jamais reimplementer la logique pending / waiting. Toujours passer par :

- `globalStatusFromWorkflowStatus` — mapping code DB → GlobalStatus
- `getWorkflowHandoff` — guidance role-aware
- `isWaitingOnOther` — dossiers en attente d'un autre role
- `pendingActionLabel` (exporte depuis `lib/dashboard-summary.ts`) — action « mine »

`GLOBAL_STATUS_DB_CODES` dans dashboard-summary doit rester aligne sur les codes geres par `globalStatusFromWorkflowStatus`.

## URL params

| Param | Valeurs | Effet |
|-------|---------|-------|
| `focus` | `mine`, `waiting`, absent/`all` | Filtre serveur via `getFocusPatientIds` |
| `status` | codes `workflow_statuses.code` | Filtre pipeline (chips GlobalStatus) ; cumulable avec `focus` |
| `q`, `page`, `sort`, `dir` | existants | Inchanges |

Chips : toggle `focus` ou `status` ; reset page=1 ; sync formulaire filtres (checkboxes statut).

## Agregation serveur

1. `getAllPatientsForSummary()` — select minimal `id, workflow_statuses(code)`
2. `computeDashboardSummary(patients, role)` → `{ mine, waiting, byGlobalStatus, totalActive, closed }`
3. Si `focus` ≠ all : `.in('id', focusPatientIds)` sur la requete paginee
4. Passer `dashboardSummary`, `focus`, `priorityBanner` a `PatientList`

## UI

- Reutiliser `GuidanceBanner` / `STATUS_STYLES` pour la banniere niveau 1
- Chips : `rounded-full`, `#2563EB` actif, badges amber « Mes actions », bleu « En attente »
- Mobile : `overflow-x-auto`, `min-h-[44px]` sur chips
- Labels **francais** : `GLOBAL_STATUS_LABELS`, « Mes actions », « En attente », hint « X dossiers — … · Effacer »

## Hors scope (Phase 2/3)

- KPIs avances, graphiques, notifications inline
- Filtres chirurgien / date / questionnaire dans le cockpit
- Modification workflow-v2 ou permissions

## Workflow iteration

1. Branche feature (ex. `staging/mp4-native-viewer` ou `feat/dashboard-summary-phase1`)
2. `npm test`, `npm run type-check`, `npm run build`
3. Commit why-focused ; push ; verifier deploy Vercel preview
4. Ne pas merger sur `main` sans validation produit

## Livrable

- Fichiers modifies + resultats vitest / build
- URL preview Vercel + SHA commit
- Note si mapping codes DB a etendre
