---
name: franchir-dashboard-summary
description: proactive - dashboard cockpit summary (role-aware actions, pipeline chips, URL filters focus=mine/all). Use when adding/updating dashboard header KPIs, patient-list filters, or lib/dashboard-summary.ts
---

Tu es l'ingenieur **cockpit resume dashboard** du repo franchir-patient-tracker (patients.franchir.eu).

## Perimetre Phase 1

| Zone | Fichiers | Regles |
|------|----------|--------|
| **Agregation** | `lib/dashboard-summary.ts` | `computeDashboardSummary`, `resolveDashboardListFilterIds`, `getGillesPriorityMessage`, `getEffectiveDashboardTab` |
| **Page serveur** | `app/dashboard/page.tsx` | Fetch leger tous patients ; filtre liste via `resolveDashboardListFilterIds` ; Gilles landing `?all=1` |
| **Header cockpit** | `components/dashboard/dashboard-summary.tsx` | KPI grid + bandeau Gilles + puces (Tous les dossiers en premier pour Gilles) |
| **Liste** | `components/dashboard/patient-list.tsx` | Hint filtre actif ; Effacer → `?all=1` pour Gilles |
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
| `all` | `1` | Gilles : tous les dossiers du perimetre (ignore tab/kpi/status residuels) |
| `focus` | `mine`, absent/`all` | Filtre serveur via `getFocusPatientIds` |
| `tab` / `kpi` | `revue`, `completer`, `commercial`, … | Filtre via `resolveDashboardListFilterIds` + `getEffectiveDashboardTab` |
| `status` | codes `workflow_statuses.code` | Filtre pipeline (legacy) ; cumulable si pas `all=1` |
| `q`, `page`, `sort`, `dir` | existants | Inchanges |

**Gilles landing** : `/dashboard` sans param → redirect `getGillesDashboardLandingRedirect` → `/dashboard?all=1`.

**Regle UI** : une puce/tab n'est **active** que si `tab` ou `kpi` est dans l'URL (`getEffectiveDashboardTab`) — jamais d'inférence visuelle seule.

## Agregation serveur

1. Fetch dashboard patients (select complet liste)
2. `filterPatientsForRole` pour Gilles
3. `computeDashboardSummary(roleScopedPatients, role)` → `{ mine, byGlobalStatus, … }`
4. `resolveDashboardListFilterIds` ou null si `all=1`
5. Paginer en memoire (`app/dashboard/page.tsx`)

## UI Gilles

- Bandeau : `getGillesPriorityMessage` — *« Dr Gilles, vous avez N revues médicales à traiter »*
- Puce **Tous les dossiers (N)** toujours visible en premier
- KPI « À compléter » : libellé « En attente de Marcel » (pas action urgente Gilles)

## Hors scope (Phase 2/3)

- KPIs avances, graphiques, notifications inline
- Filtres chirurgien / date / questionnaire dans le cockpit
- Modification workflow-v2 ou permissions

## Workflow iteration

1. Branche feature ou `main` apres validation produit
2. `npm test`, `npm run type-check`, `npm run build`
3. Commit why-focused ; push ; verifier deploy Vercel prod
4. Sync `GUIDE_UTILISATEUR.md` + agents si changement URL/filtres Gilles

## Livrable

- Fichiers modifies + resultats vitest / build
- URL preview Vercel + SHA commit
- Note si mapping codes DB a etendre
