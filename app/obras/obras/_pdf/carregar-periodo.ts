/**
 * Lê do banco o que o relatório de período precisa (Leva 4 §2.1: mensal, fase,
 * entrega): obra na data de referência (o fim do período, ou hoje se ainda não
 * acabou), planos semanais (PPC), restrições, a linha de `obras_relatorio`, os
 * highlights automáticos e as fotos dos diários validados do período.
 *
 * Disponibilidade (rascunho): mensal a partir do 1º dia do mês (não antes do
 * mês da data-base); fase só com a etapa CONCLUÍDA; entrega só com a obra
 * concluída. Validado/enviado: período e conteúdo saem da linha congelada.
 *
 * O congelado é entrada não confiável: formato inválido = montado na hora;
 * foto só pelo id, re-resolvida contra os diários validados desta obra no
 * período (`fotos-periodo.ts`). `highlights` guarda só os ids DESMARCADOS e o
 * texto livre (o id carrega `numero` e nunca vai ao conteúdo do cliente: o
 * conteúdo leva só os textos).
 *
 * Quem chama já conferiu a sessão e o acesso; leituras pelo cliente da sessão
 * (RLS vale).
 */
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { periodoMensal, ultimoDiaUtilDoMes } from '../_lib/agenda'
import { highlightsDoPeriodo, type Highlight } from '../_lib/highlights'
import type { PlanoSemana, Restricao } from '../_lib/last-planner'
import { lerObraGrande, lerPlanos, lerRestricoes, type ObraGrande } from '../_lib/leitura'
import {
  conteudoPeriodoValido,
  etapasDaObra,
  montarConteudoPeriodo,
  type ConteudoPeriodo,
  type Lado,
  type TipoPeriodo,
} from '../_lib/relatorio-periodo'
import { logoManfac, registrarFontes } from './base'
import { baixarFotos, fotosDosIds, fotosElegiveisDoPeriodo, slug, type FotoRef } from './fotos-periodo'
import { DocumentoPeriodo, montarDadosPdfPeriodo, type DadosPdfPeriodo } from './periodo'
import { MAX_HIGHLIGHT_LIVRE } from '../[id]/comunicacao/relatorio/[tipo]/[referencia]/_tipos'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const MAX_FOTOS_PERIODO = 12
export { MAX_HIGHLIGHT_LIVRE }
const MAX_DESMARCADOS = 200

export type EstadoRelatorio = 'rascunho' | 'validado' | 'enviado'
/**
 * `obras_relatorio.highlights`: ids automáticos DESMARCADOS + o highlight livre.
 * Guardar os desmarcados faz o destaque que surgir depois (mensal do mês
 * corrente) entrar marcado — o engenheiro só desmarca.
 */
export type SelecaoHighlights = { desmarcados: string[]; livre: string | null }
/** `obras_relatorio.conteudo` (imutável depois da validação). `fotos` = ids de `obras_rdo_foto`. */
export type CongeladoPeriodo = { cliente: ConteudoPeriodo; interno: ConteudoPeriodo; fotos: string[] }
export type RelatorioRow = {
  id: string
  estado: EstadoRelatorio
  periodoInicio: string
  periodoFim: string
  observacoes: string | null
  highlights: SelecaoHighlights | null
  conteudo: CongeladoPeriodo | null
  validadoPor: string | null
  validadoEm: string | null
}

export type DadosPeriodo = {
  og: ObraGrande
  tipo: TipoPeriodo
  referencia: string
  inicio: string
  fim: string
  ref: string
  hoje: string
  planos: PlanoSemana[]
  restricoes: Restricao[]
  relatorio: RelatorioRow | null
  /** Highlights automáticos do período (ids só para a tela de rascunho). */
  automaticos: Highlight[]
}

type Falha = { ok: false; status: 404 | 500; erro: string }

export const TIPOS_PERIODO: readonly TipoPeriodo[] = ['mensal', 'fase', 'entrega']
const REFERENCIA: Record<TipoPeriodo, RegExp> = {
  mensal: /^\d{4}-(0[1-9]|1[0-2])$/,
  fase: /^(0|[1-9]\d{0,8})$/,
  entrega: /^entrega$/,
}

/** Tipo da lista e referência no formato exato do tipo (mesma regra do check do banco). */
export const relatorioValido = (tipo: unknown, referencia: unknown): tipo is TipoPeriodo =>
  typeof tipo === 'string' &&
  (TIPOS_PERIODO as readonly string[]).includes(tipo) &&
  typeof referencia === 'string' &&
  REFERENCIA[tipo as TipoPeriodo].test(referencia)

/** Todas as atividades concluídas (com fim real). */
export const obraConcluida = (og: ObraGrande): boolean => {
  const as = og.calc?.atividades ?? []
  return as.length > 0 && as.every((a) => a.status === 'concluido' && !!a.fimReal)
}

const minD = (a: string, b: string) => (a < b ? a : b)

/**
 * Último mês com mensal (agenda §2.2: "até o mês do término"): o do maior fim
 * real se a obra concluiu, senão o do término projetado; null sem cronograma.
 */
export function ultimoMesDoMensal(og: ObraGrande): string | null {
  if (obraConcluida(og)) return (og.calc?.atividades ?? []).map((a) => a.fimReal!).reduce((m, x) => (x > m ? x : m)).slice(0, 7)
  return og.calc?.terminoProjetado?.slice(0, 7) ?? null
}

/** Período do relatório ainda não validado, ou por que ele não está disponível. */
export function periodoDisponivel(
  og: ObraGrande,
  tipo: TipoPeriodo,
  referencia: string,
  hoje: string,
): { ok: true; inicio: string; fim: string } | { ok: false; erro: string } {
  const dataBase = (og.obra.data_base as string | null | undefined) ?? null
  if (!dataBase) return { ok: false, erro: 'A obra ainda não tem data-base do cronograma' }
  if (tipo === 'mensal') {
    if (referencia > hoje.slice(0, 7)) return { ok: false, erro: 'Este mês ainda não começou' }
    if (referencia < dataBase.slice(0, 7)) return { ok: false, erro: 'Mês anterior à data-base da obra' }
    const ultimo = ultimoMesDoMensal(og)
    if (ultimo && referencia > ultimo) return { ok: false, erro: 'Mês depois do término da obra' }
    const p = periodoMensal(referencia, dataBase, og.feriados)
    if (p.inicio > p.fim) return { ok: false, erro: 'Mês sem dia útil depois da data-base' }
    return { ok: true, ...p }
  }
  if (tipo === 'fase') {
    const e = etapasDaObra(og).find((x) => x.referencia === referencia)
    if (!e) return { ok: false, erro: 'Etapa não encontrada no cronograma vigente' }
    if (!e.concluida || !e.inicioReal || !e.fimReal) {
      return { ok: false, erro: 'Etapa ainda não concluída — o relatório de fase fica disponível na conclusão' }
    }
    return { ok: true, inicio: minD(e.inicioReal, e.fimReal), fim: e.fimReal }
  }
  if (!obraConcluida(og)) return { ok: false, erro: 'Obra ainda não concluída — o relatório de entrega fica disponível na conclusão' }
  const fim = (og.calc?.atividades ?? []).map((a) => a.fimReal!).reduce((m, x) => (x > m ? x : m))
  return { ok: true, inicio: minD(dataBase, fim), fim }
}

/**
 * Primeiro dia em que o relatório pode ser VALIDADO (o rascunho sai a qualquer
 * hora): o mensal só a partir da data da agenda — último dia útil do mês, com
 * os feriados da obra —, para não congelar meio mês como se fosse o mês todo.
 * Fase e entrega já só existem depois da conclusão: null.
 */
export const validacaoLiberadaEm = (og: ObraGrande, tipo: TipoPeriodo, referencia: string): string | null =>
  tipo === 'mensal' ? ultimoDiaUtilDoMes(referencia, og.feriados) : null

function selecaoDe(v: unknown): SelecaoHighlights | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const x = v as Record<string, unknown>
  const m = x.desmarcados
  if (!Array.isArray(m) || m.length > MAX_DESMARCADOS || !m.every((i) => typeof i === 'string' && i.length <= 200)) return null
  const livre = x.livre
  if (livre !== null && livre !== undefined && !(typeof livre === 'string' && livre.length <= MAX_HIGHLIGHT_LIVRE)) return null
  return { desmarcados: m as string[], livre: typeof livre === 'string' && livre.trim() ? livre.trim() : null }
}

function congeladoDe(v: unknown, tipo: TipoPeriodo, referencia: string): CongeladoPeriodo | null {
  if (typeof v !== 'object' || v === null) return null
  const c = v as Record<string, unknown>
  const fotos = c.fotos
  if (!Array.isArray(fotos) || fotos.length > MAX_FOTOS_PERIODO || !fotos.every((f) => typeof f === 'string')) return null
  const esperado = { tipo, referencia }
  if (!conteudoPeriodoValido(c.cliente, 'cliente', esperado) || !conteudoPeriodoValido(c.interno, 'interno', esperado)) return null
  return { cliente: c.cliente, interno: c.interno, fotos: fotos as string[] }
}

export const relatorioRowDe = (r: Linha, tipo: TipoPeriodo, referencia: string): RelatorioRow => ({
  id: String(r.id),
  estado: r.estado,
  periodoInicio: String(r.periodo_inicio),
  periodoFim: String(r.periodo_fim),
  observacoes: r.observacoes ?? null,
  highlights: selecaoDe(r.highlights),
  conteudo: congeladoDe(r.conteudo, tipo, referencia),
  validadoPor: r.validado_por ?? null,
  validadoEm: r.validado_em ?? null,
})

/** `og` opcional: a página passa a leitura de hoje já memorizada. */
export async function lerDadosPeriodo(
  supabase: SupabaseClient,
  obraId: string,
  tipo: string,
  referencia: string,
  hoje: string,
  og?: ObraGrande,
): Promise<{ ok: true; dados: DadosPeriodo } | Falha> {
  if (!relatorioValido(tipo, referencia)) return { ok: false, status: 404, erro: 'Relatório inválido' }
  let obra = og
  if (!obra) {
    const lida = await lerObraGrande(supabase, obraId, hoje)
    if (!lida.ok) return { ok: false, status: 404, erro: lida.erro }
    obra = lida.dados
  }
  if (obra.obra.modalidade !== 'obra') return { ok: false, status: 404, erro: 'Obra não encontrada' }
  // O id da obra vem da leitura pela sessão (RLS), não do navegador.
  const id = String(obra.obra.id)

  const [plR, rR, relR] = await Promise.all([
    lerPlanos(supabase, id),
    lerRestricoes(supabase, id),
    supabase.from('obras_relatorio').select('*').eq('obra_id', id).eq('tipo', tipo).eq('referencia', referencia).maybeSingle(),
  ])
  if (!plR.ok || !rR.ok || relR.error) return { ok: false, status: 500, erro: 'Não deu para ler os dados do relatório' }
  const relatorio = relR.data ? relatorioRowDe(relR.data as Linha, tipo, referencia) : null
  // Congelado é entrada não confiável: inválido não é remontado com os dados de hoje.
  if (relatorio && relatorio.estado !== 'rascunho' && !relatorio.conteudo) {
    return { ok: false, status: 500, erro: 'Conteúdo do relatório inválido; fale com o administrador.' }
  }

  let inicio: string
  let fim: string
  if (relatorio && relatorio.estado !== 'rascunho') {
    inicio = relatorio.periodoInicio
    fim = relatorio.periodoFim
  } else {
    const p = periodoDisponivel(obra, tipo, referencia, hoje)
    if (!p.ok) return { ok: false, status: 404, erro: p.erro }
    ;({ inicio, fim } = p)
  }
  const ref = fim < hoje ? fim : hoje
  if (ref !== hoje && (!relatorio || relatorio.estado === 'rascunho')) {
    const lida = await lerObraGrande(supabase, id, ref)
    if (!lida.ok) return { ok: false, status: 404, erro: lida.erro }
    obra = lida.dados
  }
  return {
    ok: true,
    dados: {
      og: obra, tipo, referencia, inicio, fim, ref, hoje,
      planos: plR.planos, restricoes: rR.restricoes, relatorio,
      automaticos: highlightsDoPeriodo({ obra, inicio, fim, ref, planos: plR.planos }),
    },
  }
}

/** Automáticos menos os desmarcados (sem seleção salva: todos), mais o livre. */
export function textosDosHighlights(automaticos: Highlight[], sel: SelecaoHighlights | null): string[] {
  const fora = new Set(sel?.desmarcados ?? [])
  return [...automaticos.filter((h) => !fora.has(h.id)).map((h) => h.texto), ...(sel?.livre ? [sel.livre] : [])]
}

/** Validado/enviado com congelado válido: o congelado. Senão: montado agora dos dados lidos. */
export const conteudoPeriodoDe = (d: DadosPeriodo, lado: Lado): ConteudoPeriodo =>
  (d.relatorio && d.relatorio.estado !== 'rascunho' && d.relatorio.conteudo?.[lado]) ||
  montarConteudoPeriodo({
    lado, tipo: d.tipo, referencia: d.referencia, obra: d.og, inicio: d.inicio, fim: d.fim, ref: d.ref, hoje: d.hoje,
    planos: d.planos, restricoes: d.restricoes,
    highlights: textosDosHighlights(d.automaticos, d.relatorio?.highlights ?? null),
    observacoes: d.relatorio?.observacoes ?? null,
  })

/** Até `max` fotos espalhadas pelo período (a primeira e a última sempre entram). */
export function amostraDeFotos(fotos: FotoRef[], max: number): FotoRef[] {
  if (fotos.length <= max) return fotos
  const idx = new Set(Array.from({ length: max }, (_, i) => Math.round((i * (fotos.length - 1)) / (max - 1))))
  return [...idx].map((i) => fotos[i])
}

/** Conteúdo a congelar na validação (`d` lido em rascunho): as duas versões e as fotos escolhidas agora. */
export async function congelarPeriodo(supabase: SupabaseClient, d: DadosPeriodo): Promise<CongeladoPeriodo> {
  const elegiveis = await fotosElegiveisDoPeriodo(supabase, String(d.og.obra.id), d.inicio, d.fim)
  return {
    cliente: conteudoPeriodoDe(d, 'cliente'),
    interno: conteudoPeriodoDe(d, 'interno'),
    fotos: amostraDeFotos(elegiveis, MAX_FOTOS_PERIODO).map((f) => f.id),
  }
}

/** Nome do PDF — sem `numero` (a fase sai pela data de conclusão). */
const nomeArquivo = (d: DadosPeriodo, loja: string) =>
  `${d.tipo}-${slug(loja)}${d.tipo === 'mensal' ? `-${d.referencia}` : d.tipo === 'fase' ? `-${d.fim}` : ''}.pdf`

/** Dados do PDF (lado cliente) a partir da leitura do relatório. */
export async function dadosPdfPeriodo(
  supabase: SupabaseClient,
  d: DadosPeriodo,
  agora: Date = new Date(),
): Promise<{ dados: DadosPdfPeriodo; nomeArquivo: string }> {
  const obraId = String(d.og.obra.id)
  const elegiveis = await fotosElegiveisDoPeriodo(supabase, obraId, d.inicio, d.fim)
  const ids = d.relatorio && d.relatorio.estado !== 'rascunho' ? d.relatorio.conteudo?.fotos : undefined
  const refs = ids ? fotosDosIds(ids, elegiveis, MAX_FOTOS_PERIODO) : amostraDeFotos(elegiveis, MAX_FOTOS_PERIODO)
  const { fotos, omitidas } = await baixarFotos(obraId, refs, MAX_FOTOS_PERIODO, 'pdf-periodo')
  const conteudo = conteudoPeriodoDe(d, 'cliente')
  const dados = montarDadosPdfPeriodo({
    conteudo,
    os: d.og.obra.os ?? null,
    cliente: d.og.obra.cliente ?? null,
    engenheiro: d.og.obra.engenheiro_email ?? null,
    validadoEm: d.relatorio?.validadoEm ?? null,
    fotos,
    fotosOmitidas: omitidas,
    geradoEm: agora.toISOString(),
    logo: logoManfac(),
  })
  return { dados, nomeArquivo: nomeArquivo(d, conteudo.loja) }
}

/** PDF de um relatório validado/enviado (rascunho nunca vira PDF). */
export async function carregarPdfPeriodo(
  supabase: SupabaseClient,
  obraId: string,
  tipo: string,
  referencia: string,
  hoje: string,
  agora: Date = new Date(),
): Promise<{ ok: true; dados: DadosPdfPeriodo; nomeArquivo: string } | Falha> {
  const l = await lerDadosPeriodo(supabase, obraId, tipo, referencia, hoje)
  if (!l.ok) return l
  const e = l.dados.relatorio?.estado
  if (e !== 'validado' && e !== 'enviado') return { ok: false, status: 404, erro: 'Relatório não validado' }
  return { ok: true, ...(await dadosPdfPeriodo(supabase, l.dados, agora)) }
}

export async function renderizarPeriodo(d: DadosPdfPeriodo): Promise<Buffer> {
  registrarFontes()
  return renderToBuffer(createElement(DocumentoPeriodo, { d }) as Parameters<typeof renderToBuffer>[0])
}
