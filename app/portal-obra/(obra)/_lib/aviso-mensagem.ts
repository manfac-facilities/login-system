/**
 * Aviso à equipe Manfac quando o cliente escreve (Leva 5 §3.2): engenheiro da obra +
 * destinatários internos ativos com tipo 'imediato'. O texto do cliente é escapado;
 * o link leva à Comunicação da obra no hub. Falha aqui nunca derruba a mensagem.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { enviarEmail } from '@/app/obras/obras/_lib/enviar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function linkHubComunicacao(obraId: string, base: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  const b = (base ?? '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s/]+/i.test(b)) return null
  return `${b}/obras/obras/${obraId}/comunicacao`
}

export function montarEmailMensagemCliente(p: { loja: string; texto: string; de: string; link: string | null }) {
  const assunto = `Nova mensagem do cliente · ${p.loja}`.replace(/[\r\n]+/g, ' ')
  const corpo = esc(p.texto).replace(/\r?\n/g, '<br>')
  const botao = p.link
    ? `<div style="padding:12px 20px;border-top:1px solid #e2e8f0"><a href="${esc(p.link)}" style="display:inline-block;background:#f05a28;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:6px">Abrir a obra no hub</a></div>`
    : ''
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(assunto)}</title></head>
<body style="margin:0;padding:16px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
<div style="background:#0d2050;padding:16px 20px"><div style="color:#f05a28;font-weight:700;font-size:12px">MANFAC · MENSAGEM DO CLIENTE</div>
<div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:3px">${esc(p.loja)}</div></div>
<div style="padding:16px 20px;font-size:14px"><p style="margin:0 0 8px;color:#64748b;font-size:12px">${esc(p.de)} escreveu:</p>
<div>${corpo}</div></div>
${botao}
</div></body></html>`
  const texto = ['MANFAC · MENSAGEM DO CLIENTE', p.loja, '', `${p.de} escreveu:`, p.texto, ...(p.link ? ['', `Abrir a obra no hub: ${p.link}`] : [])].join('\n')
  return { assunto, html, texto }
}

export async function avisarEquipe(admin: Admin, p: { obraId: string; texto: string; de: string }): Promise<void> {
  try {
    const { data: obra } = await admin.from('obras_obra').select('loja, descricao, os, engenheiro_email').eq('id', p.obraId).maybeSingle()
    const o = (obra ?? {}) as { loja?: string | null; descricao?: string | null; os?: string | null; engenheiro_email?: string | null }
    const loja = String(o.loja ?? o.descricao ?? o.os ?? 'Obra').trim() || 'Obra'
    const { data: dest } = await admin.from('obras_destinatario').select('email, lado, tipos').eq('obra_id', p.obraId).eq('ativo', true)
    const internos = ((dest ?? []) as { email?: string; lado?: string; tipos?: string[] | null }[])
      .filter((d) => d.lado === 'interno' && Array.isArray(d.tipos) && d.tipos.includes('imediato'))
      .map((d) => String(d.email ?? ''))
    const para = [...new Set([o.engenheiro_email ?? '', ...internos].map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))]
    if (!para.length) return
    const msg = montarEmailMensagemCliente({ loja, texto: p.texto, de: p.de, link: linkHubComunicacao(p.obraId) })
    await enviarEmail({ para, ...msg, anexos: [] })
  } catch {
    console.error('[portal-obra] falha ao avisar a equipe de mensagem do cliente')
  }
}
