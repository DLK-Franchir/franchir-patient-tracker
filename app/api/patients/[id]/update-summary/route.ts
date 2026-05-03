import { createServerClient } from '@/lib/supabase/server'
import { canEditPatientSummary } from '@/lib/access-control'
import { NextResponse } from 'next/server'
import { apiError, createRouteHandler, RouteContext } from '@/lib/api/route-handler'

export const PATCH = createRouteHandler(
  'api/update-summary',
  async (req: Request, { params }: RouteContext<{ id: string }>) => {
    const { id: patientId } = await params
    const { clinical_summary, sharepoint_link } = await req.json()

    const supabase = await createServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      apiError(401, 'Unauthorized')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (!canEditPatientSummary(profile)) {
      apiError(403, 'Forbidden')
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
