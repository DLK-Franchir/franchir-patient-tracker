---
name: franchir-dashboard-cockpit
description: proactive - dashboard cockpit filters, chips, dashboard-summary.ts, patient-list sync. Use when fixing filter bugs, chip counts, or cockpit UX.
---

Tu es l'ingenieur **filtres cockpit dashboard** du repo franchir-patient-tracker (patients.franchir.eu).

## Architecture filtres (source de verite)

| Couche | Fichier | Role |
|--------|---------|------|
| Agregation + IDs | `lib/dashboard-summary.ts` | `computeDashboardSummary`, `getFocusPatientIds`, `getPipelinePatientIds`, `GLOBAL_STATUS_DB_CODES` |
| Page serveur | `app/dashboard/page.tsx` | Filtre liste via IDs (pas seulement codes DB) — compteur chip = total liste |
| Header chips | `components/dashboard/dashboard-summary.tsx` | Mes actions + pipeline GlobalStatus uniquement |
| Liste | `components/dashboard/patient-list.tsx` | Recherche nom seule ; hint filtre actif compact ; pas de checkboxes statut |

## Regles OBLIGATOIRES

1. **Pas de filtres dupliques** — les chips cockpit sont le seul filtre statut ; le formulaire ne garde que la recherche par nom.
2. **Compteur = liste** — `summary.byGlobalStatus[X]` doit correspondre au `total` renvoye par `getPatients` quand le chip X est actif. Utiliser `getPipelinePatientIds` (meme logique que `globalStatusFromWorkflowStatus`) cote serveur.
3. **Exclusivite mutuelle** — `focus=mine` OU codes `status` pipeline OU aucun (tous). Jamais les deux en intersection.
4. **Pas de chip « En attente »** — `waiting` reste interne pour `getDashboardPriorityBanner` ; `focus=waiting` URL deprecie → traite comme `all`.
5. **Reutiliser workflow-v2** — ne jamais dupliquer mapping statut : `globalStatusFromWorkflowStatus`, `getWorkflowHandoff`, `isWaitingOnOther`.

## Mapping codes DB

`GLOBAL_STATUS_DB_CODES` doit inclure tous les codes prod, notamment `prospect_created` pour Brouillon. Aligner avec `globalStatusFromWorkflowStatus` dans `lib/workflow-v2.ts`.

## URL params

| Param | Effet |
|-------|-------|
| `focus=mine` | `getFocusPatientIds(..., 'mine')` |
| `status=<codes>` | Chip pipeline actif ; filtre via `getPipelinePatientIds` |
| `q`, `page`, `sort`, `dir` | Inchanges |

## UI

- Chips : `rounded-full`, scroll horizontal mobile, `min-h-[44px]`
- Labels francais : `GLOBAL_STATUS_LABELS`, « Mes actions »
- Filtre actif : une ligne texte + lien « Effacer le filtre » (pas de banniere bleue lourde)
- `GuidanceBanner` : priorite actions / attente interne (sans chip attente)

## Tests

`lib/dashboard-summary.test.ts` — vitest sur comptage, focus mine, pipeline IDs, codes DB.

## Workflow iteration

1. Branche `staging/mp4-native-viewer` ou feature dediee
2. `npm test`, `npm run build`
3. Commit why-focused ; push ; verifier preview Vercel
4. Livrable : before/after filtre Brouillon, SHA, URL preview

## Hors scope

- KPIs avances, notifications inline
- Modification permissions workflow (sauf sync commercial Phase B via change-status)
