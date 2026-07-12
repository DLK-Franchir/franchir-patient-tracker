import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canEditCommercialData, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (!profile || !canEditCommercialData(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: patientId } = await params

    const scopeDeny = await denyIfOutOfRoleScope(
      supabase,
      patientId,
      profile.role as StaffRole,
    )
    if (scopeDeny) return scopeDeny

    const archivedDeny = await denyIfArchivedPatientWrite(
      supabase,
      patientId,
      profile.role as StaffRole,
    )
    if (archivedDeny) return archivedDeny

    const body = await request.json()
    const { quoteAmount, proposedDate } = body

    const updateData: any = {}
    if (quoteAmount !== undefined) {
      updateData.quote_amount = quoteAmount
    }
    if (proposedDate !== undefined) {
      updateData.proposed_date = proposedDate
    }

    const { error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', patientId)

    if (error) {
      console.error('Error updating commercial data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/patient/${patientId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in commercial-data API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}