/**
 * Backfill one-shot SeriesInstanceUID (et meta associées) pour un patient.
 * Auth : Bearer TRACKER_SYNC_SERVICE_TOKEN uniquement.
 *
 * Body JSON : { patientId, dryRun?, limit?, missingSeriesOnly? }
 * Réponse : compteurs uniquement (pas de noms de fichiers / UIDs).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  BACKFILL_DEFAULT_LIMIT,
  BACKFILL_MAX_LIMIT,
  backfillPatientDicomMetadata,
} from '@/lib/imaging/backfill-dicom-metadata'
import { Logger } from '@/lib/logger'

const log = new Logger('api/internal/imaging/backfill-dicom-metadata')

const bodySchema = z.object({
  patientId: z.string().uuid(),
  dryRun: z.boolean().optional(),
  limit: z.number().int().min(1).max(BACKFILL_MAX_LIMIT).optional(),
  missingSeriesOnly: z.boolean().optional(),
})

export async function POST(request: Request) {
  const sync = process.env.TRACKER_SYNC_SERVICE_TOKEN?.trim()
  if (!sync) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!isValidBearer(request.headers.get('authorization'), sync)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 })
  }

  try {
    const supabase = createServiceRoleClient()
    const result = await backfillPatientDicomMetadata(supabase, {
      patientId: parsed.data.patientId,
      dryRun: parsed.data.dryRun,
      limit: parsed.data.limit ?? BACKFILL_DEFAULT_LIMIT,
      missingSeriesOnly: parsed.data.missingSeriesOnly,
    })

    // Compteurs uniquement (pas de file names / UIDs / PHI).
    log.warn('backfill dicom metadata done', {
      dryRun: result.dryRun,
      scanned: result.scanned,
      parseOk: result.parseOk,
      parseFailed: result.parseFailed,
      updated: result.updated,
      skipped: result.skipped,
    })

    const response = NextResponse.json(result, { status: 200 })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    log.error('backfill failed', error)
    return NextResponse.json({ error: 'Backfill Failed' }, { status: 500 })
  }
}
