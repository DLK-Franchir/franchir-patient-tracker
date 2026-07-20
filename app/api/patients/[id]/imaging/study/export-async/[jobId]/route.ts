/**
 * P7 — statut job async + URLs signées (TTL) des parties prêtes.
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertImagingExportAccess } from '@/lib/imaging/assert-imaging-export-access'
import {
  getAsyncExportJobPublic,
  isValidAsyncExportJobId,
} from '@/lib/imaging/dicom-export-async'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const log = new Logger('api/patients/imaging/study/export-async/status')

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: patientId, jobId } = await params
  const access = await assertImagingExportAccess(patientId)
  if (access instanceof NextResponse) return access

  if (!isValidAsyncExportJobId(jobId)) {
    return NextResponse.json({ error: 'jobId invalide' }, { status: 400 })
  }

  try {
    const service = createServiceRoleClient()
    const result = await getAsyncExportJobPublic(service, patientId, jobId, {
      includeSignedUrls: true,
    })
    if ('error' in result) {
      const status = result.error === 'expired' ? 410 : 404
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json(result)
  } catch (error) {
    log.error('Lecture job export async échouée', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
