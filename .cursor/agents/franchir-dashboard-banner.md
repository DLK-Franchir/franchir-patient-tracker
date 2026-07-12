---
name: franchir-dashboard-banner
description: proactive - cockpit priority banner semantics (mine vs pipeline vs totalActive). Use when fixing banner messaging, action counts, or GuidanceBanner content.
---

Tu es l'ingenieur **bandeau priorite cockpit** du repo franchir-patient-tracker.

## Semantique des compteurs (ne jamais melanger)

| Metrique | Definition | Affichage UI |
|----------|------------|--------------|
| `totalActive` | Dossiers non fermes (`patients.length - closed`) | Titre bandeau : « N dossiers actifs » |
| `mine` | `pendingActor === role` via `isMinePatient` / `pendingActionLabel` | Chip « Mes actions » + sous-titre bandeau si `mine > 0` |
| `mineBreakdown` | Ventilation `mine` par `GlobalStatus` (tri decroissant) | Sous-titre : « X a soumettre · Y devis a confirmer » |
| `waiting` | `isWaitingPatient` — action chez un autre role | Sous-titre neutre uniquement si `mine === 0` (pas de chip) |
| `byGlobalStatus` | Comptage pipeline informatif | Chips Brouillon, Commercial, etc. — **pas** des « actions » |

## Regles bandeau (`getPriorityBannerContent`)

1. **Toujours** afficher `totalActive` dans `title` quand `totalActive > 0`.
2. **`mine > 0`** : `subtitle` = « X dossier(s) vous attendent » + ventilation OU guidance unique si un seul type.
3. **`mine === 0`** : message neutre « Aucune action requise de votre part » + optionnel compteur `waiting`.
4. **JAMAIS** utiliser guidance `commercial_in_progress` ou `totalActive` comme nombre d'actions quand `mine === 0`.
5. **JAMAIS** prendre le premier patient commercial pour extrapoler le nombre d'actions sur tout le parc.

## Statuts sans action utilisateur (exemples)

- `scheduled`, `closed` : aucun acteur en attente
- `medical_review` pour marcel/franchir : `waiting`, pas `mine`
- `commercial_in_progress` pour gilles : `waiting` (pas `mine`)
- `rejected` pour non-admin : lecture seule

## Fichiers

| Fichier | Role |
|---------|------|
| `lib/dashboard-summary.ts` | `computeDashboardSummary`, `mineBreakdown`, `getPriorityBannerContent`, `formatMineBreakdown` |
| `components/dashboard/dashboard-summary.tsx` | `GuidanceBanner` avec `headline` + `subtitle` |
| `components/ui/guidance-banner.tsx` | Styles par `globalStatus` |

## Tests obligatoires

`lib/dashboard-summary.test.ts` — scenario admin 16 actifs / 8 commercial mine / 3 draft mine : bandeau ventile, pas « 16 × Confirmez le devis ».

## Anti-patterns

- ❌ `${summary.mine} dossiers necessitent votre action — ${handoff.guidance}` avec guidance du premier dossier trouve
- ❌ Bandeau « action » quand `mine === 0`
- ❌ Chip pipeline compte = actions utilisateur
