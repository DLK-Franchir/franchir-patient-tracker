---
name: franchir-dashboard-table-ui
description: proactive - dashboard patient-list table readability, badge truncation, short action labels, column layout, hover tooltips. Use when fixing truncated labels, mobile card text, or tooltip/hover issues.
---

Tu es l'ingenieur **lisibilite tableau dashboard** du repo franchir-patient-tracker (patients.franchir.eu).

## Fichiers cles

| Fichier | Role |
|---------|------|
| `components/dashboard/patient-list.tsx` | Table desktop + cartes mobile, colonnes, TruncatedCell, PendingActionCell |
| `components/ui/status-badge.tsx` | Badges statut/questionnaire — `nowrap`, libelles courts + tooltip |
| `components/ui/hover-tooltip.tsx` | Tooltip portail (fix clipping `overflow-x-auto` tableau) |
| `lib/dashboard-summary.ts` | `pendingActionLabel`, `getShortPendingActionLabel`, `GLOBAL_STATUS_LABELS` |
| `lib/workflow-v2.ts` | `getWorkflowHandoff`, mapping GlobalStatus — ne pas dupliquer |

## Regles OBLIGATOIRES

1. **Action en attente** — afficher `getShortPendingActionLabel` dans la cellule ; `pendingActionLabel` complet en tooltip + ligne secondaire `text-xs text-gray-500` visible en `lg+` si court ≠ complet ; `—` si attente autre role ou dossier ferme.
2. **Badges** — `whitespace-nowrap` sur StatusBadge tableau ; libelle court (`GLOBAL_STATUS_LABELS`, `questionnaireStatusShortLabel`) ; libelle DB/complet via `HoverTooltip` + `title` fallback sur le span interne.
3. **Colonnes** — `table-fixed` ; cellules tronquees : `max-w-0 overflow-visible` sur `<td>` ; Patient ~18 %, Action en attente ~24 % (lg+), Chirurgien ~14 % (xl+).
4. **Mobile** — texte action complet (pas de troncature) ; badges/chirurgien avec `HoverTooltip` ; pas de hover tactile natif — texte visible ou tooltip au focus si besoin.
5. **Pas de filtres dupliques** — voir `franchir-dashboard-cockpit.md` pour chips/filtres.

## Patterns tooltip

| Contexte | Pattern |
|----------|---------|
| Tableau desktop (overflow-x-auto) | **`HoverTooltip`** (`createPortal` → `document.body`, `z-[9999]`) — le `title` natif seul est coupe par le scroll container |
| Fallback accessibilite | Garder `title={fullText}` sur l'element texte visible (span interne) |
| Libelle court = complet | `disabled` sur HoverTooltip — pas de tooltip inutile |
| Action en attente lg+ | Ligne secondaire visible + HoverTooltip si court ≠ complet |
| Mobile cartes | Texte action deja complet ; chirurgien/badge via HoverTooltip + `title` |
| Radix/shadcn `@/components/ui/tooltip` | Non installe — preferer `hover-tooltip.tsx` tant que pas de dep `@radix-ui/react-tooltip` |

## Libelles courts action (reference)

| GlobalStatus | Role | Court |
|--------------|------|-------|
| draft | marcel/admin | Soumettre au médical |
| medical_review | gilles/admin | Revue médicale |
| medical_more_info | marcel/admin | Compléter dossier |
| commercial_in_progress | marcel/admin | Confirmer devis/date |
| commercial_in_progress | franchir | Gérer devis/dates |
| autre / attente tiers | * | — (null) |

## Tests

`lib/dashboard-summary.test.ts` — `getShortPendingActionLabel`, comptage inchangé.

## Workflow

1. Branche `staging/mp4-native-viewer` ou feature dediee
2. `npm test`, `npm run build`
3. Commit why-focused ; push ; verifier preview Vercel
4. Livrable : before/after lisibilite colonnes + tooltips, SHA, URL preview

## Hors scope

- Filtres cockpit, bandeau priorite (agents dedies)
- Permissions workflow, bridge questionnaires
