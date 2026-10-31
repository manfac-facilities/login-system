/**
 * E-mail (HTML + texto) e resumo para a IA do relatório de período (Leva 4
 * §2.1: mensal, fase, entrega). Puro, a partir de `ConteudoPeriodo` — montado
 * na hora (rascunho) ou o congelado já validado por `conteudoPeriodoValido`.
 * Todo texto é escapado (`email-html.ts`). A curva S vai só no PDF anexo.
 */
import { dataBr } from './email-diario'
import { caixa, documentoEmail, htmlDoCliente, linha, secao, texto, vazio } from './email-html'
import { linkDoLado, textoLinkObra } from './link-portal'
import type { ConteudoPeriodo, TipoPeriodo } from './relatorio-periodo'

const FAIXA: Record<TipoPeriodo, string> = { mensal: 'RELATÓRIO MENSAL', fase: 'RELATÓRIO DE FASE', entrega: 'RELATÓRIO DE ENTREGA' }
const RODAPE: Record<TipoPeriodo, string> = {
  mensal: 'Manfac Facilities · relatório mensal da obra.',
  fase: 'Manfac Facilities · relatório de fase da obra.',
  entrega: 'Manfac Facilities · relatório de entrega da obra.',
}

const marcoTxt = (m: ConteudoPeriodo['marcos'][number]) =>
  `Etapa ${m.etapa} — concluída em ${m.real}${m.base ? ` (base ${m.base}${m.desvio ? `, ${m.desvio}` : ''})` : ''}`
const ppcTxt = (c: ConteudoPeriodo) =>
  c.ppc ? `PPC médio do período: ${c.ppc.valor} (${c.ppc.semanas} ${c.ppc.semanas === 1 ? 'semana avaliada' : 'semanas avaliadas'})` : 'PPC médio do período: sem semana avaliada'

/** Linhas de texto das seções de dados (sem as observações) — e-mail em texto e resumo da IA. */
function linhasDeDados(c: ConteudoPeriodo): string[] {
  return [
    `${c.sinal.rotulo} — ${c.avanco.desvio}.`,
    `Avanço até ${c.avanco.ate}: previsto ${c.avanco.previsto} · realizado ${c.avanco.realizado}`,
    c.previsao,
    ppcTxt(c),
    ...(c.comparativo
      ? ['', 'COMPARATIVO BASE × FINAL', `Término na base: ${c.comparativo.base ?? 'sem base'} · término final: ${c.comparativo.final}`, c.comparativo.atraso]
      : []),
    ...(c.highlights.length ? ['', 'DESTAQUES DO PERÍODO', ...c.highlights.map((h) => `- ${h}`)] : []),
    ...(c.marcos.length ? ['', 'MARCOS DO PERÍODO', ...c.marcos.map((m) => `- ${marcoTxt(m)}`)] : []),
    '',
    'CONCLUÍDAS NO PERÍODO',
    ...(c.concluidas.length ? c.concluidas.map((a) => `- ${a.descricao} — ${a.fim}`) : ['Nenhuma.']),
    '',
    'EM ANDAMENTO',
    ...(c.emAndamento.length ? c.emAndamento.map((a) => `- ${a.descricao}: ${a.percentual}, término previsto ${a.termino}`) : ['Nenhuma.']),
    '',
    'DEPENDEM DO CLIENTE',
    ...(c.doCliente.length
      ? c.doCliente.map((r) => `- ${r.descricao} (${r.tipo}; atividade ${r.atividade})${r.prazo ? ` — prazo ${r.prazo}${r.vencida ? ', vencido' : ''}` : ''}`)
      : ['Nada pendente com o cliente.']),
    '',
    'IMPEDIMENTOS DO PERÍODO',
    ...(c.impedimentos.length ? c.impedimentos.map((i) => `- ${i.rotulo}: ${i.corpo}`) : ['Nenhum.']),
    ...(c.ocultos.length ? ['', 'SÓ INTERNO · NÃO FOI AO CLIENTE', ...c.ocultos.map((i) => `- ${i.rotulo}: ${i.corpo}`)] : []),
  ]
}

/** Resumo para a IA: SÓ o conteúdo do lado cliente e sem as observações atuais. */
export function resumoPeriodoParaIa(c: ConteudoPeriodo): string {
  if (c.lado !== 'cliente') throw new Error('Resumo da IA só sai do conteúdo do cliente')
  return [`Obra: ${c.loja}`, `${c.titulo}`, `Período: ${dataBr(c.inicio)} a ${dataBr(c.fim)}`, '', ...linhasDeDados(c)].join('\n')
}

export function montarEmailPeriodo(c: ConteudoPeriodo, p: { fotos: number; linkObra?: string | null }): { assunto: string; html: string; texto: string } {
  const interno = c.lado === 'interno'
  const notaFotos = p.fotos ? `${p.fotos} ${p.fotos === 1 ? 'foto do período' : 'fotos do período'} no PDF anexo.` : null

  const corpo = [
    c.comparativo
      ? secao(
          'Comparativo base × final',
          linha(`Término na base: ${c.comparativo.base ?? 'sem base'} · término final: ${c.comparativo.final}`, '#00345e') +
            linha(c.comparativo.atraso, '#00345e'),
        )
      : '',
    c.highlights.length ? secao('Destaques do período', c.highlights.map((h) => linha(h, '#b94606')).join('')) : '',
    c.marcos.length ? secao('Marcos do período', c.marcos.map((m) => linha(marcoTxt(m))).join('')) : '',
    secao('Concluídas no período', c.concluidas.length ? c.concluidas.map((a) => linha(`${a.descricao} — ${a.fim}`)).join('') : vazio('Nenhuma atividade concluída no período.')),
    secao('Em andamento', c.emAndamento.length ? c.emAndamento.map((a) => linha(`${a.descricao}: ${a.percentual} · término previsto ${a.termino}`, '#2563eb')).join('') : vazio('Nenhuma atividade em andamento.')),
    secao('Dependem do cliente', htmlDoCliente(c.doCliente)),
    secao('Impedimentos do período', c.impedimentos.length ? c.impedimentos.map((i) => caixa(i, '#dc2626', '#fef2f2')).join('') : vazio('Nenhum impedimento no período.')),
    c.ocultos.length ? secao('Só interno · Não foi ao cliente', c.ocultos.map((i) => caixa(i, '#dc2626', '#fef2f2')).join('')) : '',
    secao('Observações da engenharia', c.observacoes ? texto(c.observacoes) : vazio('Sem observações.')),
    notaFotos ? secao('Fotos', vazio(notaFotos)) : '',
  ]
    .filter(Boolean)
    .join('\n')

  const html = documentoEmail({
    assunto: c.assunto, faixa: FAIXA[c.tipo], interno, titulo: c.titulo, subtitulo: c.subtitulo,
    sinal: c.sinal, desvio: c.avanco.desvio, previsao: c.previsao,
    numeros: [
      [c.avanco.previsto, `previsto até ${c.avanco.ate}`],
      [c.avanco.realizado, 'realizado'],
      [c.ppc?.valor ?? '—', 'PPC médio'],
    ],
    corpo,
    rodape: RODAPE[c.tipo],
    linkObra: linkDoLado(c.lado, p.linkObra),
  })

  const textoPlano = [
    `MANFAC · ${FAIXA[c.tipo]}${interno ? ' · INTERNO' : ''}`,
    c.titulo,
    c.subtitulo,
    '',
    ...linhasDeDados(c),
    '',
    'OBSERVAÇÕES DA ENGENHARIA',
    c.observacoes ?? 'Sem observações.',
    ...(notaFotos ? ['', notaFotos] : []),
    ...textoLinkObra(linkDoLado(c.lado, p.linkObra)),
  ].join('\n')
  return { assunto: c.assunto, html, texto: textoPlano }
}
