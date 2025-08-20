import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create a mutable response to allow Supabase to set cookies when refreshing the session
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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
    return response
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      // In production (Vercel), ensure env vars are configured; fail open to avoid hard crash
      console.error('Supabase env vars missing in middleware')
      return response
    }

    // Use @supabase/ssr v0.5 cookies API: getAll/setAll
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    })

    // Check current session; this will also refresh it if needed and set cookies on the response
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // If no session and trying to access protected route, redirect to login
    if (!session && !path.startsWith('/login') && !path.startsWith('/register')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch (error) {
    console.error('Middleware error:', error)
    // Soft-fail to avoid Vercel MIDDLEWARE_INVOCATION_FAILED causing 500 on all routes
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