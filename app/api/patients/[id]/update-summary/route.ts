import { createServerClient } from '@/lib/supabase/server'
import { canEditPatientSummaryResult } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { apiError, createRouteHandler, RouteContext } from '@/lib/api/route-handler'
import { globalStatusFromWorkflowStatus } from '@/lib/workflow-v2'
import { PatientSummaryUpdateSchema } from '@/lib/validations'

export const PATCH = createRouteHandler(
  'api/update-summary',
  async (req: Request, { params }: RouteContext<{ id: string }>) => {
    const { id: patientId } = await params
    const payloadResult = PatientSummaryUpdateSchema.safeParse(await req.json())
    if (!payloadResult.success) {
      apiError(400, payloadResult.error.issues[0]?.message ?? 'Payload invalide')
    }

    const { clinical_summary, sharepoint_link } = payloadResult.data

    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      apiError(401, 'Unauthorized')
    }

    const [{ data: profile }, { data: patientStatusRow }] = await Promise.all([
      supabase.from('profiles').select('role, email').eq('id', user.id).single(),
      supabase
        .from('patients')
        .select('current_status:workflow_statuses!current_status_id (id, code, label)')
        .eq('id', patientId)
        .single(),
    ])

    if (!patientStatusRow) {
      apiError(404, 'Patient not found')
    }

    const currentStatus = Array.isArray(patientStatusRow.current_status)
      ? patientStatusRow.current_status[0]
      : patientStatusRow.current_status
    const globalStatus = globalStatusFromWorkflowStatus(currentStatus)

    const summaryPermission = canEditPatientSummaryResult(profile, globalStatus)
    if (!summaryPermission.allowed) {
      apiError(403, summaryPermission.reason ?? 'Forbidden')
    }

    const { error } = await supabase
      .from('patients')
      .update({
        clinical_summary,
        sharepoint_link,
      })
      .eq('id', patientId)

    if (error) {
      apiError(500, error.message)
    }

    return NextResponse.json({ success: true })
  }
)
