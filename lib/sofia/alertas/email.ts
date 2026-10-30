/**
 * Assunto, HTML e texto do e-mail diário de alertas (mockup seção 3): três variantes.
 * Funções puras; quem envia é a rota.
 */
import { contar, contarDocumentosVencidos, diaCurto, diaLongo, plural, type Alertas } from './blocos'

export const HUB_URL = 'https://hub.manfac.com.br'

export type VarianteEmail =
  | { tipo: 'com'; alertas: Alertas }
  | { tipo: 'nada'; hoje: string }
  | { tipo: 'falha'; hoje: string }

export interface EmailMontado {
  assunto: string
  html: string
  texto: string
}

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** "igor.silva@manfac.com.br" → "Igor". Sem nome legível, devolve null. */
export function nomeDoEmail(email: string): string | null {
  const primeiro = email.split('@')[0]?.split(/[._\-+\d]/)[0] ?? ''
  if (primeiro.length < 2) return null
  return primeiro[0].toUpperCase() + primeiro.slice(1).toLowerCase()
}

function resumoDoAssunto(a: Alertas): string {
  const destaques = [
    plural(contar(a, 'revisoes_atrasadas'), 'revisão atrasada', 'revisões atrasadas'),
    plural(contar(a, 'equipes_sem_km'), 'equipe sem KM', 'equipes sem KM'),
    plural(contarDocumentosVencidos(a), 'documento vencido', 'documentos vencidos'),
  ].filter((t) => !t.startsWith('0 '))
  const mostrados = destaques.slice(0, 2)
  const contadosNoAssunto = mostrados.reduce((n, t) => n + Number.parseInt(t, 10), 0)
  if (mostrados.length === 0) return plural(a.total, 'item pede atenção', 'itens pedem atenção')
  const resto = a.total - contadosNoAssunto
  return resto > 0 ? `${mostrados.join(', ')} e mais ${plural(resto, 'item', 'itens')}` : mostrados.join(' e ')
}

export function assuntoDe(v: VarianteEmail): string {
  if (v.tipo === 'nada') return `Frotas · ${diaCurto(v.hoje)} · nada pendente hoje`
  if (v.tipo === 'falha') return `Frotas · ${diaCurto(v.hoje)} · não conseguimos montar o resumo de hoje`
  return `Frotas · ${diaCurto(v.alertas.hoje)} · ${resumoDoAssunto(v.alertas)}`
}

const fonte = 'font-family:Arial,Helvetica,sans-serif'
const link = (caminho: string) => `${HUB_URL}${caminho}`

function chips(a: Alertas): string[] {
  const rev = contar(a, 'revisoes_atrasadas')
  const semKm = contar(a, 'equipes_sem_km')
  const docV = contarDocumentosVencidos(a)
  const docs = contar(a, 'documentos')
  const linhas: [number, string, boolean][] = [
    [rev, plural(rev, 'revisão atrasada', 'revisões atrasadas'), true],
    [semKm, plural(semKm, 'equipe sem KM', 'equipes sem KM'), true],
    [docV, plural(docV, 'documento vencido', 'documentos vencidos'), true],
    [contar(a, 'revisoes_chegando'), plural(contar(a, 'revisoes_chegando'), 'revisão chegando', 'revisões chegando'), false],
    [docs - docV, plural(docs - docV, 'documento vencendo', 'documentos vencendo'), false],
    [contar(a, 'cnh'), `${contar(a, 'cnh')} CNH`, false],
    [contar(a, 'multas'), plural(contar(a, 'multas'), 'multa', 'multas'), false],
    [contar(a, 'sinistros'), plural(contar(a, 'sinistros'), 'sinistro', 'sinistros'), false],
    [contar(a, 'oficina'), plural(contar(a, 'oficina'), 'volta da oficina atrasada', 'voltas da oficina atrasadas'), false],
  ]
  return linhas
    .filter(([n]) => n > 0)
    .map(([, t, h]) => `<span style="display:inline-block;margin:0 4px 4px 0;padding:3px 8px;border-radius:5px;font-size:12px;color:#ffffff;background:${h ? '#f05a28' : '#0d2050'}">${escapar(t)}</span>`)
}

function moldura(titulo: string, subtitulo: string, corpo: string, saudacaoNome: string | null): string {
  const oi = saudacaoNome ? `Bom dia, ${escapar(saudacaoNome)}. ` : 'Bom dia. '
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#e9edf4;${fonte}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf4"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:8px">
<tr><td style="padding:20px 20px 12px;border-bottom:3px solid #f05a28;${fonte};color:#1f2937"><div style="font-size:18px;font-weight:bold;color:#0d2050">${oi}${escapar(titulo)}</div><div style="font-size:13px;color:#64748b;margin-top:4px">${escapar(subtitulo)}</div></td></tr>
<tr><td style="padding:16px 20px;${fonte};font-size:14px;color:#1f2937">${corpo}</td></tr>
<tr><td style="padding:14px 20px 20px;border-top:1px solid #e5e7eb;${fonte};font-size:12px;line-height:1.5;color:#64748b">Você recebe este e-mail porque é gestor de frotas no Hub Manfac. Enviado de segunda a sexta às 07:00. Os links abrem o hub; se pedir login, entre com a sua conta de sempre.</td></tr>
</table></td></tr></table>
</body></html>`
}

const botao = (href: string, rotulo: string) =>
  `<p style="margin:18px 0 0"><a href="${href}" style="display:inline-block;background:#f05a28;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:6px">${escapar(rotulo)}</a></p>`

export function emailDe(v: VarianteEmail, destinatario: string): EmailMontado {
  const nome = nomeDoEmail(destinatario)
  const assunto = assuntoDe(v)
  const oi = nome ? `Bom dia, ${nome}. ` : 'Bom dia. '

  if (v.tipo === 'nada') {
    const sub = `Resumo da Gestão de Frotas de ${diaLongo(v.hoje)}, gerado às 07:00.`
    const msg = 'Conferimos revisões, documentos, CNH, multas, sinistros, carros na oficina e o KM de ontem: está tudo em dia.'
    const nota = 'Este e-mail chega mesmo quando não há nada, para você saber que a conferência rodou.'
    return {
      assunto,
      html: moldura('Nada pendente hoje.', sub, `<p style="margin:0 0 10px">${msg}</p><p style="margin:0;font-size:12px;color:#64748b">${nota}</p>`, nome),
      texto: `${oi}Nada pendente hoje.\n${sub}\n\n${msg}\n${nota}\n`,
    }
  }

  if (v.tipo === 'falha') {
    const sub = `Tentativa às 07:00 de ${diaLongo(v.hoje)}.`
    const msg = 'A conferência automática falhou ao ler os dados. Isso não quer dizer que está tudo em dia. Até corrigirmos, confira os alertas direto no hub.'
    const nota = 'Se este aviso se repetir amanhã, avise o suporte do hub.'
    return {
      assunto,
      html: moldura('O resumo de hoje não pôde ser montado.', sub, `<p style="margin:0">${msg}</p>${botao(link('/sofia'), 'Ver os alertas no hub')}<p style="margin:14px 0 0;font-size:12px;color:#64748b">${nota}</p>`, nome),
      texto: `${oi}O resumo de hoje não pôde ser montado.\n${sub}\n\n${msg}\nAbrir: ${link('/sofia')}\n${nota}\n`,
    }
  }

  const a = v.alertas
  const titulo = `${plural(a.total, 'item pede atenção', 'itens pedem atenção')} hoje.`
  const sub = `Resumo da Gestão de Frotas de ${diaLongo(a.hoje)}, gerado às 07:00.`
  const blocosHtml = a.blocos
    .map((b) => {
      const itens = b.itens
        .map(
          (i) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937"><b>${escapar(i.rotulo)}</b> <span${i.vencido ? ' style="color:#f05a28;font-weight:600"' : ''}>${escapar(i.detalhe)}</span></td><td align="right" style="padding:6px 0 6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap"><a href="${link(i.caminho)}" style="color:#f05a28;font-size:12px;font-weight:bold;text-decoration:none">Abrir no hub →</a></td></tr>`
        )
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0"><tr><td colspan="2" style="padding-bottom:4px;font-size:14px;font-weight:bold;color:#0d2050">${escapar(b.titulo)} <span style="display:inline-block;background:#f05a28;color:#fff;border-radius:999px;padding:0 8px;font-size:12px">${b.itens.length}</span></td></tr>${itens}</table>`
    })
    .join('')
  const html = moldura(titulo, sub, `<div>${chips(a).join('')}</div>${blocosHtml}${botao(link('/sofia'), 'Abrir a visão geral do Frotas')}`, nome)
  const texto =
    `${oi}${titulo}\n${sub}\n\n` +
    a.blocos
      .map((b) => `${b.titulo.toUpperCase()} (${b.itens.length})\n${b.itens.map((i) => `- ${i.rotulo} ${i.detalhe} — ${link(i.caminho)}`).join('\n')}`)
      .join('\n\n') +
    `\n\nAbrir a visão geral do Frotas: ${link('/sofia')}\n`
  return { assunto, html, texto }
}
