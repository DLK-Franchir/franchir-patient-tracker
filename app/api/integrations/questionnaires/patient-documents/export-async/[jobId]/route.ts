/**
 * M2M Q → tracker : statut job async + signed URLs.
 */

import { NextResponse } from 'next/server'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  getAsyncExportJobPublic,
  isValidAsyncExportJobId,
} from '@/lib/imaging/dicom-export-async'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const log = new Logger('api/integrations/questionnaires/export-async/status')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
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

    const service = createServiceRoleClient()
    const result = await getAsyncExportJobPublic(service, trackerPatientId, jobId, {
      includeSignedUrls: true,
    })
    if ('error' in result) {
      const status = result.error === 'expired' ? 410 : 404
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json(result)
  } catch (error) {
    log.error('M2M async export status échoué', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
