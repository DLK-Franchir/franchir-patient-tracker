import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DbStatusCode } from '@/lib/constants'
import type { ActionId } from '@/lib/domain/patients/types'
import {
  sendNewPatientNotifications,
  sendStatusChangeNotifications,
  sendNewMessageNotifications,
} from '@/lib/notifications'

type SupabaseClient = Awaited<ReturnType<typeof createServerClient>>

export type CreatePatientInput = {
  patient_name: string
  clinical_summary?: string
  sharepoint_link?: string
  userId: string
  userFullName: string
  userRole: string
}

export type CreatePatientResult = {
  success: boolean
  patientId?: string
  error?: string
}

export async function commandCreatePatient(
  input: CreatePatientInput
): Promise<CreatePatientResult> {
  const supabase = await createServerClient()

  const { data: status } = await supabase
    .from('workflow_statuses')
    .select('id')
    .eq('code', 'prospect_created')
    .single()

  const { data: patient, error: insertError } = await supabase
    .from('patients')
    .insert({
      patient_name: input.patient_name,
      clinical_summary: input.clinical_summary,
      sharepoint_link: input.sharepoint_link,
      current_status_id: status?.id ?? null,
      created_by: input.userId,
    })
    .select()
    .single()

  if (insertError || !patient) {
    return { success: false, error: insertError?.message ?? 'Insert failed' }
  }

  await sendNewPatientNotifications(
    supabase,
    { id: input.userId, full_name: input.userFullName, role: input.userRole },
    { id: patient.id, patient_name: input.patient_name }
  )

  return { success: true, patientId: patient.id }
}

export type ChangeStatusInput = {
  patientId: string
  actionId: ActionId
  data?: Record<string, unknown>
  actorId: string
  actorFullName: string
  actorRole: string
  patientName: string
  currentStatusCode?: string
  quoteAccepted?: boolean
  dateAccepted?: boolean
}

type StatusChangeResult = {
  success: boolean
  error?: string
  updatedPatient?: {
    current_status?: { id: string; code: string; label: string; color: string }
    quote_accepted?: boolean
    date_accepted?: boolean
  }
}

const ACTION_STATUS_MAP: Partial<Record<ActionId, DbStatusCode>> = {
  submit_to_medical: 'medical_review',
  resubmit_to_medical: 'medical_review',
  approve_medical: 'validated_medical',
  request_more_info: 'need_info',
  reject_medical: 'rejected_medical',
  reopen_case: 'draft',
}

function isCommercialAction(actionId: ActionId): boolean {
  return ['confirm_quote', 'confirm_date', 'add_budget', 'propose_dates'].includes(actionId)
}

function buildMessage(
  actionId: ActionId,
  data?: Record<string, unknown>
): { title: string; body: string } {
  switch (actionId) {
    case 'submit_to_medical':
      return {
        title: 'Soumis à validation médicale',
        body: 'Le dossier a été soumis au Dr Dubois pour validation médicale.',
      }
    case 'resubmit_to_medical':
      return {
        title: 'Dossier complété et renvoyé pour validation',
        body:
          (data?.message as string) ||
          'Le dossier a été complété et renvoyé au Dr Dubois pour validation médicale.',
      }
    case 'approve_medical': {
      let body = (data?.message as string) || 'Le dossier a été validé médicalement.'
      if (data?.surgeons && Array.isArray(data.surgeons) && data.surgeons.length > 0) {
        body += `\n\nChirurgiens recommandés: ${(data.surgeons as string[]).join(', ')}`
      }
      return { title: 'Validé médicalement', body }
    }
    case 'request_more_info':
      return {
        title: 'Informations complémentaires demandées',
        body: (data?.message as string) || 'Des informations complémentaires sont nécessaires.',
      }
    case 'reject_medical':
      return {
        title: 'Refusé médicalement',
        body: (data?.justification as string) || 'Le dossier a été refusé médicalement.',
      }
    case 'confirm_quote':
      return { title: 'Devis confirmé', body: 'Le devis a été confirmé par Marcel.' }
    case 'confirm_date':
      return { title: 'Date confirmée', body: 'La date de chirurgie a été confirmée par Marcel.' }
    case 'reopen_case':
      return {
        title: 'Dossier réouvert',
        body: (data?.message as string) || 'Le dossier a été réouvert par un administrateur.',
      }
    case 'add_budget':
      return {
        title: 'Budget indicatif ajouté',
        body: `Budget indicatif: ${(data?.budget as string) || 'Non spécifié'}`,
      }
    case 'propose_dates':
      return {
        title: 'Dates proposées',
        body: `Dates proposées:\n${(data?.dates as string) || 'Non spécifié'}`,
      }
    default:
      return { title: 'Action effectuée', body: 'Action effectuée.' }
  }
}

export async function commandChangeStatus(input: ChangeStatusInput): Promise<StatusChangeResult> {
  const supabase = await createServerClient()
  const {
    patientId,
    actionId,
    data,
    actorId,
    actorFullName,
    actorRole,
    patientName,
    currentStatusCode,
    quoteAccepted = false,
    dateAccepted = false,
  } = input

  const updatedPatient: StatusChangeResult['updatedPatient'] = {}
  let newStatusCode: DbStatusCode | '' = ACTION_STATUS_MAP[actionId] ?? ''

  if (actionId === 'confirm_quote') {
    const { error } = await supabase
      .from('patients')
      .update({ quote_accepted: true })
      .eq('id', patientId)
    if (error) return { success: false, error: error.message }
    updatedPatient.quote_accepted = true
    if (dateAccepted) newStatusCode = 'surgery_scheduled'
  }

  if (actionId === 'confirm_date') {
    const { error } = await supabase
      .from('patients')
      .update({ date_accepted: true })
      .eq('id', patientId)
    if (error) return { success: false, error: error.message }
    updatedPatient.date_accepted = true
    if (quoteAccepted) newStatusCode = 'surgery_scheduled'
  }

  if (newStatusCode) {
    const { data: newStatus } = await supabase
      .from('workflow_statuses')
      .select('id, code, label, color')
      .eq('code', newStatusCode)
      .single()

    if (!newStatus) return { success: false, error: 'Statut introuvable' }

    const { error: updateError } = await supabase
      .from('patients')
      .update({ current_status_id: newStatus.id })
      .eq('id', patientId)

    if (updateError) return { success: false, error: updateError.message }
    updatedPatient.current_status = newStatus
  }

  const { title: messageTitle, body: messageBody } = buildMessage(actionId, data)

  const { error: messageError } = await supabase.from('patient_messages').insert({
    patient_id: patientId,
    author_id: actorId,
    author_name: actorFullName,
    author_role: actorRole,
    kind: newStatusCode ? 'status_change' : 'action',
    title: messageTitle,
    body: messageBody,
    topic: isCommercialAction(actionId) ? 'commercial' : 'medical',
    meta: newStatusCode
      ? { old_status: currentStatusCode, new_status: newStatusCode, action_id: actionId }
      : { action_id: actionId },
  })

  if (messageError) return { success: false, error: messageError.message }

  if (newStatusCode) {
    await sendStatusChangeNotifications(
      supabase,
      { id: actorId, role: actorRole },
      { id: patientId, patient_name: patientName },
      newStatusCode
    )
  }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/patient/${patientId}`)

  return { success: true, updatedPatient }
}

export type PostMessageInput = {
  patientId: string
  message: string
  topic?: 'medical' | 'commercial' | 'system'
  authorId: string
  authorName: string
  authorRole: string
  patientName: string
  supabase?: SupabaseClient
}

export async function commandPostMessage(
  input: PostMessageInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = input.supabase ?? (await createServerClient())

  const { error: insertError } = await supabase.from('patient_messages').insert({
    patient_id: input.patientId,
    author_id: input.authorId,
    author_name: input.authorName,
    author_role: input.authorRole,
    kind: 'message',
    body: input.message,
    topic: input.topic ?? 'medical',
  })

  if (insertError) return { success: false, error: insertError.message }

  await sendNewMessageNotifications(
    supabase,
    { id: input.authorId, full_name: input.authorName, role: input.authorRole },
    { id: input.patientId, patient_name: input.patientName }
  )

  return { success: true }
}

export type UpdateSummaryInput = {
  patientId: string
  clinical_summary?: string
  sharepoint_link?: string
}

export async function commandUpdateSummary(
  input: UpdateSummaryInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('patients')
    .update({
      clinical_summary: input.clinical_summary,
      sharepoint_link: input.sharepoint_link,
    })
    .eq('id', input.patientId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/patient/${input.patientId}`)
  return { success: true }
}

export type UpdateCommercialDataInput = {
  patientId: string
  quoteAmount?: number
  proposedDate?: string
}

export async function commandUpdateCommercialData(
  input: UpdateCommercialDataInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const updateData: Record<string, string | number | null> = {}
  if (input.quoteAmount !== undefined) updateData.quote_amount = input.quoteAmount
  if (input.proposedDate !== undefined) updateData.proposed_date = input.proposedDate

  if (Object.keys(updateData).length === 0) {
    return { success: true }
  }

  const { error } = await supabase.from('patients').update(updateData).eq('id', input.patientId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/patient/${input.patientId}`)
  return { success: true }
}
