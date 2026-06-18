import { createServerClient } from '@/lib/supabase/server'
import { canAssignSurgeon } from '@/lib/access-control'
import { globalStatusFromWorkflowStatus, isMedicallyValidated } from '@/lib/workflow-v2'
import { syncPatientToQuestionnaires } from '@/lib/integrations/questionnaire-portal'
import { sendSurgeonAssignmentEmail } from '@/lib/notifications'
import { Logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

const log = new Logger('api/assign-surgeon')

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: patientId } = await params
    const { surgeonId } = await req.json()

    if (!surgeonId || typeof surgeonId !== 'string') {
      return NextResponse.json({ error: 'Chirurgien manquant' }, { status: 400 })
    }

    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ data: profile }, { data: patient }] = await Promise.all([
      supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
      supabase.from('patients').select(`
        id,
        patient_name,
        assigned_surgeon_id,
        current_status:workflow_statuses!current_status_id (id, code, label)
      `).eq('id', patientId).single(),
    ])

    if (!canAssignSurgeon(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const currentStatus = Array.isArray(patient.current_status)
      ? patient.current_status[0]
      : patient.current_status
    const globalStatus = globalStatusFromWorkflowStatus(currentStatus)

    if (!isMedicallyValidated(globalStatus)) {
      return NextResponse.json(
        { error: 'Assignation chirurgien disponible uniquement après validation médicale' },
        { status: 403 },
      )
    }

    const { data: surgeon } = await supabase
      .from('surgeons')
      .select('id, full_name, email')
      .eq('id', surgeonId)
      .eq('is_active', true)
      .single()

    if (!surgeon) {
      return NextResponse.json({ error: 'Chirurgien introuvable' }, { status: 400 })
    }

    if (!surgeon.email) {
      return NextResponse.json(
        { error: 'Ce chirurgien n\'a pas d\'email renseigné dans l\'annuaire' },
        { status: 400 },
      )
    }

    const previousSurgeonId = patient.assigned_surgeon_id

    const { error: updateError } = await supabase
      .from('patients')
      .update({ assigned_surgeon_id: surgeon.id })
      .eq('id', patientId)

    if (updateError) {
      log.error('Erreur assignation chirurgien', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabase.from('patient_messages').insert({
      patient_id: patientId,
      author_id: user.id,
      author_name: profile?.full_name,
      author_role: profile?.role,
      kind: 'action',
      title: 'Chirurgien responsable assigné',
      body: `Chirurgien responsable : ${surgeon.full_name}. Le dossier est transmis pour étude côté questionnaires.`,
      topic: 'medical',
      meta: { action_id: 'assign_surgeon', surgeon_id: surgeon.id },
    })

    if (previousSurgeonId !== surgeon.id) {
      await sendSurgeonAssignmentEmail(surgeon, patient.patient_name)
    }

    // Rattrapage si le webhook UPDATE → sync-patient-to-questionnaires a échoué.
    await syncPatientToQuestionnaires(patientId)

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/patient/${patientId}`)

    return NextResponse.json({
      success: true,
      assignedSurgeon: {
        id: surgeon.id,
        full_name: surgeon.full_name,
        email: surgeon.email,
      },
    })
  } catch (error) {
    log.error('Erreur assign-surgeon', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
