/**
 * Healthcheck pont tracker (P0) — présence tokens + dossiers `sent` bloqués.
 * Auth : Bearer TRACKER_SYNC_SERVICE_TOKEN ou TRACKER_RETURN_TOKEN.
 *
 * Contrat aligné avec questionnaires `/api/internal/bridge/health` :
 *   status: healthy | degraded | unconfigured
 *   bridge: { syncConfigured, returnConfigured, apiBaseConfigured, callbackConfigured? }
 *   stuckSent?: { thresholdHours, count, queryFailed, clock }
 *
 * Horloge stuck : `questionnaire_sent_at` (pas `updated_at` — faux négatifs).
 */

import { NextResponse } from 'next/server'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const STUCK_SENT_HOURS = 24

export async function GET(request: Request) {
  const sync = process.env.TRACKER_SYNC_SERVICE_TOKEN?.trim()
  const ret = process.env.TRACKER_RETURN_TOKEN?.trim()
  const hasAnyToken = Boolean(sync || ret)

  if (!hasAnyToken) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!isValidBearer(request.headers.get('authorization'), sync, ret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncConfigured = Boolean(sync)
  const returnConfigured = Boolean(ret)
  const apiBaseConfigured = Boolean(
    process.env.QUESTIONNAIRES_API_BASE?.trim() ||
      process.env.QUESTIONNAIRES_PORTAL_URL?.trim(),
  )

  let stuckSentCount: number | null = null
  let queryFailed = false

  try {
    const supabase = createServiceRoleClient()
    const cutoff = new Date(Date.now() - STUCK_SENT_HOURS * 60 * 60 * 1000).toISOString()
    const { count, error } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('questionnaire_status', 'sent')
      .lt('questionnaire_sent_at', cutoff)

    if (error) {
      queryFailed = true
    } else {
      stuckSentCount = count ?? 0
    }
  } catch {
    queryFailed = true
  }

  const envOk = syncConfigured && returnConfigured && apiBaseConfigured
  const status = !envOk
    ? 'unconfigured'
    : queryFailed || (stuckSentCount !== null && stuckSentCount > 0)
      ? 'degraded'
      : 'healthy'

  const response = NextResponse.json(
    {
      status,
      bridge: {
        syncConfigured,
        returnConfigured,
        apiBaseConfigured,
        /** Alias pour parité smoke avec questionnaires (`callbackConfigured`). */
        callbackConfigured: returnConfigured,
      },
      stuckSent: {
        thresholdHours: STUCK_SENT_HOURS,
        count: stuckSentCount,
        queryFailed,
        clock: 'questionnaire_sent_at',
      },
      generatedAt: new Date().toISOString(),
    },
    { status: 200 },
  )
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Component-Status', status)
  return response
}
