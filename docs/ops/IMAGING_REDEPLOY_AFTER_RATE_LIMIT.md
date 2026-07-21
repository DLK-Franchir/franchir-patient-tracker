# Imaging redeploy after Vercel rate limit

**Do not spam Production redeploys while rate-limited.** Wait for the limit to clear, then redeploy once per app from `main`.

## Context (as of 2026-07-20)

| App | Prod live (stale) | Ready on `main` (not live yet) |
|-----|-------------------|--------------------------------|
| Tracker Marcel (`patients.franchir.eu`) | `294da56` (docs #66) | `9c1a958` — cleanup cron #67 (+ MP4 ops #68) |
| Questionnaires (`questionnaire.franchir.eu`) | `bdab7f3` / imaging-viewer **0.13.0** | `59185ca` — Q #54 pin viewer **0.13.1** |

Rate limit window observed: ~24h. Prefer a single coordinated redeploy after clearance.

## Prerequisites (tracker Production env)

| Variable | Role |
|----------|------|
| `CRON_SECRET` | Injected by Vercel Cron as `Authorization: Bearer …` |
| `TRACKER_SYNC_SERVICE_TOKEN` | Fallback Bearer for manual / dry-run cleanup |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage cleanup (service role) |

Presence only — never print values. Confirm with:

```bash
npx vercel env ls production --cwd /path/to/franchir-patient-tracker \
  | awk '{print $1}' | grep -E '^(CRON_SECRET|TRACKER_SYNC_SERVICE_TOKEN)$'
```

If `CRON_SECRET` is missing (Cron auth will fail until set):

```bash
# stdin only — do not echo the secret
openssl rand -base64 48 | tr -d '\n' \
  | npx vercel env add CRON_SECRET production --yes
```

## Steps after rate limit clears

### 1. Redeploy Production from `main` (once each)

Tracker (SoT cron + Storage cleanup):

```bash
cd /path/to/franchir-patient-tracker
git checkout main && git pull origin main
npx vercel deploy --prod --yes
# expect commit ≈ 9c1a958 (or later main tip)
```

Questionnaires (viewer pin / clinicien parity):

```bash
cd /path/to/Franchir_Questionnaires_Patients
git checkout main && git pull origin main
npx vercel deploy --prod --yes
# expect commit ≈ 59185ca (or later main tip)
```

Confirm domains: `patients.franchir.eu` → project `franchir-patient-tracker`; `questionnaire.franchir.eu` → `franchir-questionnaires-patients` (not `*-unified`).

### 2. Verify cron on tracker Vercel

1. Project **franchir-patient-tracker** → Settings → Cron Jobs (or Deployment → Cron).
2. Path: `/api/internal/imaging/cleanup-async-exports`
3. Schedule: `15 3 * * *` (UTC) — from `vercel.json`.
4. Confirm Production deployment includes that cron after the redeploy above.

### 3. Dry-run cleanup (no deletes)

```bash
export TRACKER_URL=https://patients.franchir.eu
# load TRACKER_SYNC_SERVICE_TOKEN from a secure local source — never paste into chat/PR
curl -sS -H "Authorization: Bearer $TRACKER_SYNC_SERVICE_TOKEN" \
  "$TRACKER_URL/api/internal/imaging/cleanup-async-exports?dryRun=1" | jq .
```

Expect JSON counters only (`jobsScanned`, `jobsExpired`, `objectsDeleted`, …). No PHI / paths / job IDs in logs.

Optional apply (omit `dryRun`) only after dry-run looks sane — see [IMAGING_RUNBOOK.md](./IMAGING_RUNBOOK.md#async-export-cleanup-p7).

## Out of scope while rate-limited

- Preview spam, force-redeploy loops, or “retry until green” deploys.
- Docs-only merges may still trigger a Production deploy and hit the same limit — if so, merge the docs PR and defer the imaging redeploy until the window clears.

## Related

- Runbook cleanup section: [IMAGING_RUNBOOK.md](./IMAGING_RUNBOOK.md#async-export-cleanup-p7)
- Adapters note: [IMAGING_ADAPTERS.md](./IMAGING_ADAPTERS.md)
