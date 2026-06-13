/**
 * ============================================================================
 * RÉCEPTEUR DU CALLBACK « QUESTIONNAIRE COMPLÉTÉ » — questionnaires → tracker
 * (T4, Décision D3 — Option A).
 *
 * Miroir EXACT (fail-closed) du pont entrant côté questionnaires. L'app
 * questionnaires POST ici à la complétion d'une session neuro ; on pose un
 * sous-état + un résumé sur la fiche patient pour que Gilles/Erik le voient
 * DANS le tracker. Sens distinct (complétion → statut), PAS une boucle.
 *
 * DOUBLE VERROU :
 *   1. configuration requise — `TRACKER_RETURN_TOKEN` doit être positionné,
 *      sinon 404 (la route « n'existe pas » tant que le retour n'est pas
 *      provisionné) ;
 *   2. `Authorization: Bearer <TRACKER_RETURN_TOKEN>` (comparaison à temps
 *      constant), sinon 401.
 *
 * L'écriture passe par le client service-role APRÈS le verrou (aucune session
 * navigateur). NE change PAS le code workflow (reste medical_review) — c'est un
 * sous-état dédié (D7).
 * ============================================================================
 */

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { Logger } from '@/lib/logger'

const log = new Logger('api/integrations/questionnaires/session-status')

function isValidBearer(authorization: string | null, expected: string): boolean {
  if (!authorization) return false
  const [scheme, token] = authorization.trim().split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) return false
  const received = Buffer.from(token)
  const expectedBuf = Buffer.from(expected)
  if (received.length !== expectedBuf.length) return false
  return timingSafeEqual(received, expectedBuf)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  try {
    // Verrou 1 : retour non provisionné → 404 (fail closed).
    const expectedToken = process.env.TRACKER_RETURN_TOKEN?.trim()
    if (!expectedToken) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    // Verrou 2 : service-token machine-à-machine.
    if (!isValidBearer(req.headers.get('authorization'), expectedToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const trackerPatientId = body?.trackerPatientId
    const event = body?.event
    const completedAt = body?.completedAt
    const summary = body?.summary

    if (!trackerPatientId || typeof trackerPatientId !== 'string' || !UUID_RE.test(trackerPatientId)) {
      return NextResponse.json({ error: 'Bad Request: trackerPatientId' }, { status: 400 })
    }
    if (event !== 'questionnaire_completed') {
      return NextResponse.json({ error: 'Bad Request: event' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Corrélation par patients.id = trackerPatientId. Sous-état uniquement :
    // le code workflow (medical_review) n'est pas touché (D7).
    const { data: updated, error } = await supabase
      .from('patients')
      .update({
        questionnaire_status: 'completed',
        questionnaire_completed_at:
          typeof completedAt === 'string' ? completedAt : new Date().toISOString(),
        questionnaire_summary: typeof summary === 'string' ? summary : null,
      })
      .eq('id', trackerPatientId)
      .select('id')
      .maybeSingle()

    if (error) {
      log.error('Erreur mise à jour statut questionnaire', error)
      return NextResponse.json({ error: 'Update Failed' }, { status: 502 })
    }

    if (!updated) {
      // Patient inconnu côté tracker : on répond 404 (l'émetteur loggue, pas de
      // rejeu automatique en V1.5).
      return NextResponse.json({ error: 'Patient Not Found' }, { status: 404 })
    }

    const response = NextResponse.json({ ok: true, patientId: updated.id }, { status: 200 })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    log.error('Erreur callback session-status', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
