import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_SESSAO, encerrarSessao, opcoesCookiePortal } from '@/lib/portal-obra/sessao'

/** Sair: revoga a sessão no banco e apaga o cookie. Só POST (um GET de terceiro não desloga). */
export async function POST(req: NextRequest) {
  await encerrarSessao(req.cookies)
  // Location relativo: atrás do proxy, req.url traz o host interno.
  const res = new NextResponse(null, { status: 303, headers: { Location: '/portal-obra' } })
  res.cookies.set(COOKIE_SESSAO, '', { ...opcoesCookiePortal(new Date(0)), maxAge: 0 })
  return res
}
