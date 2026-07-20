/**
 * P8 — résumé contrat télémétrie Imaging (non-PHI).
 * Auth : Bearer TRACKER_SYNC_SERVICE_TOKEN ou TRACKER_RETURN_TOKEN.
 *
 * Pas d’agrégats live GA/Plausible, pas d’identifiants patient — uniquement
 * le contrat machine-readable + flags config analytics.
 */

import { NextResponse } from 'next/server'
import { buildImagingTelemetryContractSummary } from '@franchir/imaging-viewer'
import { isValidBearer } from '@/lib/security/service-bearer'

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

  const contract = buildImagingTelemetryContractSummary()
  const gaConfigured = Boolean(process.env.NEXT_PUBLIC_GA_ID?.trim())
  const plausibleConfigured = Boolean(
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() ||
      process.env.NEXT_PUBLIC_PLAUSIBLE_HOST?.trim(),
  )

  const response = NextResponse.json(
    {
      status: 'ok',
      component: 'imaging-telemetry',
      contract,
      analytics: {
        gaConfigured,
        plausibleConfigured,
        /** Au moins un forwarder client attendu en prod. */
        forwarderConfigured: gaConfigured || plausibleConfigured,
      },
      docs: 'docs/ops/IMAGING_TELEMETRY.md',
      generatedAt: new Date().toISOString(),
    },
    { status: 200 },
  )
  response.headers.set('Cache-Control', 'no-store')
  return response
}
