import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'
import { type ActionId, canPerformWorkflowAction, globalStatusFromWorkflowStatus } from '@/lib/workflow-v2'
import { Logger } from '@/lib/logger'
import { canUseWorkflow, type StaffRole } from '@/lib/access-control'
import {
  sendCommercialActionNotifications,
  sendStatusChangeNotifications,
  sendSurgeonAssignmentEmail,
} from '@/lib/notifications'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import type { SupabaseClient } from '@supabase/supabase-js'

const log = new Logger('api/change-status')

function getWriteClient(role: StaffRole, sessionClient: SupabaseClient): SupabaseClient {
  if (role === 'gilles') {
    return createServiceRoleClient()
  }
  return sessionClient
}

function parseQuoteAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const text = String(raw).replace(/\s/g, '')
  const match = text.match(/[\d]+(?:[.,]\d+)?/)
  if (!match) return null
  const value = parseFloat(match[0].replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Normalise un nom pour rapprochement fuzzy sur full_name. */
function normalizeSurgeonName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

/** Legacy API : data.surgeons (noms) → UUID annuaire si surgeonIds absent. */
async function resolveSurgeonIdsFromNames(
  writeClient: SupabaseClient,
  names: unknown[],
): Promise<string[]> {
  const { data: activeSurgeons } = await writeClient
    .from('surgeons')
    .select('id, full_name')
    .eq('is_active', true)

  if (!activeSurgeons?.length) return []

  const ids: string[] = []
  for (const raw of names) {
    const needle = normalizeSurgeonName(String(raw))
    if (!needle) continue
    const match = activeSurgeons.find((surgeon) => {
      const haystack = normalizeSurgeonName(surgeon.full_name)
      return haystack === needle || haystack.includes(needle) || needle.includes(haystack)
    })
    if (match && !ids.includes(match.id)) {
      ids.push(match.id)
    }
  }
  return ids
}

function parseFirstProposedDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const parts = raw.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean)
  for (const part of parts) {
    const parsed = new Date(part)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }
  return null
}

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
        current_status:workflow_statuses!current_status_id (id, code, label)
      `).eq('id', patientId).single(),
    ])

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!canUseWorkflow(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const role = profile.role as StaffRole

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const currentStatus = Array.isArray(patient.current_status)
      ? patient.current_status[0]
      : patient.current_status
    const globalStatus = globalStatusFromWorkflowStatus(currentStatus)

    if (!canPerformWorkflowAction(role, actionId as ActionId, globalStatus)) {
      return NextResponse.json({ error: 'Action non autorisée pour ce rôle' }, { status: 403 })
    }

    const writeClient = getWriteClient(role, supabase)

  let messageBody = ''
  let newStatusCode = ''
  let messageTitle = ''
  const updatedPatient: {
    current_status?: { id: string; code: string; label: string; color: string }
    quote_accepted?: boolean
    date_accepted?: boolean
    quote_amount?: number | null
    proposed_date?: string | null
    assigned_surgeon?: { id: string; full_name: string; email?: string | null } | null
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

    case 'approve_medical': {
      // API contract : préférer data.surgeonIds (UUID[]). Legacy : data.surgeons (full_name[]).
      newStatusCode = 'validated_medical'
      messageTitle = 'Validé médicalement'
      messageBody = data?.message || 'Le dossier a été validé médicalement.'

      let recommendedIds: string[] = Array.isArray(data?.surgeonIds) ? data.surgeonIds : []
      if (recommendedIds.length === 0 && Array.isArray(data?.surgeons)) {
        recommendedIds = await resolveSurgeonIdsFromNames(writeClient, data.surgeons)
      }
      if (recommendedIds.length === 0) {
        return NextResponse.json(
          { error: 'Au moins un chirurgien recommandé est requis' },
          { status: 400 },
        )
      }
      if (recommendedIds.length > 2) {
        return NextResponse.json(
          { error: 'Maximum 2 chirurgiens recommandés' },
          { status: 400 },
        )
      }

      const { data: recommendedSurgeons } = await writeClient
        .from('surgeons')
        .select('id, full_name')
        .in('id', recommendedIds)
        .eq('is_active', true)

      if (!recommendedSurgeons || recommendedSurgeons.length !== recommendedIds.length) {
        return NextResponse.json(
          { error: 'Chirurgien(s) recommandé(s) invalide(s)' },
          { status: 400 },
        )
      }

      messageBody += `\n\nChirurgiens recommandés: ${recommendedSurgeons.map((s) => s.full_name).join(', ')}`
      if (data?.surgeonId) {
        const { data: approveSurgeon } = await writeClient
          .from('surgeons')
          .select('id, full_name, email')
          .eq('id', data.surgeonId)
          .single()
        if (approveSurgeon) {
          const { error: assignError } = await writeClient
            .from('patients')
            .update({ assigned_surgeon_id: approveSurgeon.id })
            .eq('id', patientId)
          if (assignError) {
            log.error('Erreur assignation chirurgien (approve_medical)', assignError)
            return NextResponse.json({ error: assignError.message }, { status: 500 })
          }
          messageBody += `\n\nChirurgien assigné : ${approveSurgeon.full_name}`
          updatedPatient.assigned_surgeon = approveSurgeon
          await sendSurgeonAssignmentEmail(approveSurgeon, patient.patient_name)
        }
      }
      break
    }

    case 'assign_surgeon': {
      const surgeonId = data?.surgeonId
      if (!surgeonId) {
        return NextResponse.json({ error: 'Chirurgien manquant' }, { status: 400 })
      }
      const { data: assignSurgeon } = await writeClient
        .from('surgeons')
        .select('id, full_name, email')
        .eq('id', surgeonId)
        .single()
      if (!assignSurgeon) {
        return NextResponse.json({ error: 'Chirurgien introuvable' }, { status: 400 })
      }
      const { error: surgeonUpdateError } = await writeClient
        .from('patients')
        .update({ assigned_surgeon_id: assignSurgeon.id })
        .eq('id', patientId)
      if (surgeonUpdateError) {
        log.error('Erreur assignation chirurgien', surgeonUpdateError)
        return NextResponse.json({ error: surgeonUpdateError.message }, { status: 500 })
      }
      await sendSurgeonAssignmentEmail(assignSurgeon, patient.patient_name)
      messageTitle = 'Chirurgien assigné'
      messageBody = `Chirurgien assigné : ${assignSurgeon.full_name}. Le dossier lui est transmis pour étude.`
      updatedPatient.assigned_surgeon = assignSurgeon
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
      {
        const { error: quoteUpdateError } = await writeClient
          .from('patients')
          .update({ quote_accepted: true })
          .eq('id', patientId)
        if (quoteUpdateError) {
          log.error('Erreur confirmation devis', quoteUpdateError)
          return NextResponse.json({ error: quoteUpdateError.message }, { status: 500 })
        }
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
      {
        const { error: dateUpdateError } = await writeClient
          .from('patients')
          .update({ date_accepted: true })
          .eq('id', patientId)
        if (dateUpdateError) {
          log.error('Erreur confirmation date', dateUpdateError)
          return NextResponse.json({ error: dateUpdateError.message }, { status: 500 })
        }
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

    case 'close_case':
      newStatusCode = 'case_closed'
      messageTitle = 'Dossier fermé'
      messageBody =
        data?.message ||
        'Le dossier a été fermé. L\'historique est conservé ; aucune action workflow en attente.'
      break

    case 'add_budget': {
      messageTitle = 'Budget indicatif ajouté'
      messageBody = `Budget indicatif: ${data?.budget || 'Non spécifié'}`
      const quoteAmount = parseQuoteAmount(data?.budget)
      if (quoteAmount !== null) {
        const { error: budgetError } = await writeClient
          .from('patients')
          .update({ quote_amount: quoteAmount })
          .eq('id', patientId)
        if (budgetError) {
          log.error('Erreur enregistrement budget', budgetError)
          return NextResponse.json({ error: budgetError.message }, { status: 500 })
        }
        updatedPatient.quote_amount = quoteAmount
      }
      break
    }

    case 'propose_dates': {
      messageTitle = 'Dates proposées'
      messageBody = `Dates proposées:\n${data?.dates || 'Non spécifié'}`
      const proposedDate = parseFirstProposedDate(data?.dates)
      if (proposedDate) {
        const { error: dateError } = await writeClient
          .from('patients')
          .update({ proposed_date: proposedDate })
          .eq('id', patientId)
        if (dateError) {
          log.error('Erreur enregistrement date proposée', dateError)
          return NextResponse.json({ error: dateError.message }, { status: 500 })
        }
        updatedPatient.proposed_date = proposedDate
      }
      break
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (newStatusCode) {
    const { data: newStatus } = await writeClient
      .from('workflow_statuses')
      .select('id, code, label, color')
      .eq('code', newStatusCode)
      .single()

    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { error: updateError } = await writeClient
      .from('patients')
      .update({ current_status_id: newStatus.id })
      .eq('id', patientId)

    if (updateError) {
      log.error('Erreur mise à jour patient', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    updatedPatient.current_status = newStatus
  }

    await logPatientAction(
      supabase,
      {
        patientId,
        author: { id: user.id, full_name: profile.full_name, role: profile.role },
        kind: newStatusCode ? 'status_change' : 'action',
        title: messageTitle,
        body: messageBody,
        topic:
          actionId.includes('quote') ||
          actionId.includes('date') ||
          actionId.includes('budget') ||
          actionId.includes('propose')
            ? 'commercial'
            : 'medical',
        meta: newStatusCode
          ? { old_status: currentStatus?.code, new_status: newStatusCode, action_id: actionId }
          : { action_id: actionId },
      },
      log,
      { actionId },
    )

    if (newStatusCode) {
      await sendStatusChangeNotifications(
        supabase,
        { id: user.id },
        { id: patientId, patient_name: patient.patient_name },
        newStatusCode
      )
    } else if (
      actionId === 'add_budget' ||
      actionId === 'confirm_quote' ||
      actionId === 'propose_dates'
    ) {
      await sendCommercialActionNotifications(
        supabase,
        { id: user.id },
        { id: patientId, patient_name: patient.patient_name },
        actionId as 'add_budget' | 'confirm_quote' | 'propose_dates',
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
