/**
 * M2M Q → tracker : stream ZIP série DICOM (SoT patient_documents).
 * Auth : Bearer TRACKER_RETURN_TOKEN (miroir listing patient-documents).
 */

import { NextResponse } from 'next/server'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  dicomZipResponseHeaders,
  downloadPatientDocumentBlob,
  loadPatientDicomExportRows,
  resolveSeriesExport,
  streamDicomZip,
} from '@/lib/imaging/dicom-export'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const log = new Logger('api/integrations/questionnaires/export-series')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    const seriesUid = url.searchParams.get('seriesUid')
    if (!trackerPatientId || !UUID_RE.test(trackerPatientId)) {
      return NextResponse.json({ error: 'trackerPatientId required' }, { status: 400 })
    }
    if (!seriesUid?.trim()) {
      return NextResponse.json({ error: 'seriesUid required' }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const rows = await loadPatientDicomExportRows(service, trackerPatientId)
    const resolved = resolveSeriesExport(rows, seriesUid)

    if ('error' in resolved) {
      if (resolved.error === 'too_large') {
        return NextResponse.json(
          { error: 'series_too_large', fileCount: resolved.fileCount ?? null },
          { status: 413 },
        )
      }
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    log.info('M2M series export', {
      fileCount: resolved.fileCount,
      seriesUidHash: resolved.seriesUidHash,
    })

    const stream = streamDicomZip(resolved.entries, (path) =>
      downloadPatientDocumentBlob(service, path),
    )

    return new Response(stream, {
      status: 200,
      headers: dicomZipResponseHeaders('serie-dicom'),
    })
  } catch (error) {
    log.error('M2M export série échoué', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
