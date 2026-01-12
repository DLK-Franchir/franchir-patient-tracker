import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { can, type Role } from '@/lib/permissions'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: patientId } = await params
  const { newStatusCode, medicalDecision } = await req.json()

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const userRole = profile.role as Role

  const isMedicalAction = ['validated_medical', 'rejected_medical', 'need_info'].includes(newStatusCode)
  if (isMedicalAction && !can(userRole, 'VALIDATE_MEDICAL')) {
    return NextResponse.json({ error: 'Forbidden: You cannot perform medical validation' }, { status: 403 })
  }

  const isQuoteAction = ['quote_issued', 'quote_accepted'].includes(newStatusCode)
  if (isQuoteAction && !can(userRole, 'EDIT_QUOTE')) {
    return NextResponse.json({ error: 'Forbidden: You cannot manage quotes' }, { status: 403 })
  }

  const isSurgeryAction = ['surgery_scheduled', 'surgery_done', 'completed'].includes(newStatusCode)
  if (isSurgeryAction && !can(userRole, 'SCHEDULE_SURGERY')) {
    return NextResponse.json({ error: 'Forbidden: You cannot manage surgery scheduling' }, { status: 403 })
  }

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      patient_name,
      workflow_statuses!current_status_id (code, label)
    `)
    .eq('id', patientId)
    .single()

  if (!patient || !patient.workflow_statuses) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const oldStatus = Array.isArray(patient.workflow_statuses)
    ? patient.workflow_statuses[0]
    : patient.workflow_statuses

  const { data: newStatus } = await supabase
    .from('workflow_statuses')
    .select('id, code, label')
    .eq('code', newStatusCode)
    .single()

  if (!newStatus) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('patients')
    .update({ current_status_id: newStatus.id })
    .eq('id', patientId)

  if (updateError) {
    console.error('❌ Erreur mise à jour patient:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const messageBody = medicalDecision || `Statut changé de "${oldStatus.label}" vers "${newStatus.label}"`

  await supabase.from('patient_messages').insert({
    patient_id: patientId,
    author_id: user.id,
    author_name: profile.full_name,
    author_role: profile.role,
    kind: 'status_change',
    title: `Statut: ${newStatus.label}`,
    body: messageBody,
    meta: {
      old_status: oldStatus.code,
      new_status: newStatusCode,
    },
  })

  if (medicalDecision && isMedicalAction) {
    const { error: decisionError } = await supabase.from('medical_decisions').insert({
      patient_id: patientId,
      decided_by: user.id,
      decision_type: newStatusCode === 'validated_medical' ? 'validated' : 'rejected',
      justification: medicalDecision,
    })

    if (decisionError) {
      console.error('❌ Erreur décision médicale:', decisionError)
    }
  }

  await createNotificationForStatusChange(supabase, patientId, newStatusCode, user.id, patient.patient_name)

  return NextResponse.json({ success: true })
}

async function createNotificationForStatusChange(
  supabase: any,
  patientId: string,
  newStatusCode: string,
  actorId: string,
  patientName: string
) {
  try {
    console.log('🔔 Creating notification for status:', newStatusCode)

    const notificationRules: Record<string, { roles: string[]; message: string }> = {
      medical_review: {
        roles: ['gilles'],
        message: `Le dossier de ${patientName} est prêt pour votre revue médicale.`,
      },
      validated_medical: {
        roles: ['marcel', 'franchir', 'admin'],
        message: `Le dossier de ${patientName} a été validé médicalement. Vous pouvez préparer le devis.`,
      },
      rejected_medical: {
        roles: ['marcel', 'franchir', 'admin'],
        message: `Le dossier de ${patientName} a été refusé médicalement.`,
      },
      need_info: {
        roles: ['marcel', 'franchir', 'admin'],
        message: `Des informations supplémentaires sont demandées pour ${patientName}.`,
      },
      quote_issued: {
        roles: ['gilles', 'admin'],
        message: `Un devis a été émis pour ${patientName}.`,
      },
      quote_accepted: {
        roles: ['marcel', 'franchir', 'gilles', 'admin'],
        message: `Le devis de ${patientName} a été accepté. Vous pouvez programmer la chirurgie.`,
      },
      surgery_scheduled: {
        roles: ['gilles', 'marcel', 'franchir', 'admin'],
        message: `La chirurgie de ${patientName} a été programmée.`,
      },
      surgery_done: {
        roles: ['gilles', 'marcel', 'franchir', 'admin'],
        message: `La chirurgie de ${patientName} a été effectuée.`,
      },
      completed: {
        roles: ['marcel', 'franchir', 'admin'],
        message: `Le dossier de ${patientName} est maintenant complet.`,
      },
    }

    const rule = notificationRules[newStatusCode]
    if (!rule) {
      console.log('🔔 No notification rule for status:', newStatusCode)
      return
    }

    console.log('🔔 Notification rule:', rule)

    const { data: targetUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .in('role', rule.roles)
      .neq('id', actorId)

    console.log('🔔 Target users:', targetUsers, 'Error:', usersError)

    if (!targetUsers || targetUsers.length === 0) {
      console.log('🔔 No target users found')
      return
    }

    const notifications = targetUsers.map((u: any) => ({
      user_id: u.id,
      patient_id: patientId,
      title: 'Nouveau statut patient',
      message: rule.message,
      type: 'info',
    }))

    console.log('🔔 Inserting notifications:', notifications)

    const { error: insertError } = await supabase.from('notifications').insert(notifications)

    if (insertError) {
      console.error('❌ Erreur insertion notifications:', insertError)
    } else {
      console.log('✅ Notifications créées avec succès')
    }
  } catch (error) {
    console.error('❌ Erreur création notification:', error)
  }
}
