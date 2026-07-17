/**
 * Pont questionnaires → tracker : liste des documents patient (DICOM + PDF/images)
 * pour le portail clinicien quand le forward vers `patient-images` n'a pas abouti.
 *
 * Auth machine-à-machine : `Authorization: Bearer <TRACKER_RETURN_TOKEN>`
 * (miroir du callback session-status).
 */

import { NextResponse } from 'next/server'
import { listPatientDocuments } from '@/lib/documents/list-patient-documents'
import { toQuestionnairesImagingDocument } from '@/lib/integrations/questionnaires-imaging-document'
import { isValidBearer } from '@/lib/security/service-bearer'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
      documents: documents
        .map((doc) => toQuestionnairesImagingDocument(doc))
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null),
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('[integrations/questionnaires/patient-documents] GET failed', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
