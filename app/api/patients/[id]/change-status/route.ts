import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { type ActionId } from '@/lib/workflow-v2'
import { Resend } from 'resend'
import { EMAIL_FROM, getEmailForProfile } from '@/lib/email-config'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.franchir.eu'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: patientId } = await params
  const { actionId, data } = await req.json()

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

  const { data: patient } = await supabase
    .from('patients')
    .select(`
      patient_name,
      quote_accepted,
      date_accepted,
      current_status:workflow_statuses!current_status_id (code, label)
    `)
    .eq('id', patientId)
    .single()

  if (!patient) {
    return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
  }

  const currentStatus = Array.isArray(patient.current_status)
    ? patient.current_status[0]
    : patient.current_status

  let messageBody = ''
  let newStatusCode = ''
  let messageTitle = ''

  switch (actionId as ActionId) {
    case 'submit_to_medical':
      newStatusCode = 'medical_review'
      messageTitle = 'Soumis à validation médicale'
      messageBody = 'Le dossier a été soumis au Dr Dubois pour validation médicale.'
      break

    case 'resubmit_to_medical':
      newStatusCode = 'medical_review'
      messageTitle = 'Dossier complété et renvoyé pour validation'
      messageBody = data?.message || 'Le dossier a été complété et renvoyé au Dr Dubois pour validation médicale.'
      break

    case 'approve_medical':
      newStatusCode = 'validated_medical'
      messageTitle = 'Validé médicalement'
      messageBody = data?.message || 'Le dossier a été validé médicalement.'
      if (data?.surgeons && data.surgeons.length > 0) {
        messageBody += `\n\nChirurgiens recommandés: ${data.surgeons.join(', ')}`
      }
      break

    case 'request_more_info':
      newStatusCode = 'need_info'
      messageTitle = 'Informations complémentaires demandées'
      messageBody = data?.message || 'Des informations complémentaires sont nécessaires.'
      break

    case 'reject_medical':
      newStatusCode = 'rejected_medical'
      messageTitle = 'Refusé médicalement'
      messageBody = data?.justification || 'Le dossier a été refusé médicalement.'
      break

    case 'confirm_quote':
      messageTitle = 'Devis confirmé'
      messageBody = 'Le devis a été confirmé par Marcel.'
      await supabase
        .from('patients')
        .update({ quote_accepted: true })
        .eq('id', patientId)

      if (patient.date_accepted) {
        newStatusCode = 'surgery_scheduled'
        messageTitle = 'Devis confirmé - Dossier programmé'
        messageBody = 'Le devis a été confirmé. Le dossier est maintenant programmé (devis et date confirmés).'
      }
      break

    case 'confirm_date':
      messageTitle = 'Date confirmée'
      messageBody = 'La date de chirurgie a été confirmée par Marcel.'
      await supabase
        .from('patients')
        .update({ date_accepted: true })
        .eq('id', patientId)

      if (patient.quote_accepted) {
        newStatusCode = 'surgery_scheduled'
        messageTitle = 'Date confirmée - Dossier programmé'
        messageBody = 'La date a été confirmée. Le dossier est maintenant programmé (devis et date confirmés).'
      }
      break

    case 'reopen_case':
      newStatusCode = 'draft'
      messageTitle = 'Dossier réouvert'
      messageBody = data?.message || 'Le dossier a été réouvert par un administrateur.'
      break

    case 'add_budget':
      messageTitle = 'Budget indicatif ajouté'
      messageBody = `Budget indicatif: ${data?.budget || 'Non spécifié'}`
      break

    case 'propose_dates':
      messageTitle = 'Dates proposées'
      messageBody = `Dates proposées:\n${data?.dates || 'Non spécifié'}`
      break

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (newStatusCode) {
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
  }

  await supabase.from('patient_messages').insert({
    patient_id: patientId,
    author_id: user.id,
    author_name: profile.full_name,
    author_role: profile.role,
    kind: newStatusCode ? 'status_change' : 'action',
    title: messageTitle,
    body: messageBody,
    topic: actionId.includes('quote') || actionId.includes('date') || actionId.includes('budget') || actionId.includes('propose') ? 'commercial' : 'medical',
    meta: newStatusCode ? {
      old_status: currentStatus?.code,
      new_status: newStatusCode,
      action_id: actionId,
    } : {
      action_id: actionId,
    },
  })

  if (newStatusCode) {
    await createNotificationForStatusChange(supabase, patientId, newStatusCode, user.id, patient.patient_name)
  }

  // Forcer le refresh de la page patient
  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/patient/${patientId}`)

  console.log('✅ [CHANGE-STATUS] Action completed:', actionId, '- New status:', newStatusCode || 'no change')

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
      surgery_scheduled: {
        roles: ['gilles', 'marcel', 'franchir', 'admin'],
        message: `La chirurgie de ${patientName} a été programmée.`,
      },
      draft: {
        roles: ['marcel', 'franchir', 'admin'],
        message: `Le dossier de ${patientName} a été réouvert.`,
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
      .select('id, role, full_name, email')
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

    const patientLink = `${APP_URL}/dashboard/patient/${patientId}`

    const emailPromises = targetUsers
      .map((u: any) => ({ ...u, realEmail: getEmailForProfile(u) }))
      .filter((u: any) => u.realEmail)
      .map((u: any) =>
        resend.emails.send({
          from: EMAIL_FROM,
          to: u.realEmail,
          subject: `Mise à jour dossier — ${patientName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563EB;">Mise à jour du dossier patient</h2>
              <p>Bonjour ${u.full_name},</p>
              <p>${rule.message}</p>
              <a href="${patientLink}" style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
                Voir le dossier
              </a>
              <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">FRANCHIR — Suivi des dossiers patients</p>
            </div>
          `,
        })
      )

    await Promise.allSettled(emailPromises)
  } catch (error) {
    console.error('❌ Erreur création notification:', error)
  }
}