import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { type ActionId } from '@/lib/workflow-v2'
import { Logger } from '@/lib/logger'
import { canUseWorkflow } from '@/lib/access-control'
import { sendStatusChangeNotifications, sendSurgeonAssignmentEmail } from '@/lib/notifications'

const log = new Logger('api/change-status')

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params
    const { actionId, data } = await req.json()

    const supabase = await createServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ data: profile }, { data: patient }] = await Promise.all([
      supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
      supabase.from('patients').select(`
        patient_name,
        quote_accepted,
        date_accepted,
        current_status:workflow_statuses!current_status_id (code, label)
      `).eq('id', patientId).single(),
    ])

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!canUseWorkflow(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

  const currentStatus = Array.isArray(patient.current_status)
    ? patient.current_status[0]
    : patient.current_status

  let messageBody = ''
  let newStatusCode = ''
  let messageTitle = ''
  const updatedPatient: {
    current_status?: { id: string; code: string; label: string; color: string }
    quote_accepted?: boolean
    date_accepted?: boolean
  } = {}

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
      // D6 : si un chirurgien réel (id annuaire) est fourni dès la validation,
      // on l'assigne directement (écrit assigned_surgeon_id → enrichissement
      // questionnaires via le webhook). L'assignation reste possible plus tard
      // via l'action dédiée `assign_surgeon`.
      if (data?.surgeonId) {
        const { data: approveSurgeon } = await supabase
          .from('surgeons')
          .select('id, full_name, email')
          .eq('id', data.surgeonId)
          .single()
        if (approveSurgeon) {
          const { error: assignError } = await supabase
            .from('patients')
            .update({ assigned_surgeon_id: approveSurgeon.id })
            .eq('id', patientId)
          if (assignError) {
            log.error('Erreur assignation chirurgien (approve_medical)', assignError)
            return NextResponse.json({ error: assignError.message }, { status: 500 })
          }
          messageBody += `\n\nChirurgien assigné : ${approveSurgeon.full_name}`
          await sendSurgeonAssignmentEmail(approveSurgeon, patient.patient_name)
        }
      }
      break

    case 'assign_surgeon': {
      // Étape 3 (D6) : écrit réellement assigned_surgeon_id. Le webhook UPDATE
      // rejoue alors l'Edge Function qui enrichit surgeon_email côté
      // questionnaires (le dossier devient visible du chirurgien assigné).
      const surgeonId = data?.surgeonId
      if (!surgeonId) {
        return NextResponse.json({ error: 'Chirurgien manquant' }, { status: 400 })
      }
      const { data: assignSurgeon } = await supabase
        .from('surgeons')
        .select('id, full_name, email')
        .eq('id', surgeonId)
        .single()
      if (!assignSurgeon) {
        return NextResponse.json({ error: 'Chirurgien introuvable' }, { status: 400 })
      }
      const { error: surgeonUpdateError } = await supabase
        .from('patients')
        .update({ assigned_surgeon_id: assignSurgeon.id })
        .eq('id', patientId)
      if (surgeonUpdateError) {
        log.error('Erreur assignation chirurgien', surgeonUpdateError)
        return NextResponse.json({ error: surgeonUpdateError.message }, { status: 500 })
      }
      await sendSurgeonAssignmentEmail(assignSurgeon, patient.patient_name)
      // Pas de changement de statut : le jeu de statuts de prod ne contient pas
      // de "sent_to_surgeon". L'assignation est enregistrée via assigned_surgeon_id
      // + message + email ; le dossier reste à son étape médicale courante.
      messageTitle = 'Chirurgien assigné'
      messageBody = `Chirurgien assigné : ${assignSurgeon.full_name}. Le dossier lui est transmis pour étude.`
      break
    }

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
      const { error: quoteUpdateError } = await supabase.from('patients').update({ quote_accepted: true }).eq('id', patientId)
      if (quoteUpdateError) {
        log.error('Erreur confirmation devis', quoteUpdateError)
        return NextResponse.json({ error: quoteUpdateError.message }, { status: 500 })
      }
      updatedPatient.quote_accepted = true
      if (patient.date_accepted) {
        newStatusCode = 'surgery_scheduled'
        messageTitle = 'Devis confirmé - Dossier programmé'
        messageBody = 'Le devis a été confirmé. Le dossier est maintenant programmé (devis et date confirmés).'
      }
      break

    case 'confirm_date':
      messageTitle = 'Date confirmée'
      messageBody = 'La date de chirurgie a été confirmée par Marcel.'
      const { error: dateUpdateError } = await supabase.from('patients').update({ date_accepted: true }).eq('id', patientId)
      if (dateUpdateError) {
        log.error('Erreur confirmation date', dateUpdateError)
        return NextResponse.json({ error: dateUpdateError.message }, { status: 500 })
      }
      updatedPatient.date_accepted = true
      if (patient.quote_accepted) {
        newStatusCode = 'surgery_scheduled'
        messageTitle = 'Date confirmée - Dossier programmé'
        messageBody = 'La date a été confirmée. Le dossier est maintenant programmé (devis et date confirmés).'
      }
      break

    case 'reopen_case':
      newStatusCode = 'prospect_created'
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
      .select('id, code, label, color')
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
      log.error('Erreur mise à jour patient', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    updatedPatient.current_status = newStatus
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
      meta: newStatusCode
        ? { old_status: currentStatus?.code, new_status: newStatusCode, action_id: actionId }
        : { action_id: actionId },
    })

    if (newStatusCode) {
      await sendStatusChangeNotifications(
        supabase,
        { id: user.id },
        { id: patientId, patient_name: patient.patient_name },
        newStatusCode
      )
    }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/patient/${patientId}`)

    log.info('Action completed', { actionId, newStatusCode: newStatusCode || 'no change' })

    return NextResponse.json({ success: true, patient: updatedPatient })
  } catch (error) {
    log.error('Erreur change-status', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
