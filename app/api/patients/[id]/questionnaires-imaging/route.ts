/**
 * Proxy cockpit → pont questionnaires : liste l'imagerie déposée par le patient
 * (bucket patient-images, Item C). Réservé aux utilisateurs authentifiés du tracker.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isStaffProfile } from '@/lib/access-control'
import { fetchQuestionnairePatientImages } from '@/lib/integrations/fetch-questionnaire-imaging'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params
  if (!UUID_RE.test(patientId)) {
    return NextResponse.json({ error: 'Identifiant patient invalide' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (!isStaffProfile(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const files = await fetchQuestionnairePatientImages(patientId)
  if (files === null) {
    return NextResponse.json({ error: 'Pont questionnaires non configuré' }, { status: 503 })
  }

  const response = NextResponse.json({ files })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
