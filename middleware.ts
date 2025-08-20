import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create a mutable response to allow Supabase to set cookies when refreshing the session
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Mark request passed through middleware (for debugging in Vercel/CDN)
  response.headers.set('x-mw', '1')

  const path = request.nextUrl.pathname
  // Skip middleware for static assets, auth routes, and API routes
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.startsWith('/auth') ||
    path.includes('.') ||
    path === '/login' ||
    path === '/register'
  ) {
  response.headers.set('x-mw-skip', '1')
    return response
  }

  try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasAuthCookie = request.cookies.getAll().some((c) => /sb-.*-auth-token/.test(c.name))

    if (!supabaseUrl || !supabaseAnonKey) {
      // If envs missing, rely on cookie presence to gate protected routes; fail open otherwise
      response.headers.set('x-mw-missing-env', '1')
      if (!hasAuthCookie && !path.startsWith('/login') && !path.startsWith('/register')) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      return response
    }

    // If forced fallback, skip importing SSR helper and just rely on cookie gate
    if (process.env.MW_FORCE_FALLBACK === '1') {
      if (!hasAuthCookie && !path.startsWith('/login') && !path.startsWith('/register')) {
        response.headers.set('x-mw-fallback', 'forced-redirect')
        return NextResponse.redirect(new URL('/login', request.url))
      }
      response.headers.set('x-mw-fallback', 'forced-pass')
      return response
    }

    // Dynamically import SSR helper to reduce Edge bundling pressure; fallback to cookie check if it fails
    const { createServerClient } = await import('@supabase/ssr')

    // Use @supabase/ssr v0.5 cookies API: getAll/setAll
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            // Use the overload that accepts (name, value, options) to avoid spreading undefined
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    // Check current session; this will also refresh it if needed and set cookies on the response
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // If no session and trying to access protected route, redirect to login
    if (
      !session &&
      !(path === '/' || path.startsWith('/login') || path.startsWith('/register'))
    ) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  response.headers.set('x-mw-auth', session ? '1' : '0')
  } catch (error) {
    console.error('Middleware error:', error)
    // Fallback: if SSR helper import or call failed in Edge, use cookie presence to decide
    response.headers.set('x-mw-error', '1')
    const hasAuthCookie = request.cookies.getAll().some((c) => /sb-.*-auth-token/.test(c.name))
    if (!hasAuthCookie && !path.startsWith('/login') && !path.startsWith('/register')) {
      response.headers.set('x-mw-fallback', 'redirect')
      return NextResponse.redirect(new URL('/login', request.url))
    }
    response.headers.set('x-mw-fallback', 'pass')
    return response
  }

  return response
}

export const config = {
  // Exclude _next assets, images, favicon, and API routes from middleware
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}