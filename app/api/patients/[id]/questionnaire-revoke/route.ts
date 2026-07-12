/**
 * Révocation du lien questionnaire actif d'un patient, pilotée depuis le
 * cockpit tracker (délègue à l'app questionnaires via service-token).
 * Réservé au staff gestionnaire (marcel / franchir / admin).
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { canManagePatientDocuments, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import { revokeQuestionnaireLink } from '@/lib/integrations/questionnaire-portal'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (!canManagePatientDocuments(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const archivedDeny = await denyIfArchivedPatientWrite(
    supabase,
    patientId,
    profile.role as StaffRole,
  )
  if (archivedDeny) return archivedDeny

  if (!process.env.TRACKER_SYNC_SERVICE_TOKEN) {
    return NextResponse.json({ error: 'Pont questionnaires non configuré' }, { status: 503 })
  }

  const ok = await revokeQuestionnaireLink(patientId)
  if (!ok) {
    return NextResponse.json({ error: 'Échec de la révocation' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
