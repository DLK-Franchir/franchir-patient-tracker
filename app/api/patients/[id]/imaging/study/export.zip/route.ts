/**
 * P1 — ZIP étude (toutes séries image MR ; exclut PDF encapsulé DOC).
 * Si trop volumineux (ex. Fatima ~900+), 413 → exporter série par série (P0).
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertImagingExportAccess } from '@/lib/imaging/assert-imaging-export-access'
import {
  dicomZipResponseHeaders,
  downloadPatientDocumentBlob,
  loadPatientDicomExportRows,
  MAX_STUDY_EXPORT_FILES,
  resolveStudyExport,
  streamDicomZip,
} from '@/lib/imaging/dicom-export'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const log = new Logger('api/patients/imaging/study/export')

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
    const resolved = resolveStudyExport(rows)

    if ('error' in resolved) {
      if (resolved.error === 'too_large') {
        return NextResponse.json(
          {
            error: 'study_too_large',
            message:
              'Étude trop volumineuse pour un export sync. Téléchargez chaque série séparément.',
            fileCount: resolved.fileCount ?? null,
            maxFiles: MAX_STUDY_EXPORT_FILES,
            hint: 'series_export',
          },
          { status: 413 },
        )
      }
      return NextResponse.json({ error: 'Aucun DICOM image pour cette étude' }, { status: 404 })
    }

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
        title: 'Export DICOM étude',
        body: `Téléchargement ZIP de ${resolved.fileCount} coupe(s) sur ${resolved.seriesCount} série(s).`,
        topic: 'audit',
        meta: {
          action_id: 'dicom_study_export',
          file_count: resolved.fileCount,
          series_count: resolved.seriesCount,
          total_bytes: resolved.totalBytes,
          role: access.role,
        },
      },
      log,
      { action: 'dicom_study_export', fileCount: resolved.fileCount, seriesCount: resolved.seriesCount },
    )

    const stream = streamDicomZip(resolved.entries, (path) =>
      downloadPatientDocumentBlob(service, path),
    )

    return new Response(stream, {
      status: 200,
      headers: dicomZipResponseHeaders('etude-dicom'),
    })
  } catch (error) {
    log.error('Export étude DICOM échoué', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
