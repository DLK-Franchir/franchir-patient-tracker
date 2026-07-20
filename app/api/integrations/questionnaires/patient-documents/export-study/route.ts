/**
 * M2M Q → tracker : stream ZIP étude DICOM (toutes séries image, hors DOC PDF).
 * Auth : Bearer TRACKER_RETURN_TOKEN.
 * Fatima-scale : `?part=N` après export-plan.
 */

import { NextResponse } from 'next/server'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  dicomZipResponseHeaders,
  downloadPatientDocumentBlob,
  loadPatientDicomExportRows,
  MAX_STUDY_EXPORT_FILES,
  planStudyExport,
  resolveStudyExportPart,
  streamDicomZip,
} from '@/lib/imaging/dicom-export'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const log = new Logger('api/integrations/questionnaires/export-study')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parsePartIndex(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

export async function GET(request: Request) {
  try {
    const expectedToken = process.env.TRACKER_RETURN_TOKEN?.trim()
    if (!expectedToken) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    if (!isValidBearer(request.headers.get('authorization'), expectedToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const trackerPatientId = url.searchParams.get('trackerPatientId')
    if (!trackerPatientId || !UUID_RE.test(trackerPatientId)) {
      return NextResponse.json({ error: 'trackerPatientId required' }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const rows = await loadPatientDicomExportRows(service, trackerPatientId)
    const plan = planStudyExport(rows)

    if ('error' in plan) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    const partParam = parsePartIndex(url.searchParams.get('part'))

    if (plan.mode === 'chunked' && partParam == null) {
      return NextResponse.json(
        {
          error: 'study_too_large',
          fileCount: plan.fileCount ?? null,
          maxFiles: MAX_STUDY_EXPORT_FILES,
          partCount: plan.partCount,
          hint: 'chunked_export',
        },
        { status: 413 },
      )
    }

    const partIndex = partParam ?? 0
    const resolved = resolveStudyExportPart(rows, partIndex)

    if ('error' in resolved) {
      if (resolved.error === 'part_out_of_range') {
        return NextResponse.json(
          { error: 'part_out_of_range', partCount: resolved.partCount ?? plan.partCount },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    log.info('M2M study export', {
      fileCount: resolved.fileCount,
      seriesCount: resolved.seriesCount,
      partIndex,
      partCount: plan.partCount,
      mode: plan.mode,
    })

    const stream = streamDicomZip(resolved.entries, (path) =>
      downloadPatientDocumentBlob(service, path),
    )

    const filename =
      plan.mode === 'chunked'
        ? `etude-dicom-part${partIndex + 1}of${plan.partCount}`
        : 'etude-dicom'

    return new Response(stream, {
      status: 200,
      headers: dicomZipResponseHeaders(filename),
    })
  } catch (error) {
    log.error('M2M export étude échoué', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
