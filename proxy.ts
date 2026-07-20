import { createServerClient } from '@supabase/ssr'
import { isStaffProfile } from '@/lib/access-control'
import {
  DWV_PUBLIC_PATH_PREFIXES,
  dwvWorkerRewriteTarget,
} from '@/lib/imaging/dwv-worker-rewrite'
import { NextResponse, type NextRequest } from 'next/server'

// Re-export pour les tests (lib/proxy.test.ts) — logique SoT package.
export { dwvWorkerRewriteTarget }

// `/api/integrations` = endpoints machine-à-machine (callback questionnaires →
// tracker) authentifiés par service-token, SANS session navigateur : ils ne
// doivent jamais être redirigés vers /login par le middleware d'auth.
// dwv + OpenJPEG : préfixes publics SoT `@franchir/imaging-viewer/worker-rewrite`.
// `/api/internal/bridge` = healthcheck pont M2M (Bearer sync/return token),
// `/api/internal/imaging` = ops Imaging (Bearer sync / CRON_SECRET) — cleanup
// async exports, telemetry-summary, backfill. Auth dans la route (fail-closed).
const PUBLIC_PATHS = [
  '/login',
  '/auth',
  '/api/integrations',
  '/api/internal/bridge',
  '/api/internal/imaging',
  ...DWV_PUBLIC_PATH_PREFIXES,
]

export async function updateSession(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({
      request,
    })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables')
      return supabaseResponse
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error('Auth error:', error.message)
    }

    const isPublicPath = PUBLIC_PATHS.some(path => request.nextUrl.pathname.startsWith(path))

    if (!user && !isPublicPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    if (user && !isPublicPath) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('id', user.id)
        .single()

      if (!isStaffProfile(profile)) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('error', 'unauthorized')
        return NextResponse.redirect(url)
      }
    }

    if (user && request.nextUrl.pathname === '/login') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, role')
        .eq('id', user.id)
        .single()

      if (isStaffProfile(profile)) {
        const redirect = request.nextUrl.searchParams.get('redirect')
        const url = request.nextUrl.clone()
        url.pathname = redirect || '/dashboard'
        url.searchParams.delete('redirect')
        return NextResponse.redirect(url)
      }
    }

    if (user && request.nextUrl.pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// Rewrite workers sous `/_next/.../assets/workers/*` → `/dwv-workers/*`
// (SoT : `@franchir/imaging-viewer/worker-rewrite`). next.config ne couvre pas `/_next/*`.
function rewriteDwvWorker(request: NextRequest): NextResponse | null {
  const target = dwvWorkerRewriteTarget(request.nextUrl.pathname)
  if (!target) return null
  const url = request.nextUrl.clone()
  url.pathname = target
  url.search = ''
  return NextResponse.rewrite(url)
}

export async function proxy(request: NextRequest) {
  const workerRewrite = rewriteDwvWorker(request)
  if (workerRewrite) return workerRewrite
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|dwv-workers|assets/workers|openjpeg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|map)$).*)',
    // Literal requis par Next (parse statique). Doit rester = DWV_NEXT_WORKER_MATCHER (SoT).
    '/_next/:path*/assets/workers/:file',
  ],
}
