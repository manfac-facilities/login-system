'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { pedirCodigo, verificarCodigo } from '@/lib/portal-obra/codigo'
import { normalizarEmail } from '@/lib/portal-obra/acesso'
import { ipDoCliente } from '@/lib/portal-obra/limites'
import { COOKIE_EMAIL, COOKIE_SESSAO, opcoesCookiePortal } from '@/lib/portal-obra/sessao'

export type EstadoEntrada = { erro?: string }

export async function pedirCodigoAction(_prev: EstadoEntrada, form: FormData): Promise<EstadoEntrada> {
  const email = normalizarEmail(form.get('email'))
  const r = await pedirCodigo(email, ipDoCliente(await headers()))
  if (!r.ok) return { erro: r.mensagem }
  // Mesma resposta para qualquer e-mail: guarda o e-mail digitado para a tela do código.
  const jar = await cookies()
  jar.set(COOKIE_EMAIL, email, opcoesCookiePortal(new Date(Date.now() + 10 * 60_000)))
  redirect('/portal-obra/codigo')
}

export async function verificarCodigoAction(_prev: EstadoEntrada, form: FormData): Promise<EstadoEntrada> {
  const jar = await cookies()
  const email = jar.get(COOKIE_EMAIL)?.value ?? ''
  const r = await verificarCodigo(email, form.get('codigo'))
  if (!r.ok) return { erro: r.mensagem }
  jar.set(COOKIE_SESSAO, r.token, opcoesCookiePortal(r.expiraCookie))
  jar.set(COOKIE_EMAIL, '', { ...opcoesCookiePortal(new Date(0)), maxAge: 0 })
  redirect('/portal-obra/obras')
}
