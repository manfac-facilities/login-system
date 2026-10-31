/**
 * Código de entrada do portal (spec Leva 5 §3.1): 6 dígitos, 10 min, uso único,
 * 5 tentativas por código, 5 códigos/hora por e-mail, 20/hora por IP; só o HMAC no banco.
 * Só o código mais recente do e-mail vale. Tentativa e uso são gravados por
 * compare-and-swap (um UPDATE condicionado ao valor lido, com retorno): duas
 * conferências simultâneas nunca contam a mesma tentativa nem usam o código duas vezes.
 * Nunca logar código, token ou segredo.
 */
import { randomInt } from 'node:crypto'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '@/app/obras/obras/_lib/enviar'
import { hashesIguais, hmacHex, segredoPortal } from './segredo'
import {
  MENSAGEM_CODIGO_INVALIDO, MENSAGEM_INDISPONIVEL, MENSAGEM_UNIFORME, emailAceito, normalizarEmail, obrasComAcessoAtivo,
} from './acesso'
import { CODIGO_MAX_TENTATIVAS, CODIGO_VALIDADE_MIN, dentroDosLimites } from './limites'
import { criarSessao } from './sessao'

export type ResultadoPedido = { ok: boolean; mensagem: string }
export type ResultadoVerificacao =
  | { ok: true; token: string; expiraCookie: Date }
  | { ok: false; mensagem: string }

const hashDoCodigo = (segredo: string, email: string, codigo: string) => hmacHex(segredo, 'codigo', `${email}\n${codigo}`)

function emailDoCodigo(codigo: string) {
  const texto = [
    `Seu código de acesso à página da obra é: ${codigo}`,
    '',
    `Ele vale por ${CODIGO_VALIDADE_MIN} minutos e só pode ser usado uma vez.`,
    'Se você não pediu este código, ignore este e-mail.',
    '',
    'Manfac Facilities',
  ].join('\n')
  const html = `<p>Seu código de acesso à página da obra é:</p>`
    + `<p style="font-size:28px;font-weight:bold;letter-spacing:6px">${codigo}</p>`
    + `<p>Ele vale por ${CODIGO_VALIDADE_MIN} minutos e só pode ser usado uma vez.<br>Se você não pediu este código, ignore este e-mail.</p>`
    + `<p>Manfac Facilities</p>`
  return { assunto: 'Seu código de acesso — Manfac', texto, html }
}

export async function pedirCodigo(emailBruto: unknown, ip: string, agora: Date = new Date()): Promise<ResultadoPedido> {
  const segredo = segredoPortal()
  if (!segredo) return { ok: false, mensagem: MENSAGEM_INDISPONIVEL }
  let admin
  try {
    admin = createAdminClient()
  } catch {
    console.error('[portal-obra] cliente admin indisponível')
    return { ok: false, mensagem: MENSAGEM_INDISPONIVEL }
  }
  const uniforme = { ok: true, mensagem: MENSAGEM_UNIFORME }
  try {
    const email = normalizarEmail(emailBruto)
    if (!emailAceito(email)) return uniforme
    // Limites antes do acesso: o mesmo trabalho para e-mail cadastrado ou não.
    if (!(await dentroDosLimites(admin, email, ip, agora))) return uniforme
    const obras = await obrasComAcessoAtivo(admin, email)
    if (obras.length === 0) return uniforme

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const { error } = await admin.from('obras_portal_codigo').insert({
      email,
      codigo_hash: hashDoCodigo(segredo, email, codigo),
      expira_em: new Date(agora.getTime() + CODIGO_VALIDADE_MIN * 60_000).toISOString(),
      tentativas: 0,
      criado_em: agora.toISOString(),
      ip,
    })
    if (error) {
      console.error('[portal-obra] falha ao gravar código')
      return uniforme
    }
    // Envio depois da resposta: o tempo de resposta não denuncia e-mail cadastrado.
    const msg = emailDoCodigo(codigo)
    after(async () => {
      const r = await enviarEmail({ para: [email], assunto: msg.assunto, html: msg.html, texto: msg.texto, anexos: [] })
      if (!r.ok) console.error(`[portal-obra] falha no envio do código: ${r.falhas.map((f) => f.erro).join('; ')}`)
    })
    return uniforme
  } catch {
    console.error('[portal-obra] erro ao pedir código')
    return uniforme
  }
}

type LinhaCodigo = { id: string; codigo_hash: string; expira_em: string; tentativas: number; usado_em: string | null }

export async function verificarCodigo(emailBruto: unknown, codigoBruto: unknown, agora: Date = new Date()): Promise<ResultadoVerificacao> {
  const segredo = segredoPortal()
  if (!segredo) return { ok: false, mensagem: MENSAGEM_INDISPONIVEL }
  const invalido = { ok: false as const, mensagem: MENSAGEM_CODIGO_INVALIDO }
  try {
    const email = normalizarEmail(emailBruto)
    const codigo = typeof codigoBruto === 'string' ? codigoBruto.replace(/\s/g, '') : ''
    if (!emailAceito(email) || !/^\d{6}$/.test(codigo)) return invalido
    const admin = createAdminClient()
    const agoraIso = agora.toISOString()

    // Só o código mais recente do e-mail vale (pedir outro aposenta o anterior).
    const { data, error } = await admin.from('obras_portal_codigo')
      .select('id, codigo_hash, expira_em, tentativas, usado_em')
      .eq('email', email).order('criado_em', { ascending: false }).limit(1).maybeSingle()
    if (error || !data) return invalido
    const c = data as LinhaCodigo
    if (c.usado_em !== null && c.usado_em !== undefined) return invalido
    if (!(Date.parse(c.expira_em) > agora.getTime())) return invalido
    if (typeof c.tentativas !== 'number' || c.tentativas >= CODIGO_MAX_TENTATIVAS) return invalido

    // Conta a tentativa ANTES de comparar, condicionada ao valor lido (compare-and-swap).
    const { data: contou, error: eConta } = await admin.from('obras_portal_codigo')
      .update({ tentativas: c.tentativas + 1 })
      .eq('id', c.id).eq('tentativas', c.tentativas).is('usado_em', null).gt('expira_em', agoraIso)
      .select('id')
    if (eConta || !Array.isArray(contou) || contou.length !== 1) return invalido

    if (!hashesIguais(hashDoCodigo(segredo, email, codigo), c.codigo_hash)) return invalido

    // Uso único: só quem marcar `usado_em` primeiro leva a sessão.
    const { data: usou, error: eUso } = await admin.from('obras_portal_codigo')
      .update({ usado_em: agoraIso })
      .eq('id', c.id).is('usado_em', null)
      .select('id')
    if (eUso || !Array.isArray(usou) || usou.length !== 1) return invalido

    // O acesso pode ter sido desativado depois do pedido do código.
    const obras = await obrasComAcessoAtivo(admin, email)
    if (obras.length === 0) return invalido

    const { token, expiraCookie } = await criarSessao(admin, segredo, email, agora)
    return { ok: true, token, expiraCookie }
  } catch {
    console.error('[portal-obra] erro ao verificar código')
    return invalido
  }
}
