/**
 * Peças do HTML de e-mail dos relatórios da OBRA (semanal e de período):
 * cabeçalho Manfac, faixa do sinal, números, seções, linhas e caixas. Todo
 * texto passa por `esc` — o conteúdo pode vir do congelado (não confiável).
 */
import type { ItemDiario, SinalVisual } from './email-diario'
import { esc } from './conteudo-valido'

export const secao = (t: string, corpo: string) =>
  `<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0">
<div style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">${esc(t)}</div>
${corpo}</td></tr>`
export const vazio = (t: string) => `<div style="font-size:14px;color:#64748b">${esc(t)}</div>`
export const linha = (t: string, cor = '#16a34a') =>
  `<div style="border-left:3px solid ${cor};padding:3px 10px;margin-bottom:5px;font-size:14px;color:#0f172a">${esc(t)}</div>`
export const caixa = (it: ItemDiario, cor: string, fundo: string) =>
  `<div style="border-left:3px solid ${cor};background:${fundo};padding:8px 10px;border-radius:4px;margin-bottom:6px;font-size:14px;color:#0f172a">
<div style="font-size:12px;font-weight:700;color:#334155">${esc(it.rotulo)}</div>${esc(it.corpo)}</div>`
export const texto = (t: string) => `<div style="font-size:14px;color:#0f172a;white-space:pre-wrap">${esc(t)}</div>`

/** Documento completo: cabeçalho, sinal, até 3 números, as seções prontas (`corpo`) e o rodapé. */
export function documentoEmail(p: {
  assunto: string
  /** "RELATÓRIO SEMANAL" etc. (o " · INTERNO" entra sozinho). */
  faixa: string
  interno: boolean
  titulo: string
  subtitulo: string
  sinal: SinalVisual
  desvio: string
  previsao: string
  numeros: [string, string][]
  corpo: string
  rodape: string
}): string {
  const { sinal: s } = p
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.assunto)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<tr><td style="background:#0d2050;padding:16px 20px">
<div style="color:#f05a28;font-weight:700;font-size:12px;letter-spacing:.05em">MANFAC · ${esc(p.faixa)}${p.interno ? ' · INTERNO' : ''}</div>
<div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:3px">${esc(p.titulo)}</div>
<div style="color:#94a3b8;font-size:13px;margin-top:2px">${esc(p.subtitulo)}</div>
</td></tr>
<tr><td style="background:${esc(s.fundo)};border-bottom:1px solid ${esc(s.borda)};padding:12px 20px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="padding-right:10px"><div style="width:14px;height:14px;border-radius:7px;background:${esc(s.ponto)}"></div></td>
<td style="font-size:14px;color:#0f172a"><b>${esc(s.rotulo)}</b> — ${esc(p.desvio)}.<br><span style="color:${esc(s.texto)}">${esc(p.previsao)}</span></td>
</tr></table></td></tr>
<tr><td style="padding:12px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${p.numeros
  .map(
    ([v, r]) =>
      `<td width="33%" style="padding:4px"><div style="background:#f1f5f9;border-radius:8px;padding:10px;text-align:center"><b style="display:block;font-size:20px;color:#0f172a">${esc(v)}</b><span style="font-size:12px;color:#64748b">${esc(r)}</span></div></td>`,
  )
  .join('')}
</tr></table></td></tr>
${p.corpo}
<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">${esc(p.rodape)}</td></tr>
</table></td></tr></table></body></html>`
}

/** "Dependem do cliente": caixa vermelha se vencida, amarela se não. */
export const htmlDoCliente = (lista: { descricao: string; atividade: string; tipo: string; prazo: string | null; vencida: boolean }[]) =>
  lista.length
    ? lista
        .map((r) =>
          caixa(
            { rotulo: `${r.tipo.toUpperCase()}${r.prazo ? ` · prazo ${r.prazo}${r.vencida ? ' (vencido)' : ''}` : ''}`, corpo: `${r.descricao} — atividade ${r.atividade}` },
            r.vencida ? '#dc2626' : '#f59e0b',
            r.vencida ? '#fef2f2' : '#fffbeb',
          ),
        )
        .join('')
    : vazio('Nada pendente com o cliente.')
