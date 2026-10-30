/**
 * E-mail diário de alertas da Gestão de Frotas — chamado pelo `pg_cron` às 07:01 BRT, seg–sex.
 * Spec: docs/superpowers/specs/2026-10-30-frotas-segunda-bateria-design.md (decisões 5, 6, 7, 11).
 * Mesmo desenho de `app/api/obras/relatorio-diario/route.ts`, com segredo próprio (SOFIA_ALERTAS_SECRET):
 * vazar um não abre o outro.
 *
 * Variantes: com pendências / nada pendente (e-mail curto) / falha (aviso; resposta 500 para o
 * `net._http_response` mostrar que a montagem quebrou). Sem destinatário ou sem SMTP: 500/503, nada enviado.
 * Corpo `{"previa": true}`: devolve o e-mail montado em JSON, sem SMTP e sem enviar.
 */
import { createTransport } from 'nodemailer'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { autorizacaoDoCronValida } from '@/app/api/obras/sincronizar/route'
import { montarAlertas } from '@/lib/sofia/alertas/blocos'
import { emailDe, type VarianteEmail } from '@/lib/sofia/alertas/email'
import { hojeBrasilia, lerDestinatarios, lerEntradaDosAlertas } from '@/lib/sofia/alertas/leitura'

export const runtime = 'nodejs'
export const maxDuration = 120

const LOG = '[sofia-alertas-diarios]'
const TIMEOUT_SMTP_MS = 15_000

function erro(status: number, corpo: Record<string, unknown>, motivo: string) {
  console.error(`${LOG} ${status} ${motivo}`)
  return NextResponse.json(corpo, { status })
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Só o código do erro SMTP — nunca a mensagem crua do servidor. */
function codigoDoErroSmtp(e: unknown): string {
  const x = (e ?? {}) as { code?: unknown; responseCode?: unknown }
  const partes = [x.code, x.responseCode].filter((p) => typeof p === 'string' || typeof p === 'number')
  return partes.length ? partes.join(' ') : 'erro desconhecido'
}

const remetenteDe = (v: string) => (v.trim().includes('<') ? v.trim() : `"Manfac" <${v.trim()}>`)

export async function POST(request: Request) {
  const segredo = process.env.SOFIA_ALERTAS_SECRET ?? ''
  if (!segredo.trim()) {
    return erro(503, { error: 'SOFIA_ALERTAS_SECRET não configurado' }, 'SOFIA_ALERTAS_SECRET não configurado')
  }
  if (!autorizacaoDoCronValida(request.headers.get('authorization'), segredo)) {
    return erro(401, { error: 'Não autorizado' }, 'não autorizado')
  }

  let previa = false
  try {
    const corpo: unknown = await request.json()
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new Error()
    const c = corpo as { previa?: unknown }
    if (c.previa !== undefined && c.previa !== true) throw new Error()
    previa = c.previa === true
  } catch {
    return erro(400, { error: 'Corpo inválido' }, 'corpo inválido')
  }

  const smtp = {
    host: process.env.SMTP_HOST ?? '',
    usuario: process.env.SMTP_USUARIO ?? '',
    senha: process.env.SMTP_SENHA ?? '',
    remetente: process.env.SMTP_REMETENTE ?? '',
  }
  if (!previa) {
    const faltando = (
      [
        ['SMTP_HOST', smtp.host],
        ['SMTP_USUARIO', smtp.usuario],
        ['SMTP_SENHA', smtp.senha],
        ['SMTP_REMETENTE', smtp.remetente],
      ] as const
    ).find(([, v]) => !v.trim())
    if (faltando) return erro(503, { error: `${faltando[0]} não configurado` }, `${faltando[0]} não configurado`)
  }

  const hoje = hojeBrasilia()
  let admin: ReturnType<typeof createAdminClient>
  let destinatarios: string[]
  try {
    admin = createAdminClient()
    destinatarios = await lerDestinatarios(admin)
  } catch (e) {
    return erro(500, { error: 'leitura', detalhe: mensagem(e) }, `destinatários: ${mensagem(e)}`)
  }
  if (destinatarios.length === 0) return erro(500, { error: 'sem destinatários' }, 'sem destinatários')

  // Montagem: falhou → manda o aviso de falha (silêncio seria indistinguível de "tudo em dia").
  let variante: VarianteEmail
  let falhaDeMontagem: string | null = null
  try {
    const alertas = montarAlertas(await lerEntradaDosAlertas(admin, hoje))
    variante = alertas.total === 0 ? { tipo: 'nada', hoje } : { tipo: 'com', alertas }
  } catch (e) {
    falhaDeMontagem = mensagem(e)
    console.error(`${LOG} montagem falhou: ${falhaDeMontagem}`)
    variante = { tipo: 'falha', hoje }
  }

  if (previa) {
    return NextResponse.json({ variante: variante.tipo, destinatarios, ...emailDe(variante, destinatarios[0]) }, { status: 200 })
  }

  const porta = Number(process.env.SMTP_PORTA?.trim() || 465)
  const transporte = createTransport({
    host: smtp.host,
    port: porta,
    secure: porta === 465,
    requireTLS: porta !== 465,
    auth: { user: smtp.usuario, pass: smtp.senha },
    connectionTimeout: TIMEOUT_SMTP_MS,
    greetingTimeout: TIMEOUT_SMTP_MS,
    socketTimeout: TIMEOUT_SMTP_MS,
  })

  // Um e-mail por destinatário (ninguém vê a lista).
  let enviados = 0
  const falhas: { para: string; erro: string }[] = []
  for (const para of destinatarios) {
    const m = emailDe(variante, para)
    try {
      await transporte.sendMail({ from: remetenteDe(smtp.remetente), to: para, subject: m.assunto, html: m.html, text: m.texto })
      enviados++
    } catch (e) {
      falhas.push({ para, erro: codigoDoErroSmtp(e) })
    }
  }

  if (falhas.length > 0) {
    console.error(`${LOG} 502 ${falhas.length} de ${destinatarios.length} envios falharam: ${falhas.map((f) => f.erro).join(', ')}`)
    return NextResponse.json({ status: 'parcial', variante: variante.tipo, enviados, falhas }, { status: 502 })
  }
  if (falhaDeMontagem !== null) {
    // Aviso enviado, mas o cron precisa enxergar que a montagem quebrou.
    return NextResponse.json({ status: 'falha-avisada', enviados, detalhe: falhaDeMontagem }, { status: 500 })
  }
  return NextResponse.json({ status: 'enviado', variante: variante.tipo, enviados, falhas: [] }, { status: 200 })
}
