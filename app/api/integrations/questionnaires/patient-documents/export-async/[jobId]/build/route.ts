/**
 * M2M Q → tracker : build une partie ZIP async.
 */

import { NextResponse } from 'next/server'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  buildAsyncExportPart,
  isValidAsyncExportJobId,
} from '@/lib/imaging/dicom-export-async'
import { loadPatientDicomExportRows } from '@/lib/imaging/dicom-export'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const log = new Logger('api/integrations/questionnaires/export-async/build')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parsePartIndex(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const expectedToken = process.env.TRACKER_RETURN_TOKEN?.trim()
    if (!expectedToken) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }
    if (!isValidBearer(request.headers.get('authorization'), expectedToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { jobId } = await params
    if (!isValidAsyncExportJobId(jobId)) {
      return NextResponse.json({ error: 'jobId invalid' }, { status: 400 })
    }

    const url = new URL(request.url)
    const trackerPatientId = url.searchParams.get('trackerPatientId')
    if (!trackerPatientId || !UUID_RE.test(trackerPatientId)) {
      return NextResponse.json({ error: 'trackerPatientId required' }, { status: 400 })
    }

    const partIndex = parsePartIndex(url.searchParams.get('part'))
    if (partIndex == null) {
      return NextResponse.json({ error: 'part required' }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const rows = await loadPatientDicomExportRows(service, trackerPatientId)
    const result = await buildAsyncExportPart(service, trackerPatientId, jobId, partIndex, rows)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
    }

    log.info('M2M async export build', {
      partIndex,
      partCount: result.partCount,
      completedParts: result.completedParts,
    })
    return NextResponse.json(result)
  } catch (error) {
    log.error('M2M async export build échoué', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
