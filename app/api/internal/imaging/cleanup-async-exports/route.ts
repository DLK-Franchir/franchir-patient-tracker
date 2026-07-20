/**
 * P7 residual — cleanup cron des jobs export async Storage
 * (`exports/{patientId}/{jobId}/` après TTL 2 h).
 *
 * Auth : Bearer CRON_SECRET (Vercel Cron) ou TRACKER_SYNC_SERVICE_TOKEN (ops).
 * Réponse : compteurs uniquement — pas de PHI / paths / UUIDs.
 */

import { NextResponse } from 'next/server'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  ASYNC_EXPORT_CLEANUP_DEFAULT_MAX_JOBS,
  ASYNC_EXPORT_CLEANUP_MAX_JOBS,
  cleanupExpiredAsyncExports,
} from '@/lib/imaging/dicom-export-async'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const log = new Logger('api/internal/imaging/cleanup-async-exports')

function parseMaxJobs(raw: string | null): number {
  if (!raw) return ASYNC_EXPORT_CLEANUP_DEFAULT_MAX_JOBS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return ASYNC_EXPORT_CLEANUP_DEFAULT_MAX_JOBS
  return Math.min(Math.max(1, n), ASYNC_EXPORT_CLEANUP_MAX_JOBS)
}

export async function GET(request: Request) {
  const cron = process.env.CRON_SECRET?.trim()
  const sync = process.env.TRACKER_SYNC_SERVICE_TOKEN?.trim()
  if (!cron && !sync) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!isValidBearer(request.headers.get('authorization'), cron, sync)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun =
    url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true'
  const maxJobs = parseMaxJobs(url.searchParams.get('maxJobs'))

  try {
    const supabase = createServiceRoleClient()
    const result = await cleanupExpiredAsyncExports(supabase, { dryRun, maxJobs })

    log.warn('async export cleanup done', {
      dryRun: result.dryRun,
      patientPrefixesScanned: result.patientPrefixesScanned,
      jobsScanned: result.jobsScanned,
      jobsExpired: result.jobsExpired,
      objectsDeleted: result.objectsDeleted,
      listErrors: result.listErrors,
      deleteErrors: result.deleteErrors,
      truncated: result.truncated,
    })

    const response = NextResponse.json(
      {
        status: 'ok',
        component: 'imaging-async-export-cleanup',
        ...result,
        docs: 'docs/ops/IMAGING_RUNBOOK.md#async-export-cleanup',
      },
      { status: 200 },
    )
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    log.error('async export cleanup failed', error)
    return NextResponse.json({ error: 'Cleanup Failed' }, { status: 500 })
  }
}
