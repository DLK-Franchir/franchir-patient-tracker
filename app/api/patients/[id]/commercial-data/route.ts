import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canEditCommercialData } from '@/lib/access-control'
import { apiError, createRouteHandler, RouteContext } from '@/lib/api/route-handler'

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (!canEditCommercialData(profile)) {
      apiError(403, 'Forbidden')
    }

    const { id: patientId } = await params
    const { quoteAmount, proposedDate } = await request.json()
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
