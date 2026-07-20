/**
 * P0 — ZIP des coupes DICOM brutes de la série ouverte (Horos / RadiAnt / OsiriX).
 * Stream serveur depuis Storage (service-role) — pas de mint N URLs signées au client.
 */

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { assertImagingExportAccess } from '@/lib/imaging/assert-imaging-export-access'
import {
  dicomZipResponseHeaders,
  downloadPatientDocumentBlob,
  loadPatientDicomExportRows,
  resolveSeriesExport,
  streamDicomZip,
} from '@/lib/imaging/dicom-export'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import { Logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const log = new Logger('api/patients/imaging/series/export')

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; seriesUid: string }> },
) {
  const { id: patientId, seriesUid } = await params
  const access = await assertImagingExportAccess(patientId)
  if (access instanceof NextResponse) return access

  if (!seriesUid?.trim()) {
    return NextResponse.json({ error: 'seriesUid requis' }, { status: 400 })
  }

  try {
    const service = createServiceRoleClient()
    const rows = await loadPatientDicomExportRows(service, patientId)
    const resolved = resolveSeriesExport(rows, seriesUid)

    if ('error' in resolved) {
      if (resolved.error === 'too_large') {
        return NextResponse.json(
          {
            error: 'series_too_large',
            message: 'Série trop volumineuse pour un export sync. Contactez le support.',
            fileCount: resolved.fileCount ?? null,
          },
          { status: 413 },
        )
      }
      if (resolved.error === 'empty') {
        return NextResponse.json({ error: 'Aucun DICOM pour ce patient' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Série introuvable' }, { status: 404 })
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
        title: 'Export DICOM série',
        body: `Téléchargement ZIP de ${resolved.fileCount} coupe(s) DICOM (série).`,
        topic: 'audit',
        meta: {
          action_id: 'dicom_series_export',
          file_count: resolved.fileCount,
          series_count: 1,
          series_uid_hash: resolved.seriesUidHash,
          total_bytes: resolved.totalBytes,
          role: access.role,
        },
      },
      log,
      { action: 'dicom_series_export', fileCount: resolved.fileCount },
    )

    const stream = streamDicomZip(resolved.entries, (path) =>
      downloadPatientDocumentBlob(service, path),
    )

    return new Response(stream, {
      status: 200,
      headers: dicomZipResponseHeaders('serie-dicom'),
    })
  } catch (error) {
    log.error('Export série DICOM échoué', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
