import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isManfacEmail } from '@/lib/auth/domain'
import { isAdminEmail } from '@/lib/auth/admins'
import { hasSystemAccess } from '@/lib/auth/systemAccess'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ''

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isConversorOsApi = pathname.startsWith('/api/conversor-os')
  const isConversorOsPage = pathname.startsWith('/conversor-os')
  const isAdminPage = pathname.startsWith('/admin')
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/sofia') ||
    isConversorOsPage ||
    isAdminPage ||
    isConversorOsApi
  // /reset-password não entra em isAuthPage: usuários autenticados precisam
  // acessá-la durante o fluxo de redefinição de senha via link de e-mail.
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  if (isProtected) {
    if (!user) {
      if (isConversorOsApi) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (!isManfacEmail(user.email ?? '')) {
      await supabase.auth.signOut()
      if (isConversorOsApi) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'unauthorized')
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }
    if (isConversorOsPage || isConversorOsApi) {
      const acesso = await hasSystemAccess(supabase, user.email ?? '', 'conversor-os')
      if (!acesso) {
        if (isConversorOsApi) return NextResponse.json({ error: 'Sem acesso ao Conversor OS' }, { status: 403 })
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    if (isAdminPage && !isAdminEmail(user.email ?? '')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (isAuthPage && user && isManfacEmail(user.email ?? '')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/sofia/:path*',
    '/conversor-os/:path*',
    '/admin/:path*',
    '/api/conversor-os/:path*',
    '/login',
    '/signup',
    '/signup/verify',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
  ],
}
