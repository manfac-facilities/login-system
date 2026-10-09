/**
 * Relatório diário do Painel gerencial por e-mail — chamado pelo `pg_cron` às 8h01.
 * Spec: docs/relatorio-email/2026-10-08-spec.md (§2 fluxo, §3 contrato, §6.3 envio).
 *
 * SÍNCRONA de propósito (spec §3.4): sem tabela de execução, o único registro do
 * resultado é a resposta HTTP que o `pg_net` guarda em `net._http_response`.
 *
 * Falha fechado: qualquer erro de leitura (painel ou destinatários), lista vazia
 * ou falha da imagem → 500 e ninguém recebe.
 */

import { createTransport } from 'nodemailer'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hojeISO } from '@/app/obras/_lib/tipos'
import { montarPainel } from '@/app/obras/painel/_calculos'
import { lerEntradaDoPainel } from '@/app/obras/painel/_leitura'
import { autorizacaoDoCronValida } from '@/app/api/obras/sincronizar/route'
import {
  CID_IMAGEM,
  assuntoDoDia,
  formatarLidoEm,
  htmlDoEmail,
  montarDestinatarios,
  remetenteDe,
  textoAlternativo,
  textoDoEmail,
} from './_email'
import { gerarPng } from './_imagem'

export const runtime = 'nodejs'
export const maxDuration = 120

const LOG = '[relatorio-diario]'
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

export async function POST(request: Request) {
  const segredo = process.env.OBRAS_CRON_SECRET ?? ''
  if (!segredo.trim()) {
    return erro(503, { error: 'OBRAS_CRON_SECRET não configurado' }, 'OBRAS_CRON_SECRET não configurado')
  }
  if (!autorizacaoDoCronValida(request.headers.get('authorization'), segredo)) {
    return erro(401, { error: 'Não autorizado' }, 'não autorizado')
  }

  let previa = false
  let somentePara: string | null = null
  try {
    const corpo: unknown = await request.json()
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new Error()
    const c = corpo as { previa?: unknown; somentePara?: unknown }
    if (c.previa !== undefined && c.previa !== true) throw new Error()
    if (c.somentePara !== undefined && typeof c.somentePara !== 'string') throw new Error()
    previa = c.previa === true
    somentePara = typeof c.somentePara === 'string' ? c.somentePara.trim().toLowerCase() : null
  } catch {
    return erro(400, { error: 'Corpo inválido' }, 'corpo inválido')
  }

  // Com `previa`, nada é enviado: só o segredo é exigido.
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
    if (faltando) {
      return erro(503, { error: `${faltando[0]} não configurado` }, `${faltando[0]} não configurado`)
    }
  }

  // Leituras: painel e destinatários em paralelo. Qualquer erro → ninguém recebe.
  let destinatarios: string[]
  let entrada: Extract<Awaited<ReturnType<typeof lerEntradaDoPainel>>, { ok: true }>
  try {
    const admin = createAdminClient()
    const [painelLido, acesso, admins] = await Promise.all([
      lerEntradaDoPainel(admin),
      admin.from('hub_system_access').select('user_email, has_access').eq('system_slug', 'obras').eq('has_access', true),
      admin.from('hub_user_roles').select('user_email').eq('nivel', 'administrador'),
    ])
    if (!painelLido.ok) return erro(500, { error: 'leitura', detalhe: painelLido.erro }, `leitura: ${painelLido.erro}`)
    if (acesso.error || !acesso.data) {
      const d = `hub_system_access: ${acesso.error?.message ?? 'sem dados'}`
      return erro(500, { error: 'leitura', detalhe: d }, `leitura: ${d}`)
    }
    if (admins.error || !admins.data) {
      const d = `hub_user_roles: ${admins.error?.message ?? 'sem dados'}`
      return erro(500, { error: 'leitura', detalhe: d }, `leitura: ${d}`)
    }
    entrada = painelLido
    destinatarios = montarDestinatarios(acesso.data, admins.data)
  } catch (e) {
    return erro(500, { error: 'leitura', detalhe: mensagem(e) }, `leitura: ${mensagem(e)}`)
  }
  if (destinatarios.length === 0) {
    return erro(500, { error: 'sem destinatários' }, 'sem destinatários')
  }
  if (!previa && somentePara !== null && !destinatarios.includes(somentePara)) {
    return erro(400, { error: 'somentePara fora da lista de destinatários' }, 'somentePara fora da lista')
  }

  const hoje = hojeISO()
  const lidoEm = formatarLidoEm(new Date())
  const painel = montarPainel(
    { obras: entrada.obras, diario: entrada.diario, tarefas: entrada.tarefas, remarcacoes: entrada.remarcacoes, hoje },
    { cliente: null, mes: hoje.slice(0, 7), cmp: 'prev' }
  )

  let png: Buffer
  try {
    png = await gerarPng(painel, lidoEm)
  } catch (e) {
    return erro(500, { error: 'imagem', detalhe: mensagem(e) }, `imagem: ${mensagem(e)}`)
  }

  if (previa) {
    return new NextResponse(new Uint8Array(png), { status: 200, headers: { 'Content-Type': 'image/png' } })
  }

  const porta = Number(process.env.SMTP_PORTA?.trim() || 465)
  const transporte = createTransport({
    host: smtp.host,
    port: porta,
    secure: porta === 465, // 465 = TLS direto; outra = STARTTLS obrigatório
    requireTLS: porta !== 465,
    auth: { user: smtp.usuario, pass: smtp.senha },
    connectionTimeout: TIMEOUT_SMTP_MS,
    greetingTimeout: TIMEOUT_SMTP_MS,
    socketTimeout: TIMEOUT_SMTP_MS,
  })

  const alt = textoAlternativo(painel)
  const mensagemBase = {
    from: remetenteDe(smtp.remetente),
    subject: assuntoDoDia(painel.hoje),
    html: htmlDoEmail({ painel, lidoEm, alt }),
    text: textoDoEmail({ painel, lidoEm }),
    attachments: [
      {
        filename: `painel-gerencial-${painel.hoje}.png`,
        content: png,
        contentType: 'image/png',
        cid: CID_IMAGEM,
        contentDisposition: 'inline' as const,
      },
    ],
  }

  // Um e-mail por destinatário (ninguém vê a lista), em sequência, sem retry.
  const destinos = somentePara !== null ? [somentePara] : destinatarios
  let enviados = 0
  const falhas: { para: string; erro: string }[] = []
  for (const para of destinos) {
    try {
      await transporte.sendMail({ ...mensagemBase, to: para })
      enviados++
    } catch (e) {
      falhas.push({ para, erro: codigoDoErroSmtp(e) })
    }
  }

  if (falhas.length > 0) {
    console.error(`${LOG} 502 ${falhas.length} de ${destinos.length} envios falharam: ${falhas.map((f) => f.erro).join(', ')}`)
    return NextResponse.json({ status: 'parcial', enviados, falhas }, { status: 502 })
  }
  return NextResponse.json({ status: 'enviado', enviados, falhas: [] }, { status: 200 })
}
