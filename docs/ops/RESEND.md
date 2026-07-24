# Resend — tracker Marcel

Voir aussi le runbook détaillé côté questionnaires :  
`Franchir_Questionnaires_Patients/docs/ops/RESEND.md`.

## Ce repo envoie

- Notifs staff (nouveau dossier, message, statut, commercial) — `lib/notifications.ts`
- Assignation chirurgien — même module
- `/api/notify` — envoi staff gateé

Expéditeur : `FRANCHIR <yves.merillon@franchir.eu>` (`lib/email-config.ts`).  
Env : `RESEND_API_KEY`.

Les **emails patient** (lien questionnaire) partent **uniquement** de l’app questionnaires (`RESEND_API_KEY` + `EMAIL_FROM_ADDRESS` là-bas).

## Tags

Tous les envois tracker portent `app=tracker` + `kind=…` (+ `patient_id` quand pertinent) pour filtrage MCP / dashboard.

## MCP

`.cursor/mcp.json` → server `resend` = `https://mcp.resend.com/mcp` (OAuth, pas de clé en repo).

## Ne pas faire

- Migrer le compte prod vers **Vercel Marketplace Resend** (domaine déjà vérifié hors Vercel Domains)
- Mettre une `re_` key dans `mcp.json` (préférer OAuth)
- Logger destinataires patient / corps d’email (PHI)
