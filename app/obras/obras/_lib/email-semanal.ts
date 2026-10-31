/**
 * Relatório semanal da OBRA (Leva 3 §2.3). Puro: monta o conteúdo da semana
 * (segunda a sexta) por lado — fonte única do e-mail, do PDF (`_pdf/semanal.tsx`)
 * e do resumo que vai para a IA (`resumoParaIa`, só lado cliente).
 *
 * Lado cliente NUNCA mostra valor/peso (R$), impedimento com
 * `exibirAoCliente = false` nem a área interna da Manfac (causa material/equipe
 * aparece só como "Manfac"). Restrição liberada não aparece.
 */
import { CAUSA } from './causas'
import { dataBr, pct, type ItemDiario, type SinalVisual } from './email-diario'
import { diasDaSemana, ppc, type PlanoSemana, type Restricao } from './last-planner'
import type { ObraGrande } from './leitura'
import type { Responsavel } from './cronograma'
import { esc, ISO, lista, nums, obj, str, strOuNull, strs } from './conteudo-valido'
import { caixa, documentoEmail, htmlDoCliente, linha, secao, texto, vazio } from './email-html'
import { blocosDoPeriodo, blocosValidos, ddmm, type Lado } from './relatorio-periodo'

export type { Lado } from './relatorio-periodo'

export type NaoCumpridoSemanal = { descricao: string; meta: string; final: string; causa: string | null; responsavel: string | null }

export type ConteudoSemanal = {
  lado: Lado
  loja: string
  assunto: string
  titulo: string
  subtitulo: string
  segunda: string
  sexta: string
  sinal: SinalVisual
  /** `ate`: "a sexta", ou "dd/mm/aaaa" quando a semana ainda não acabou. */
  avanco: { previsto: string; realizado: string; desvio: string; ate: string }
  previsao: string
  /** null = sem plano fechado para a semana. `valor` "—" = plano sem avaliação. */
  ppc: { valor: string; cumpridos: number; avaliados: number; planejados: number } | null
  naoCumpridos: NaoCumpridoSemanal[]
  concluidas: { descricao: string; fim: string }[]
  emAndamento: { descricao: string; percentual: string; termino: string }[]
  /** Plano da próxima semana (só se já fechado). */
  proximaSemana: { descricao: string; meta: string }[] | null
  doCliente: { descricao: string; atividade: string; tipo: string; prazo: string | null; vencida: boolean }[]
  impedimentos: ItemDiario[]
  /** Só no interno: impedimentos da semana com `exibirAoCliente = false`. */
  ocultos: ItemDiario[]
  observacoes: string | null
}

const RESP: Record<Responsavel, string> = { cliente: 'Cliente', manfac: 'Manfac', terceiro: 'Terceiro', clima: 'Clima' }

export function montarConteudoSemanal(p: {
  lado: Lado
  obra: ObraGrande
  segunda: string
  /** Data de referência: a sexta, ou hoje se a semana ainda não acabou. */
  ref: string
  hoje: string
  plano: PlanoSemana | null
  planoProximo: PlanoSemana | null
  restricoes: Restricao[]
  observacoes: string | null
}): ConteudoSemanal {
  const { lado, obra: og, segunda, ref } = p
  const sexta = diasDaSemana(segunda)[4]
  const b = blocosDoPeriodo({ lado, obra: og, inicio: segunda, fim: sexta, ref, hoje: p.hoje, restricoes: p.restricoes })
  const { loja, descricao } = b
  const interno = lado === 'interno'

  const assunto = `Relatório semanal · ${loja} · ${ddmm(segunda)} a ${dataBr(sexta)}${interno ? ' · interno' : ''}`
  const titulo = `${loja} — semana de ${ddmm(segunda)} a ${ddmm(sexta)}`
  const subtitulo = `Segunda ${dataBr(segunda)} a sexta ${dataBr(sexta)}${ref < sexta ? ` · dados até ${dataBr(ref)}` : ''}`
  const avanco = { ...b.avanco, ate: ref < sexta ? dataBr(ref) : 'a sexta' }

  // PPC e não cumpridos. Ao cliente, causa da Manfac aparece só como "Manfac".
  const itens = p.plano?.itens ?? []
  const avaliados = itens.filter((i) => i.cumprido !== null)
  const v = ppc(itens)
  const ppcSemana = p.plano
    ? { valor: v === null ? '—' : pct(v), cumpridos: avaliados.filter((i) => i.cumprido).length, avaliados: avaliados.length, planejados: itens.length }
    : null
  const naoCumpridos = itens
    .filter((i) => i.cumprido === false)
    .sort((a, b) => a.numero - b.numero)
    .map((i): NaoCumpridoSemanal => {
      const c = i.causa ? CAUSA[i.causa] : null
      return {
        descricao: descricao(i.numero),
        meta: pct(i.metaPercentual),
        final: i.percentualFinal === null ? '—' : pct(i.percentualFinal),
        causa: !c ? null : !interno && c.resp === 'manfac' ? null : c.rotulo,
        responsavel: c?.resp ? RESP[c.resp] : null,
      }
    })

  const proximaSemana = p.planoProximo
    ? [...p.planoProximo.itens].sort((a, b) => a.numero - b.numero).map((i) => ({ descricao: descricao(i.numero), meta: pct(i.metaPercentual) }))
    : null

  return {
    lado, loja, assunto, titulo, subtitulo, segunda, sexta,
    sinal: b.sinal,
    avanco,
    previsao: b.previsao,
    ppc: ppcSemana, naoCumpridos, concluidas: b.concluidas, emAndamento: b.emAndamento, proximaSemana,
    doCliente: b.doCliente, impedimentos: b.impedimentos, ocultos: b.ocultos,
    observacoes: p.observacoes?.trim() || null,
  }
}

// ---- Conteúdo congelado (obras_semanal.conteudo) --------------------------
// O engenheiro pode gravar o jsonb direto pela API na validação: o congelado é
// entrada não confiável. Só é usado se tiver exatamente o formato abaixo e o
// sinal for um dos três visuais canônicos; senão, quem chama monta na hora.

/** true só se `v` tem o formato de ConteudoSemanal do `lado` (sinal canônico; cliente sem ocultos). */
export function conteudoSemanalValido(v: unknown, lado: Lado): v is ConteudoSemanal {
  if (!obj(v) || !blocosValidos(v, lado)) return false
  if (!ISO.test(String(v.segunda)) || !ISO.test(String(v.sexta))) return false
  const p = v.ppc
  if (p !== null && !(obj(p) && str(p.valor) && nums(p.cumpridos) && nums(p.avaliados) && nums(p.planejados))) return false
  if (!lista(v.naoCumpridos, (x) => strs(x, 'descricao', 'meta', 'final') && strOuNull(x.causa) && strOuNull(x.responsavel))) return false
  return v.proximaSemana === null || lista(v.proximaSemana, (x) => strs(x, 'descricao', 'meta'))
}

/** Linhas de texto das seções de dados (sem as observações) — e-mail em texto e resumo da IA. */
function linhasDeDados(c: ConteudoSemanal): string[] {
  const ppcTxt = c.ppc
    ? `PPC da semana: ${c.ppc.valor} (${c.ppc.cumpridos} de ${c.ppc.avaliados} itens avaliados cumpridos; ${c.ppc.planejados} planejados)`
    : 'PPC da semana: sem plano fechado'
  return [
    `${c.sinal.rotulo} — ${c.avanco.desvio}.`,
    `Avanço até ${c.avanco.ate}: previsto ${c.avanco.previsto} · realizado ${c.avanco.realizado}`,
    c.previsao,
    '',
    ppcTxt,
    ...(c.naoCumpridos.length
      ? ['NÃO CUMPRIDOS NO PLANO', ...c.naoCumpridos.map((n) => `- ${n.descricao} (meta ${n.meta}, chegou a ${n.final})${causaTxt(n)}`)]
      : []),
    '',
    'CONCLUÍDAS NA SEMANA',
    ...(c.concluidas.length ? c.concluidas.map((a) => `- ${a.descricao} — ${a.fim}`) : ['Nenhuma.']),
    '',
    'EM ANDAMENTO',
    ...(c.emAndamento.length ? c.emAndamento.map((a) => `- ${a.descricao}: ${a.percentual}, término previsto ${a.termino}`) : ['Nenhuma.']),
    '',
    'PROGRAMAÇÃO DA PRÓXIMA SEMANA',
    ...(c.proximaSemana === null
      ? ['Plano da próxima semana ainda não fechado.']
      : c.proximaSemana.length
        ? c.proximaSemana.map((i) => `- ${i.descricao} — meta ${i.meta}`)
        : ['Nenhuma atividade no plano.']),
    '',
    'DEPENDEM DO CLIENTE',
    ...(c.doCliente.length
      ? c.doCliente.map((r) => `- ${r.descricao} (${r.tipo}; atividade ${r.atividade})${r.prazo ? ` — prazo ${r.prazo}${r.vencida ? ', vencido' : ''}` : ''}`)
      : ['Nada pendente com o cliente.']),
    '',
    'IMPEDIMENTOS DA SEMANA',
    ...(c.impedimentos.length ? c.impedimentos.map((i) => `- ${i.rotulo}: ${i.corpo}`) : ['Nenhum.']),
    ...(c.ocultos.length ? ['', 'SÓ INTERNO · NÃO FOI AO CLIENTE', ...c.ocultos.map((i) => `- ${i.rotulo}: ${i.corpo}`)] : []),
  ]
}

const causaTxt = (n: NaoCumpridoSemanal) => {
  const partes = [n.causa ? `causa: ${n.causa}` : null, n.responsavel ? `responsável: ${n.responsavel}` : null].filter(Boolean)
  return partes.length ? ` — ${partes.join(' · ')}` : ''
}

/**
 * Resumo da semana para a IA: SÓ o conteúdo do lado cliente (sem R$, sem
 * oculto, sem área interna) e sem as observações atuais.
 */
export function resumoParaIa(c: ConteudoSemanal): string {
  if (c.lado !== 'cliente') throw new Error('Resumo da IA só sai do conteúdo do cliente')
  return [`Obra: ${c.loja}`, `Semana: ${dataBr(c.segunda)} a ${dataBr(c.sexta)}`, '', ...linhasDeDados(c)].join('\n')
}

export function montarEmailSemanal(c: ConteudoSemanal, p: { fotos: number }): { assunto: string; html: string; texto: string } {
  const interno = c.lado === 'interno'
  const notaFotos = p.fotos ? `${p.fotos} ${p.fotos === 1 ? 'foto da semana' : 'fotos da semana'} no PDF anexo.` : null

  const corpo = [
    secao(
      'Plano da semana',
      (c.ppc
        ? `<div style="font-size:14px;color:#0f172a;margin-bottom:6px">${esc(`${c.ppc.cumpridos} de ${c.ppc.avaliados} itens avaliados cumpridos (${c.ppc.planejados} planejados)`)}</div>`
        : vazio('Sem plano fechado para esta semana.')) +
        c.naoCumpridos.map((n) => linha(`Não cumprido: ${n.descricao} (meta ${n.meta}, chegou a ${n.final})${causaTxt(n)}`, '#f59e0b')).join(''),
    ),
    secao('Concluídas na semana', c.concluidas.length ? c.concluidas.map((a) => linha(`${a.descricao} — ${a.fim}`)).join('') : vazio('Nenhuma atividade concluída na semana.')),
    secao('Em andamento', c.emAndamento.length ? c.emAndamento.map((a) => linha(`${a.descricao}: ${a.percentual} · término previsto ${a.termino}`, '#2563eb')).join('') : vazio('Nenhuma atividade em andamento.')),
    secao(
      'Programação da próxima semana',
      c.proximaSemana === null
        ? vazio('Plano da próxima semana ainda não fechado.')
        : c.proximaSemana.length
          ? c.proximaSemana.map((i) => linha(`${i.descricao} — meta ${i.meta}`, '#00345e')).join('')
          : vazio('Nenhuma atividade no plano.'),
    ),
    secao('Dependem do cliente', htmlDoCliente(c.doCliente)),
    secao('Impedimentos da semana', c.impedimentos.length ? c.impedimentos.map((i) => caixa(i, '#dc2626', '#fef2f2')).join('') : vazio('Nenhum impedimento na semana.')),
    c.ocultos.length ? secao('Só interno · Não foi ao cliente', c.ocultos.map((i) => caixa(i, '#dc2626', '#fef2f2')).join('')) : '',
    secao('Observações da engenharia', c.observacoes ? texto(c.observacoes) : vazio('Sem observações.')),
    notaFotos ? secao('Fotos', vazio(notaFotos)) : '',
  ].join('\n')

  const html = documentoEmail({
    assunto: c.assunto, faixa: 'RELATÓRIO SEMANAL', interno, titulo: c.titulo, subtitulo: c.subtitulo,
    sinal: c.sinal, desvio: c.avanco.desvio, previsao: c.previsao,
    numeros: [
      [c.avanco.previsto, `previsto até ${c.avanco.ate}`],
      [c.avanco.realizado, 'realizado'],
      [c.ppc?.valor ?? '—', 'PPC da semana'],
    ],
    corpo,
    rodape: 'Manfac Facilities · relatório semanal da obra.',
  })

  const textoPlano = [
    `MANFAC · RELATÓRIO SEMANAL${interno ? ' · INTERNO' : ''}`,
    c.titulo,
    c.subtitulo,
    '',
    ...linhasDeDados(c),
    '',
    'OBSERVAÇÕES DA ENGENHARIA',
    c.observacoes ?? 'Sem observações.',
    ...(notaFotos ? ['', notaFotos] : []),
  ].join('\n')
  return { assunto: c.assunto, html, texto: textoPlano }
}
