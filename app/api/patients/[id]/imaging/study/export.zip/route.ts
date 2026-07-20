/**
 * P1/P5 — ZIP étude (toutes séries image MR ; exclut PDF encapsulé DOC).
 * Étude sous plafond → ZIP unique.
 * Fatima-scale → `?part=N` (0-index) après consultation de export-plan.
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertImagingExportAccess } from '@/lib/imaging/assert-imaging-export-access'
import {
  dicomZipResponseHeaders,
  downloadPatientDocumentBlob,
  loadPatientDicomExportRows,
  MAX_STUDY_EXPORT_FILES,
  planStudyExport,
  resolveStudyExportPart,
  streamDicomZip,
} from '@/lib/imaging/dicom-export'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const log = new Logger('api/patients/imaging/study/export')

function parsePartIndex(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

export async function GET(
  req: Request,
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

    const partParam = parsePartIndex(new URL(req.url).searchParams.get('part'))

    if (plan.mode === 'chunked' && partParam == null) {
      return NextResponse.json(
        {
          error: 'study_too_large',
          message:
            'Étude trop volumineuse pour un export unique. Utilisez le téléchargement par lots.',
          fileCount: plan.fileCount,
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
      return NextResponse.json({ error: 'Aucun DICOM image pour cette étude' }, { status: 404 })
    }

    const partLabel =
      plan.mode === 'chunked'
        ? `partie ${partIndex + 1}/${plan.partCount}`
        : 'étude'

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
        body: `Téléchargement ZIP de ${resolved.fileCount} coupe(s) sur ${resolved.seriesCount} série(s) (${partLabel}).`,
        topic: 'audit',
        meta: {
          action_id: 'dicom_study_export',
          file_count: resolved.fileCount,
          series_count: resolved.seriesCount,
          total_bytes: resolved.totalBytes,
          part_index: partIndex,
          part_count: plan.partCount,
          export_mode: plan.mode,
          role: access.role,
        },
      },
      log,
      {
        action: 'dicom_study_export',
        fileCount: resolved.fileCount,
        seriesCount: resolved.seriesCount,
        partIndex,
        partCount: plan.partCount,
      },
    )

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
    log.error('Export étude DICOM échoué', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
