/**
 * P7 — crée un job d'export étude durable (ZIP → Storage).
 * Auth / audit = sync export.
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertImagingExportAccess } from '@/lib/imaging/assert-imaging-export-access'
import {
  createAsyncExportJobRecord,
  persistNewAsyncExportJob,
} from '@/lib/imaging/dicom-export-async'
import { loadPatientDicomExportRows } from '@/lib/imaging/dicom-export'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const log = new Logger('api/patients/imaging/study/export-async')

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: patientId } = await params
  const access = await assertImagingExportAccess(patientId)
  if (access instanceof NextResponse) return access

  try {
    const service = createServiceRoleClient()
    const rows = await loadPatientDicomExportRows(service, patientId)
    const created = createAsyncExportJobRecord(patientId, rows)
    if ('error' in created) {
      return NextResponse.json({ error: 'Aucun DICOM image pour cette étude' }, { status: 404 })
    }

    const pub = await persistNewAsyncExportJob(service, patientId, created)

    await logPatientAction(
      access.supabase,
      {
        patientId,
        author: {
          id: access.userId,
          full_name: access.fullName,
          role: access.role,
        },
        kind: 'action',
        title: 'Export DICOM étude (async)',
        body: `Préparation ZIP durable : ${pub.fileCount} coupe(s), ${pub.partCount} partie(s).`,
        topic: 'audit',
        meta: {
          action_id: 'dicom_study_export_async_create',
          file_count: pub.fileCount,
          series_count: pub.seriesCount,
          part_count: pub.partCount,
          total_bytes: pub.totalBytes,
          role: access.role,
        },
      },
      log,
      {
        action: 'dicom_study_export_async_create',
        fileCount: pub.fileCount,
        partCount: pub.partCount,
      },
    )

    return NextResponse.json(pub, { status: 201 })
  } catch (error) {
    log.error('Création job export async échouée', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
