/**
 * Envio de e-mail pela Locaweb (mesmo SMTP/remetente do relatório diário,
 * `app/api/obras/relatorio-diario/route.ts`). Um e-mail por destinatário —
 * ninguém vê a lista. Resultado por destinatário (quem recebeu e quem falhou).
 * Sem env completa → todos falham, sem tentar enviar.
 */
import { createTransport } from 'nodemailer'

const TIMEOUT_SMTP_MS = 15_000

export type ResultadoEnvio = { ok: boolean; aceitos: string[]; falhas: { para: string; erro: string }[] }

/** Só o código do erro SMTP — nunca a mensagem crua do servidor. */
function codigoDoErroSmtp(e: unknown): string {
  const x = (e ?? {}) as { code?: unknown; responseCode?: unknown }
  const partes = [x.code, x.responseCode].filter((p) => typeof p === 'string' || typeof p === 'number')
  return partes.length ? partes.join(' ') : 'erro desconhecido'
}

export async function enviarEmail(p: {
  para: string[]
  assunto: string
  html: string
  texto: string
  anexos: { cid: string; nome: string; conteudo: Buffer }[]
}): Promise<ResultadoEnvio> {
  const smtp = {
    host: process.env.SMTP_HOST ?? '',
    usuario: process.env.SMTP_USUARIO ?? '',
    senha: process.env.SMTP_SENHA ?? '',
    remetente: process.env.SMTP_REMETENTE ?? '',
  }
  const faltando = Object.entries({
    SMTP_HOST: smtp.host, SMTP_USUARIO: smtp.usuario, SMTP_SENHA: smtp.senha, SMTP_REMETENTE: smtp.remetente,
  }).find(([, v]) => !v.trim())
  if (faltando) {
    const erro = `${faltando[0]} não configurado`
    return { ok: false, aceitos: [], falhas: p.para.map((para) => ({ para, erro })) }
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
  const r = smtp.remetente.trim()
  const base = {
    from: r.includes('<') ? r : `"Manfac" <${r}>`,
    subject: p.assunto,
    html: p.html,
    text: p.texto,
    attachments: p.anexos.map((a) => ({
      filename: a.nome,
      content: a.conteudo,
      cid: a.cid,
      contentDisposition: 'inline' as const,
    })),
  }

  const aceitos: string[] = []
  const falhas: { para: string; erro: string }[] = []
  for (const para of p.para) {
    try {
      await transporte.sendMail({ ...base, to: para })
      aceitos.push(para)
    } catch (e) {
      falhas.push({ para, erro: codigoDoErroSmtp(e) })
    }
  }
  return { ok: falhas.length === 0, aceitos, falhas }
}
