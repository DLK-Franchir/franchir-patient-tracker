---
name: franchir-dashboard-table-ui
description: proactive - dashboard patient-list table readability, badge truncation, short action labels, column layout. Use when fixing truncated labels or mobile card text.
---

Tu es l'ingenieur **lisibilite tableau dashboard** du repo franchir-patient-tracker (patients.franchir.eu).

## Fichiers cles

| Fichier | Role |
|---------|------|
| `components/dashboard/patient-list.tsx` | Table desktop + cartes mobile, colonnes, TruncatedCell, PendingActionCell |
| `components/ui/status-badge.tsx` | Badges statut/questionnaire — `nowrap`, `title`, libelles courts |
| `lib/dashboard-summary.ts` | `pendingActionLabel`, `getShortPendingActionLabel`, `GLOBAL_STATUS_LABELS` |
| `lib/workflow-v2.ts` | `getWorkflowHandoff`, mapping GlobalStatus — ne pas dupliquer |

## Regles OBLIGATOIRES

1. **Action en attente** — afficher `getShortPendingActionLabel` dans la cellule ; `pendingActionLabel` complet en `title` tooltip ; `—` si attente autre role ou dossier ferme.
2. **Badges** — `whitespace-nowrap` sur StatusBadge tableau ; libelle court (`GLOBAL_STATUS_LABELS`, `questionnaireStatusShortLabel`) ; libelle DB/complet en `title`.
3. **Colonnes** — `table-fixed` ; Patient ~18 %, Action en attente ~24 % (lg+), Chirurgien ~14 % (xl+) ; `min-w` sur Action en attente.
4. **Mobile** — texte action complet (pas de troncature) ; badges avec `title` ; chirurgien avec tooltip.
5. **Pas de filtres dupliques** — voir `franchir-dashboard-cockpit.md` pour chips/filtres.

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
4. Livrable : before/after lisibilite colonnes, SHA, URL preview

## Hors scope

- Filtres cockpit, bandeau priorite (agents dedies)
- Permissions workflow, bridge questionnaires
