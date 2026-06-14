/**
 * Pont questionnaires → tracker : liste des documents patient (DICOM + PDF/images)
 * pour le portail clinicien quand le forward vers `patient-images` n'a pas abouti.
 *
 * Auth machine-à-machine : `Authorization: Bearer <TRACKER_RETURN_TOKEN>`
 * (miroir du callback session-status).
 */

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { listPatientDocuments } from '@/lib/documents/list-patient-documents'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidBearer(authorization: string | null, expected: string): boolean {
  if (!authorization) return false
  const [scheme, token] = authorization.trim().split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) return false
  const received = Buffer.from(token)
  const expectedBuf = Buffer.from(expected)
  if (received.length !== expectedBuf.length) return false
  return timingSafeEqual(received, expectedBuf)
}

export async function GET(request: Request) {
  try {
    const expectedToken = process.env.TRACKER_RETURN_TOKEN?.trim()
    if (!expectedToken) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    if (!isValidBearer(request.headers.get('authorization'), expectedToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const trackerPatientId = new URL(request.url).searchParams.get('trackerPatientId')
    if (!trackerPatientId || !UUID_RE.test(trackerPatientId)) {
      return NextResponse.json({ error: 'trackerPatientId required' }, { status: 400 })
    }

    const service = createServiceRoleClient()
    const documents = await listPatientDocuments(service, trackerPatientId)

    const response = NextResponse.json({
      documents: documents.map((doc) => ({
        fileName: doc.fileName,
        url: doc.url,
        renderType: doc.renderType,
        sizeBytes: doc.sizeBytes,
      })),
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('[integrations/questionnaires/patient-documents] GET failed', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
