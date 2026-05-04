# FRANCHIR Patient Tracker — V2 Preprod

Application web de suivi de parcours patient pour FRANCHIR.

## Snapshot actuel

Date de référence : 2026-05-04 (préprod V2)

- Frontend : Next.js 16.1.1 (App Router), React 19.2.3, Tailwind CSS 4
- Backend : Supabase (Postgres, Auth, Realtime, RLS)
- Emails : Resend
- Types : TypeScript strict
- Rôles métier : `marcel`, `gilles`, `franchir`, `admin`

## Avancement validé

### Travaux réalisés

- Cadrage documentaire : `README.md` + `DEV_V2_PREPROD_PLAN.md`
- Stabilisation technique : corrections TS UI + typage `Message.meta`
- Correctif bloquant : `lib/email-templates.ts`
- Étape 6 livrée (durcissement sécurité) :
  - cookies SSR forcés en `httpOnly`, `secure`, `sameSite: 'strict'`
  - migration RLS renforcée `supabase/migrations/20260506_step6_security_hardening.sql`
  - suppression des PII dans emails externes (référence opaque dossier)
  - logger enrichi (`user_id`, `role`, `patient_id`) + masquage champs sensibles
- Exécution locale validée : `http://localhost:3000`

### État qualité

- `npm run type-check` : OK
- `npm run lint` : OK (warnings historiques, 0 erreur)
- `npm run build` : OK
- `npm run format:check` : KO (drift de formatage historique)

### Prochain lot

1. Étape 7 : UX workflow ciblée
2. Étape 8 : préparation évolutivité

## Démarrage rapide

```bash
npm install
npm run dev
```

Scripts qualité/build :

```bash
npm run type-check
npm run lint
npm run format:check
npm run build
```

## Variables d’environnement

Créer `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_APP_URL=https://app.franchir.eu
```

## Architecture actuelle

- `app/api/patients/route.ts` : création dossier patient
- `app/api/patients/[id]/change-status/route.ts` : transitions workflow
- `app/api/patients/[id]/messages/route.ts` : messagerie patient
- `app/api/patients/[id]/commercial-data/route.ts` : données commerciales
- `app/api/patients/[id]/update-summary/route.ts` : résumé clinique
- `app/api/notify/route.ts` : envoi email staff contrôlé
- `lib/access-control.ts` : autorisations par rôle/action
- `lib/workflow-v2.ts` : statuts + actions disponibles
- `lib/notifications.ts` : notifications in-app + emails
- `proxy.ts` : contrôle session et accès staff

## Sécurité en place

- Session Supabase vérifiée côté serveur et via `proxy.ts`
- Client service role isolé serveur (`lib/supabase/service-role.ts`)
- Policies RLS renforcées :
  - `supabase/migrations/20260503_guard_staff_access.sql`
  - `supabase/migrations/20260506_step6_security_hardening.sql`
- Cookies SSR durcis (`httpOnly`, `secure`, `sameSite: 'strict'`)
- Emails externes assainis (pas de PII patient)
- Logger enrichi audit + masquage champs sensibles

## Référence plan Dev

Le plan d’exécution détaillé est dans :

- `DEV_V2_PREPROD_PLAN.md`
