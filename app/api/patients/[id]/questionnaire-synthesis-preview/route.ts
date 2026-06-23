/**
 * Proxy cockpit → pont questionnaires : apercu JSON synthese Anamneze.
 * Staff authentifie uniquement.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isStaffProfile } from '@/lib/access-control'
import { fetchQuestionnaireSynthesisPreview } from '@/lib/integrations/fetch-questionnaire-synthesis-preview'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const sessionId = new URL(req.url).searchParams.get('sessionId') ?? undefined
  if (sessionId && !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Identifiant session invalide' }, { status: 400 })
  }

  const result = await fetchQuestionnaireSynthesisPreview(patientId, sessionId)
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  return NextResponse.json(result.preview, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
