import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import type { DbStatusCode } from '@/lib/constants'
import { globalStatusFromWorkflowStatus } from '@/lib/workflow-v2'
import { apiError, createRouteHandler, RouteContext } from '@/lib/api/route-handler'
import { canPerformWorkflowActionResult, canUseWorkflowResult } from '@/lib/access-control'
import { sendStatusChangeNotifications } from '@/lib/notifications'
import { StatusChangeSchema } from '@/lib/validations'

export const POST = createRouteHandler(
  'api/change-status',
  async (req: Request, { params }: RouteContext<{ id: string }>) => {
    const { id: patientId } = await params
    const payloadResult = StatusChangeSchema.safeParse(await req.json())
    if (!payloadResult.success) {
      apiError(400, payloadResult.error.issues[0]?.message ?? 'Payload invalide')
    }

    const { actionId, data } = payloadResult.data
    const workflowActionId = actionId

    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      apiError(401, 'Unauthorized')
    }

    const [{ data: profile }, { data: patient }] = await Promise.all([
      supabase.from('profiles').select('role, full_name, email').eq('id', user.id).single(),
      supabase
        .from('patients')
        .select(
          `
        patient_name,
        quote_accepted,
        date_accepted,
        current_status:workflow_statuses!current_status_id (id, code, label)
      `
        )
        .eq('id', patientId)
        .single(),
    ])

    if (!profile) {
      apiError(404, 'Profile not found')
    }

    const workflowAccess = canUseWorkflowResult(profile)
    if (!workflowAccess.allowed) {
      apiError(403, workflowAccess.reason ?? 'Forbidden')
    }

    if (!patient) {
      apiError(404, 'Patient not found')
    }

    const currentStatus = Array.isArray(patient.current_status)
      ? patient.current_status[0]
      : patient.current_status
    const globalStatus = globalStatusFromWorkflowStatus(currentStatus)

    const actionAccess = canPerformWorkflowActionResult({
      profile,
      actionId: workflowActionId,
      globalStatus,
      quoteAccepted: patient.quote_accepted,
      dateAccepted: patient.date_accepted,
    })

    if (!actionAccess.allowed) {
      apiError(403, actionAccess.reason ?? 'Forbidden')
    }

    let messageBody = ''
    let newStatusCode: DbStatusCode | '' = ''
    let messageTitle = ''
    const updatedPatient: {
      current_status?: { id: string; code: string; label: string; color: string }
      quote_accepted?: boolean
      date_accepted?: boolean
    } = {}

    switch (workflowActionId) {
      case 'submit_to_medical':
        newStatusCode = 'medical_review'
        messageTitle = 'Soumis à validation médicale'
        messageBody = 'Le dossier a été soumis au Dr Dubois pour validation médicale.'
        break

      case 'resubmit_to_medical':
        newStatusCode = 'medical_review'
        messageTitle = 'Dossier complété et renvoyé pour validation'
        messageBody =
          data?.message ||
          'Le dossier a été complété et renvoyé au Dr Dubois pour validation médicale.'
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

      case 'confirm_quote': {
        messageTitle = 'Devis confirmé'
        messageBody = 'Le devis a été confirmé par Marcel.'
        const { error: quoteUpdateError } = await supabase
          .from('patients')
          .update({ quote_accepted: true })
          .eq('id', patientId)
        if (quoteUpdateError) {
          apiError(500, quoteUpdateError.message)
        }
        updatedPatient.quote_accepted = true
        if (patient.date_accepted) {
          newStatusCode = 'surgery_scheduled'
          messageTitle = 'Devis confirmé - Dossier programmé'
          messageBody =
            'Le devis a été confirmé. Le dossier est maintenant programmé (devis et date confirmés).'
        }
        break
      }

      case 'confirm_date': {
        messageTitle = 'Date confirmée'
        messageBody = 'La date de chirurgie a été confirmée par Marcel.'
        const { error: dateUpdateError } = await supabase
          .from('patients')
          .update({ date_accepted: true })
          .eq('id', patientId)
        if (dateUpdateError) {
          apiError(500, dateUpdateError.message)
        }
        updatedPatient.date_accepted = true
        if (patient.quote_accepted) {
          newStatusCode = 'surgery_scheduled'
          messageTitle = 'Date confirmée - Dossier programmé'
          messageBody =
            'La date a été confirmée. Le dossier est maintenant programmé (devis et date confirmés).'
        }
        break
      }

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
        apiError(400, 'Invalid action')
    }

    if (newStatusCode) {
      const { data: newStatus } = await supabase
        .from('workflow_statuses')
        .select('id, code, label, color')
        .eq('code', newStatusCode)
        .single()

      if (!newStatus) {
        apiError(400, 'Invalid status')
      }

      const { error: updateError } = await supabase
        .from('patients')
        .update({ current_status_id: newStatus.id })
        .eq('id', patientId)

      if (updateError) {
        apiError(500, updateError.message)
      }

      updatedPatient.current_status = newStatus
    }

    const { error: messageError } = await supabase.from('patient_messages').insert({
      patient_id: patientId,
      author_id: user.id,
      author_name: profile.full_name,
      author_role: profile.role,
      kind: newStatusCode ? 'status_change' : 'action',
      title: messageTitle,
      body: messageBody,
      topic:
        workflowActionId.includes('quote') ||
        workflowActionId.includes('date') ||
        workflowActionId.includes('budget') ||
        workflowActionId.includes('propose')
          ? 'commercial'
          : 'medical',
      meta: newStatusCode
        ? {
            old_status: currentStatus?.code,
            new_status: newStatusCode,
            action_id: workflowActionId,
          }
        : { action_id: workflowActionId },
    })

    if (messageError) {
      apiError(500, messageError.message)
    }

    if (newStatusCode) {
      await sendStatusChangeNotifications(
        supabase,
        { id: user.id, role: profile.role },
        { id: patientId, patient_name: patient.patient_name },
        newStatusCode
      )
    }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/patient/${patientId}`)

    return NextResponse.json({ success: true, patient: updatedPatient })
  }
)