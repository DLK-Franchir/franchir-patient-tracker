import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { apiError, createRouteHandler, RouteContext } from '@/lib/api/route-handler'
import { z } from 'zod'

const SurgeryDateSchema = z.object({
  confirmed_surgery_date: z.string().min(1, 'Date requise'),
  confirmed_surgeon_name: z.string().optional(),
})

export const PATCH = createRouteHandler(
  'api/surgery-date',
  async (req: Request, { params }: RouteContext<{ id: string }>) => {
    const { id: patientId } = await params
    const body = SurgeryDateSchema.safeParse(await req.json())
    if (!body.success) {
      apiError(400, body.error.issues[0]?.message ?? 'Payload invalide')
    }

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      apiError(401, 'Unauthorized')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      apiError(403, 'Réservé aux administrateurs')
    }

    const { error } = await supabase
      .from('patients')
      .update({
        confirmed_surgery_date: body.data!.confirmed_surgery_date,
        confirmed_surgeon_name: body.data!.confirmed_surgeon_name ?? null,
      })
      .eq('id', patientId)

    if (error) {
      apiError(500, error.message)
    }

    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/patient/${patientId}`)

    return NextResponse.json({ success: true })
  }
)
