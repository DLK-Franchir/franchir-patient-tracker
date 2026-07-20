/**
 * M2M Q → tracker : crée un job export étude async (Bearer TRACKER_RETURN_TOKEN).
 */

import { NextResponse } from 'next/server'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  createAsyncExportJobRecord,
  persistNewAsyncExportJob,
} from '@/lib/imaging/dicom-export-async'
import { loadPatientDicomExportRows } from '@/lib/imaging/dicom-export'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const log = new Logger('api/integrations/questionnaires/export-async')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
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
    const created = createAsyncExportJobRecord(trackerPatientId, rows)
    if ('error' in created) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    const pub = await persistNewAsyncExportJob(service, trackerPatientId, created)
    log.info('M2M async export created', {
      fileCount: pub.fileCount,
      partCount: pub.partCount,
    })
    return NextResponse.json(pub, { status: 201 })
  } catch (error) {
    log.error('M2M async export create échoué', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
