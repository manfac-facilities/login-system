/**
 * E-mails simples da Comunicação (Leva 2 §3.1 ata, §3.5 imediata), no mesmo
 * HTML Manfac do diário. Regras do cliente: sem R$, sem impedimento oculto,
 * responsável Manfac sem área (o tipo do impedimento só aparece ao cliente
 * quando é do cliente ou do clima). O texto livre é de quem escreve (§6.1-3).
 */
import { dataBr } from '../../_lib/email-diario'
import type { ImpedimentoRow } from '../../_lib/leitura'
import type { Ata, NivelImediata } from './_tipos'

export type EmailSimples = { assunto: string; html: string; texto: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const paragrafos = (s: string) => esc(s).replace(/\r?\n/g, '<br>')

const RESP: Record<string, string> = { cliente: 'Cliente', manfac: 'Manfac', terceiro: 'Terceiro', clima: 'Clima' }

function moldura(p: { faixa: string; titulo: string; subtitulo: string; destaque?: string; corpo: string; rodape: string }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.titulo)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<tr><td style="background:#0d2050;padding:16px 20px">
<div style="color:#f05a28;font-weight:700;font-size:12px;letter-spacing:.05em">${esc(p.faixa)}</div>
<div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:3px">${esc(p.titulo)}</div>
<div style="color:#94a3b8;font-size:13px;margin-top:2px">${esc(p.subtitulo)}</div>
</td></tr>
${p.destaque ?? ''}
${p.corpo}
<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">${esc(p.rodape)}</td></tr>
</table></td></tr></table></body></html>`
}

const secao = (titulo: string, corpo: string) =>
  `<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0">
<div style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;font-weight:700">${esc(titulo)}</div>
<div style="font-size:14px;color:#0f172a">${corpo}</div></td></tr>`

export function montarEmailAta(p: {
  loja: string
  data: string
  participantes: string | null
  texto: string | null
  ata: Ata
  enviadoPor: string
}): EmailSimples {
  const assunto = `Ata de reunião · ${p.loja} · ${dataBr(p.data)}`
  const subtitulo = `Reunião de ${dataBr(p.data)}`
  const pessoas = (p.participantes ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  const pend = p.ata.pendencias.map(
    (x) => `${x.oque}${x.responsavel ? ` — ${x.responsavel}` : ''}${x.prazo ? ` · até ${dataBr(x.prazo)}` : ''}`,
  )
  const lista = (itens: string[]) => `<ol style="margin:0;padding-left:20px">${itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`
  const corpo = [
    pessoas.length ? secao('Participantes', esc(pessoas.join(', '))) : '',
    secao('Pauta', paragrafos(p.ata.pauta)),
    p.texto ? secao('Registro', paragrafos(p.texto)) : '',
    secao('Decisões', p.ata.decisoes.length ? lista(p.ata.decisoes) : 'Nenhuma decisão registrada.'),
    secao('Pendências', pend.length ? lista(pend) : 'Nenhuma pendência.'),
    secao('Documento', 'A ata completa segue em PDF anexo.'),
  ].join('\n')
  const html = moldura({
    faixa: 'MANFAC · ATA DE REUNIÃO',
    titulo: p.loja,
    subtitulo,
    corpo,
    rodape: `Manfac Facilities · ata enviada por ${p.enviadoPor}.`,
  })
  const texto = [
    'MANFAC · ATA DE REUNIÃO',
    p.loja,
    subtitulo,
    '',
    ...(pessoas.length ? ['PARTICIPANTES', pessoas.join(', '), ''] : []),
    'PAUTA',
    p.ata.pauta,
    '',
    ...(p.texto ? ['REGISTRO', p.texto, ''] : []),
    'DECISÕES',
    ...(p.ata.decisoes.length ? p.ata.decisoes.map((d, i) => `${i + 1}. ${d}`) : ['Nenhuma decisão registrada.']),
    '',
    'PENDÊNCIAS',
    ...(pend.length ? pend.map((d, i) => `${i + 1}. ${d}`) : ['Nenhuma pendência.']),
    '',
    'A ata completa segue em PDF anexo.',
  ].join('\n')
  return { assunto, html, texto }
}

const NIVEL: Record<NivelImediata, { rotulo: string; fundo: string; borda: string; texto: string }> = {
  atencao: { rotulo: 'ATENÇÃO', fundo: '#fffbeb', borda: '#f59e0b', texto: '#92400e' },
  urgente: { rotulo: 'URGENTE', fundo: '#fef2f2', borda: '#dc2626', texto: '#991b1b' },
}

/** Vínculo em texto, já filtrado pelo lado (impedimento oculto não vai ao cliente). */
export function vinculoImediata(p: {
  lado: 'cliente' | 'interno'
  impedimento: ImpedimentoRow | null
  /** `codigo` = código exibido ("2.3"), nunca o numero interno. */
  atividade: { codigo: string | null; descricao: string } | null
}): string[] {
  const linhas: string[] = []
  if (p.atividade) linhas.push(p.atividade.codigo ? `Atividade ${p.atividade.codigo} · ${p.atividade.descricao}` : `Atividade: ${p.atividade.descricao}`)
  const i = p.impedimento
  if (i && (p.lado === 'interno' || i.exibirAoCliente)) {
    const mostraTipo = p.lado === 'interno' || i.responsavel === 'cliente' || i.responsavel === 'clima'
    const extras = [
      mostraTipo && i.tipo ? i.tipo : null,
      i.responsavel ? `responsável: ${RESP[i.responsavel] ?? i.responsavel}` : null,
      p.lado === 'interno' && !i.exibirAoCliente ? 'não exibido ao cliente' : null,
    ].filter(Boolean)
    linhas.push(`${i.categoria === 'orientacao' ? 'Orientação' : 'Impedimento'}: ${i.descricao}${extras.length ? ` (${extras.join(' · ')})` : ''}`)
  }
  return linhas
}

export function montarEmailImediata(p: {
  lado: 'cliente' | 'interno'
  loja: string
  data: string
  assunto: string
  texto: string
  nivel: NivelImediata
  vinculo: string[]
  enviadoPor: string
}): EmailSimples {
  const n = NIVEL[p.nivel]
  const interno = p.lado === 'interno' ? ' · INTERNO' : ''
  const assunto = `[${p.nivel === 'urgente' ? 'URGENTE' : 'Atenção'}] ${p.loja} · ${p.assunto}${p.lado === 'interno' ? ' · interno' : ''}`
  const destaque = `<tr><td style="background:${n.fundo};border-bottom:1px solid ${n.borda};padding:10px 20px;font-size:14px;color:${n.texto}"><b>${n.rotulo}</b> — ${esc(p.assunto)}</td></tr>`
  const corpo = [
    secao('Comunicação', paragrafos(p.texto)),
    p.vinculo.length ? secao('Referente a', p.vinculo.map(esc).join('<br>')) : '',
  ].join('\n')
  const html = moldura({
    faixa: `MANFAC · COMUNICAÇÃO IMEDIATA${interno}`,
    titulo: p.loja,
    subtitulo: dataBr(p.data),
    destaque,
    corpo,
    rodape: `Manfac Facilities · enviado por ${p.enviadoPor}.`,
  })
  const texto = [
    `MANFAC · COMUNICAÇÃO IMEDIATA${interno}`,
    p.loja,
    dataBr(p.data),
    '',
    `${n.rotulo} — ${p.assunto}`,
    '',
    p.texto,
    ...(p.vinculo.length ? ['', 'REFERENTE A', ...p.vinculo] : []),
  ].join('\n')
  return { assunto, html, texto }
}
