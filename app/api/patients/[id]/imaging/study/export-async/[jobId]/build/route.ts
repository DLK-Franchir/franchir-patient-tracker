/**
 * P7 — matérialise une partie ZIP vers Storage (une requête = une partie).
 * Client-driven : boucle part=0…N-1 puis GET status pour signed URLs.
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertImagingExportAccess } from '@/lib/imaging/assert-imaging-export-access'
import {
  buildAsyncExportPart,
  isValidAsyncExportJobId,
} from '@/lib/imaging/dicom-export-async'
import { loadPatientDicomExportRows } from '@/lib/imaging/dicom-export'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const log = new Logger('api/patients/imaging/study/export-async/build')

function parsePartIndex(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: patientId, jobId } = await params
  const access = await assertImagingExportAccess(patientId)
  if (access instanceof NextResponse) return access

  if (!isValidAsyncExportJobId(jobId)) {
    return NextResponse.json({ error: 'jobId invalide' }, { status: 400 })
  }

  const url = new URL(req.url)
  let partIndex = parsePartIndex(url.searchParams.get('part'))
  if (partIndex == null) {
    try {
      const body = (await req.json().catch(() => null)) as { partIndex?: number } | null
      if (body && Number.isInteger(body.partIndex) && (body.partIndex as number) >= 0) {
        partIndex = body.partIndex as number
      }
    } catch {
      /* ignore */
    }
  }
  if (partIndex == null) {
    return NextResponse.json({ error: 'partIndex requis' }, { status: 400 })
  }

  try {
    const service = createServiceRoleClient()
    const rows = await loadPatientDicomExportRows(service, patientId)
    const result = await buildAsyncExportPart(service, patientId, jobId, partIndex, rows)

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status ?? 500 },
      )
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
        title: 'Export DICOM étude (async build)',
        body: `Partie ${partIndex + 1}/${result.partCount} matérialisée (${result.completedParts}/${result.partCount}).`,
        topic: 'audit',
        meta: {
          action_id: 'dicom_study_export_async_build',
          part_index: partIndex,
          part_count: result.partCount,
          completed_parts: result.completedParts,
          file_count: result.fileCount,
          role: access.role,
        },
      },
      log,
      {
        action: 'dicom_study_export_async_build',
        partIndex,
        partCount: result.partCount,
        completedParts: result.completedParts,
      },
    )

    return NextResponse.json(result)
  } catch (error) {
    log.error('Build partie export async échoué', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
