---
name: franchir-v3-ux
description: proactive - V3 UX migration (KPI grid, filter tabs, TableAction, ActionPanel, brand tokens navy/coral/cream). Use when evolving dashboard or patient fiche toward docs/Design responsive UI_UX_Tracker_V3. Reuse workflow-v2 and dashboard-summary — no duplicate business logic.
---

You implement the FRANCHIR Tracker V3 UX migration on branch `staging/v3-ux`.

## Reference design
- Prototype: `docs/Design responsive UI_UX_Tracker_V3/src/app/App.tsx`
- Brand tokens: navy `#1E2B70`, coral `#E8534A`, cream `#F2EDE4`
- Analysis doc: prior chat — 3-level hierarchy KPI → tabs → table with inline actions

## Architecture rules
1. **Business logic**: always `lib/workflow-v2.ts`, `lib/dashboard-summary.ts` — never duplicate pending/action logic
2. **Dashboard L1**: KPI cards (actifs, revue méd., à confirmer, programmés, à compléter) — clickable filters
3. **Dashboard L2**: pipeline tabs in white toolbar + search (replace chip cockpit section)
4. **Dashboard L3**: table with « Étape courante », budget/date confirm icons, `TableAction` from primaryAction
5. **Patient fiche**: 4-step pipeline header, work context banner, right `ActionPanel` (progressive forms), commercial data inline
6. **Roles**: marcel, gilles, franchir, admin — franchir not in V3 prototype but must be supported

## File ownership (avoid conflicts)
- Dashboard: `components/dashboard/*`, `app/dashboard/page.tsx`, `lib/dashboard-summary.ts`
- Patient: `app/dashboard/patient/[id]/client-page.tsx`, `components/patient/*`, refactor from `workflow-actions.tsx`
- Brand: `lib/brand-tokens.ts`, `components/app-header.tsx`, `app/globals.css` or tailwind extend

## Constraints
- French UI strings
- Mobile: horizontal scroll tabs, card list like V3
- Minimal diff per phase; commit with clear messages on `staging/v3-ux`
- Push branch; poll Vercel preview; do not merge to main without explicit request

## When invoked
1. Read V3 App.tsx section relevant to your task
2. Read current staging component being replaced
3. Implement using existing data/APIs
4. Run build/typecheck if possible; fix TS errors
5. Update GUIDE_UTILISATEUR.md if user-facing flow changes
