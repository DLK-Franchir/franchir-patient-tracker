/**
 * M2M Q → tracker : plan d'export étude (single vs chunked).
 * Auth : Bearer TRACKER_RETURN_TOKEN. Compteurs uniquement (pas de PHI).
 */

import { NextResponse } from 'next/server'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { loadPatientDicomExportRows, planStudyExport } from '@/lib/imaging/dicom-export'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const log = new Logger('api/integrations/questionnaires/export-plan')
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

    const trackerPatientId = new URL(request.url).searchParams.get('trackerPatientId')
    if (!trackerPatientId || !UUID_RE.test(trackerPatientId)) {
      return NextResponse.json({ error: 'trackerPatientId required' }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const rows = await loadPatientDicomExportRows(service, trackerPatientId)
    const plan = planStudyExport(rows)

    if ('error' in plan) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    log.info('M2M study export plan', {
      mode: plan.mode,
      partCount: plan.partCount,
      fileCount: plan.fileCount,
      seriesCount: plan.seriesCount,
    })

    return NextResponse.json(plan, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    log.error('M2M export-plan échoué', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
