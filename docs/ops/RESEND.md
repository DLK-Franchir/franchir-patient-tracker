# Resend — tracker Marcel

**Statut prod (2026-07-24) : LIVE** — détail + close-out :  
repo questionnaires `docs/ops/RESEND.md`.

## Ce repo envoie

- Notifs staff (nouveau dossier, message, statut, commercial) — `lib/notifications.ts`
- Assignation chirurgien — même module
- `/api/notify` — envoi staff gateé

Expéditeur : `FRANCHIR <yves.merillon@franchir.eu>` (`lib/email-config.ts`).  
Env : `RESEND_API_KEY`.

Les **emails patient** (lien questionnaire) partent **uniquement** de l’app questionnaires.

## Tags

`app=tracker` + `kind=…` (+ `patient_id` quand pertinent).

## MCP

`.cursor/mcp.json` → `resend` = `https://mcp.resend.com/mcp` (OAuth, pas de clé en repo).

## Vérification

- **Ne pas** renvoyer un lien questionnaire « pour tester » sur un dossier existant.
- Preuve E2E patient : **prochain nouveau dossier** (création normale) — voir Q `docs/ops/RESEND.md`.
- Staff : tags visibles dans Resend dashboard / MCP.

## Sécurité (tracker)

| Contrôle | État |
|----------|------|
| GitHub secret scanning | Enabled |
| Push protection | Enabled |
| Pas de `re_` dans mcp.json | OAuth MCP |
| Pas de PHI dans logs email | Règle agents |

## Ne pas faire

- Migrer vers Vercel Marketplace Resend
- Coller une clé `re_` dans Cursor MCP
- Logger destinataires patient / corps d’email
