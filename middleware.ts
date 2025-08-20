import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Skip middleware for API routes and static files
  const path = request.nextUrl.pathname
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api/auth') ||
    path.includes('.') ||
    path === '/login' ||
    path === '/register'
  ) {
    return response
  }

  try {
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // Refresh session if exists
    const { data: { session } } = await supabase.auth.getSession()
    
    // If no session and trying to access protected route, redirect to login
    if (!session && !path.startsWith('/login') && !path.startsWith('/register')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

  } catch (error) {
    console.error('Middleware error:', error)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}