import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canEditCommercialDataResult } from '@/lib/access-control'
import { apiError, createRouteHandler, RouteContext } from '@/lib/api/route-handler'
import { globalStatusFromWorkflowStatus } from '@/lib/workflow-v2'
import { CommercialDataUpdateSchema } from '@/lib/validations'

export const PATCH = createRouteHandler(
  'api/commercial-data',
  async (request: NextRequest, { params }: RouteContext<{ id: string }>) => {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      apiError(401, 'Unauthorized')
    }

    const { id: patientId } = await params

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

    const commercialPermission = canEditCommercialDataResult(profile, globalStatus)
    if (!commercialPermission.allowed) {
      apiError(403, commercialPermission.reason ?? 'Forbidden')
    }

    const payloadResult = CommercialDataUpdateSchema.safeParse(await request.json())
    if (!payloadResult.success) {
      apiError(400, payloadResult.error.issues[0]?.message ?? 'Payload invalide')
    }

    const { quoteAmount, proposedDate } = payloadResult.data
    const updateData: Record<string, string | number | null> = {}

    if (quoteAmount !== undefined) {
      updateData.quote_amount = quoteAmount
    }

    if (proposedDate !== undefined) {
      updateData.proposed_date = proposedDate
    }

    const { error } = await supabase.from('patients').update(updateData).eq('id', patientId)

    if (error) {
      apiError(500, error.message)
    }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/patient/${patientId}`)

    return NextResponse.json({ success: true })
  }
)
