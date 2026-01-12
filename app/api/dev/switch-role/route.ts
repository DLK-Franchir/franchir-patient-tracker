import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { role } = await req.json()
    console.log('[DEV] Switching role to:', role)

    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      console.log('[DEV] No user found')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('[DEV] User ID:', user.id)

    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id)
      .select()

    if (error) {
      console.error('[DEV] Error updating role:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[DEV] Role updated successfully:', data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[DEV] Exception:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
