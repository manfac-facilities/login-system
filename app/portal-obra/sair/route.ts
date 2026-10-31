import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO, encerrarSessao, opcoesCookiePortal } from '@/lib/portal-obra/sessao'

/**
 * Só aceita pedido do próprio site: Origin com o mesmo host do pedido; sem Origin, só com
 * Sec-Fetch-Site same-origin. Qualquer outra coisa é recusada (falha fechada).
 */
function mesmoSite(req: NextRequest): boolean {
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim().toLowerCase()
  const origin = req.headers.get('origin')
  if (origin) {
    try {
      return !!host && new URL(origin).host.toLowerCase() === host
    } catch {
      return false
    }
  }
  return req.headers.get('sec-fetch-site') === 'same-origin'
}

/** Sair: revoga a sessão no banco e apaga o cookie. Só POST do próprio site. */
export async function POST(req: NextRequest) {
  if (!mesmoSite(req)) return new NextResponse(null, { status: 403 })
  await encerrarSessao(req.cookies)
  // Location relativo: atrás do proxy, req.url traz o host interno.
  const res = new NextResponse(null, { status: 303, headers: { Location: '/portal-obra' } })
  res.cookies.set(COOKIE_SESSAO, '', { ...opcoesCookiePortal(new Date(0)), maxAge: 0 })
  return res
}
