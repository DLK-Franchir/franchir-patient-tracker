/**
 * P5 — Plan d'export étude (single vs multi-parties Fatima-scale).
 * Compteurs uniquement — pas de chemins Storage / UID bruts.
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertImagingExportAccess } from '@/lib/imaging/assert-imaging-export-access'
import { loadPatientDicomExportRows, planStudyExport } from '@/lib/imaging/dicom-export'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const log = new Logger('api/patients/imaging/study/export-plan')

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: patientId } = await params
  const access = await assertImagingExportAccess(patientId)
  if (access instanceof NextResponse) return access

  try {
    const service = createServiceRoleClient()
    const rows = await loadPatientDicomExportRows(service, patientId)
    const plan = planStudyExport(rows)

    if ('error' in plan) {
      return NextResponse.json({ error: 'Aucun DICOM image pour cette étude' }, { status: 404 })
    }

    return NextResponse.json(plan, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    log.error('Plan export étude échoué', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
