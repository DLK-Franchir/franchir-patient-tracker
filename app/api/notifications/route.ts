import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canUseWorkflow } from '@/lib/access-control'
import { Logger } from '@/lib/logger'

const log = new Logger('api/notifications')

const STALE_DAYS = 30

/** Marque comme lues les notifications non lues de plus de 30 jours. */
async function markStaleAsRead(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - STALE_DAYS)

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .lt('created_at', cutoff.toISOString())
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !canUseWorkflow(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await markStaleAsRead(supabase, user.id)

    const [{ count }, { data: notifications }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    return NextResponse.json({
      unreadCount: count ?? 0,
      notifications: notifications ?? [],
    })
  } catch (error) {
    log.error('GET notifications failed', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !canUseWorkflow(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id, markAll } = body as { id?: string; markAll?: boolean }

    if (markAll) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) {
        log.error('markAll failed', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, unreadCount: 0 })
    }

    if (!id) {
      return NextResponse.json({ error: 'id ou markAll requis' }, { status: 400 })
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      log.error('mark read failed', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    return NextResponse.json({ success: true, unreadCount: count ?? 0 })
  } catch (error) {
    log.error('PATCH notifications failed', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
