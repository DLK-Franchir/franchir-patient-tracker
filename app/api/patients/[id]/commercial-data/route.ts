import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canEditCommercialData, type StaffRole } from '@/lib/access-control'
import { denyIfArchivedPatientWrite } from '@/lib/patient-archive-guard'
import { denyIfOutOfRoleScope } from '@/lib/patient-role-scope-guard'
import { logPatientAction } from '@/lib/patient-messages/log-action'
import { buildCommercialDataEditMeta } from '@/lib/patient-messages/action-meta'
import { Logger } from '@/lib/logger'

const log = new Logger('api/patients/commercial-data')

const COMMERCIAL_FIELD_LABELS = {
  quote_amount: 'budget indicatif',
  proposed_date: 'date proposée',
} as const

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
      .select('role, email, full_name')
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

    const updateData: { quote_amount?: unknown; proposed_date?: unknown } = {}
    if (quoteAmount !== undefined) {
      updateData.quote_amount = quoteAmount
    }
    if (proposedDate !== undefined) {
      updateData.proposed_date = proposedDate
    }

    // État AVANT update pour tracer les anciennes valeurs dans le journal.
    const { data: previous } = await supabase
      .from('patients')
      .select('quote_amount, proposed_date')
      .eq('id', patientId)
      .maybeSingle()

    const { error } = await supabase
      .from('patients')
      .update(updateData)
      .eq('id', patientId)

    if (error) {
      console.error('Error updating commercial data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const edit = buildCommercialDataEditMeta(
      { quote_amount: previous?.quote_amount, proposed_date: previous?.proposed_date },
      { quote_amount: quoteAmount, proposed_date: proposedDate },
    )
    if (edit) {
      await logPatientAction(
        supabase,
        {
          patientId,
          author: { id: user.id, full_name: profile.full_name, role: profile.role },
          kind: 'action',
          title: 'Données commerciales modifiées',
          body: `Champs modifiés : ${edit.fieldsChanged
            .map((field) => COMMERCIAL_FIELD_LABELS[field])
            .join(', ')}.`,
          topic: 'commercial',
          meta: edit.meta,
        },
        log,
        { action: 'edit_commercial_data' },
      )
    }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/patient/${patientId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in commercial-data API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}