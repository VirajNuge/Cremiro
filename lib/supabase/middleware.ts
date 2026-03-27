import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Build a new response that forwards all request headers,
          // then set cookies on the outgoing response only (never on request).
          // Preserving `options` (HttpOnly, Secure, SameSite, Path, etc.) is critical.
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not write any logic between createServerClient and
  // supabase.auth.getUser(). Doing so can cause hard-to-debug session issues.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes — require authentication
  const protectedRoutes = ['/dashboard', '/app']
  // Auth routes — redirect away if already logged in
  const authRoutes = ['/login', '/signup']

  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // Redirect unauthenticated users to login, preserving intended destination
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Redirect already-authenticated users away from auth pages
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: Return supabaseResponse as-is so session cookies are forwarded.
  // If you create a new NextResponse, copy cookies:
  //   myResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  return supabaseResponse
}
