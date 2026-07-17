import { createServerClient } from '@supabase/ssr'
import { isStaffProfile } from '@/lib/access-control'
import { NextResponse, type NextRequest } from 'next/server'

// `/api/integrations` = endpoints machine-à-machine (callback questionnaires →
// tracker) authentifiés par service-token, SANS session navigateur : ils ne
// doivent jamais être redirigés vers /login par le middleware d'auth.
// dwv charge ses codec workers depuis /assets/workers/* (rewrite → /dwv-workers/*).
// Ces fichiers doivent être publics : sinon le middleware redirige vers /login et
// les DICOM JPEG Lossless (DICOMOBJ) ne se décodent pas.
// `/api/internal/bridge` = healthcheck pont M2M (Bearer sync/return token),
// sans session navigateur — même fail-closed que `/api/integrations`.
const PUBLIC_PATHS = [
  '/login',
  '/auth',
  '/api/integrations',
  '/api/internal/bridge',
  '/dwv-workers',
  '/assets/workers',
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

// dwv 0.36 charge ses codec workers via `new Worker(new URL("./"+i.u(557), i.b))`
// où `i.b` = import.meta.url du chunk dwv, c.-à-d. `/_next/static/chunks/…`. L'URL
// résolue est donc `/_next/static/chunks/assets/workers/jpeg2000.worker.min.js`.
// Les rewrites de next.config NE s'appliquent PAS sous `/_next/*` → le worker
// renvoyait 404, le décodage JPEG 2000 échouait en silence et le canvas restait
// noir. Le middleware, lui, peut réécrire les chemins `/_next/*` : on aiguille
// toute requête `.../assets/workers/<fichier>` vers les workers vendored publics.
const WORKER_PATH_RE = /\/assets\/workers\/([^/]+)$/

/** Mappe un chemin de worker dwv (`.../assets/workers/<fichier>`) vers le worker
 *  vendored public, ou `null` si le chemin n'en est pas un. Pur → testable. */
export function dwvWorkerRewriteTarget(pathname: string): string | null {
  const match = pathname.match(WORKER_PATH_RE)
  if (!match) return null
  return `/dwv-workers/${match[1]}`
}

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
    '/((?!_next/static|_next/image|favicon.ico|dwv-workers|assets/workers|.*\\.(?:svg|png|jpg|jpeg|gif|webp|js|map)$).*)',
    // dwv réclame ses workers sous `/_next/static/chunks/assets/workers/*` :
    // ce matcher additionnel laisse le middleware les réécrire (cf. ci-dessus).
    '/_next/:path*/assets/workers/:file',
  ],
}
