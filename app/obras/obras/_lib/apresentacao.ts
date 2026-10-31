/**
 * Apresentação ao cliente (Leva 4 §2.4). Puro: parâmetros da query string,
 * período e o conteúdo dos blocos. Sempre a versão CLIENTE — nada de R$,
 * impedimento oculto, área interna nem `numero` (só o código exibido).
 *
 * Bloco sem dado some (`blocos` só lista os que têm conteúdo); nenhum valor do
 * conteúdo é NaN/Infinity. Não grava nada.
 */
import { lookahead, segundaDaSemana, type PlanoSemana, type Restricao } from './last-planner'
import { codigosDeAtividades } from './cronograma'
import type { ObraGrande } from './leitura'
import { dataBr } from './email-diario'
import { montarConteudoPeriodo, type ConteudoPeriodo, type PontoCurva } from './relatorio-periodo'
import { linhasDeEtapa, type LinhaEtapa } from '../_ui/evolucao-etapas'

export const BLOCOS = ['capa', 'resumo', 'curva', 'cronograma', 'marcos', 'fotos', 'impedimentos', 'ppc', 'proximos'] as const
export type BlocoId = (typeof BLOCOS)[number]
export const ROTULO_BLOCO: Record<BlocoId, string> = {
  capa: 'Capa',
  resumo: 'Resumo e sinal',
  curva: 'Avanço e curva S',
  cronograma: 'Cronograma por etapa',
  marcos: 'Marcos e destaques',
  fotos: 'Fotos',
  impedimentos: 'Impedimentos e "Aguardando vocês"',
  ppc: 'PPC (cumprimento do planejado)',
  proximos: 'Próximos passos (3 semanas)',
}

export const PRESETS = ['semana', 'mes', 'inicio', 'custom'] as const
export type Preset = (typeof PRESETS)[number]
export const ROTULO_PRESET: Record<Preset, string> = {
  semana: 'Esta semana',
  mes: 'Este mês',
  inicio: 'Desde o início',
  custom: 'Personalizado',
}
export const MAX_FOTOS_APRESENTACAO = 12
const ID_FOTO = /^[A-Za-z0-9-]{1,64}$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DIAS = 3660

export type ParamsApresentacao = {
  preset: Preset
  de: string | null
  ate: string | null
  /** `f=1` na query: o formulário foi enviado (blocos e fotos exatamente como marcados). */
  enviado: boolean
  blocos: BlocoId[]
  /** Ids de `obras_rdo_foto` pedidos (até 12, formato estrito); `null` = sem escolha (padrão: amostra). */
  fotos: string[] | null
}

type Query = Record<string, string | string[] | undefined> | URLSearchParams

const um = (q: Query, k: string): string | undefined => {
  if (q instanceof URLSearchParams) return q.get(k) ?? undefined
  const v = q[k]
  return Array.isArray(v) ? v[0] : v
}
const MAX_CHARS = 2000
const MAX_PEDACOS = 64
const varios = (q: Query, k: string): string[] => {
  const brutos = q instanceof URLSearchParams ? q.getAll(k) : q[k] === undefined ? [] : Array.isArray(q[k]) ? (q[k] as string[]) : [q[k] as string]
  return brutos.slice(0, 4).flatMap((x) => x.slice(0, MAX_CHARS).split(',', MAX_PEDACOS))
}

/** Data ISO real (rejeita 2026-02-31). */
export const dataIsoValida = (s: string | null | undefined): s is string => {
  if (!s || !ISO_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Query string → parâmetros validados (valor desconhecido cai no padrão; nunca lança). */
export function lerParams(q: Query): ParamsApresentacao {
  const p = um(q, 'periodo')
  const preset: Preset = (PRESETS as readonly string[]).includes(p ?? '') ? (p as Preset) : 'mes'
  const de = um(q, 'de')
  const ate = um(q, 'ate')
  const enviado = um(q, 'f') === '1'
  const pedidos = new Set(varios(q, 'blocos'))
  const blocos = enviado ? BLOCOS.filter((b) => pedidos.has(b)) : [...BLOCOS]
  const ids = [...new Set(varios(q, 'fotos').filter((i) => ID_FOTO.test(i)))].slice(0, MAX_FOTOS_APRESENTACAO)
  return {
    preset,
    de: dataIsoValida(de) ? de : null,
    ate: dataIsoValida(ate) ? ate : null,
    enviado,
    blocos,
    fotos: enviado || ids.length ? ids : null,
  }
}

/** Query string canônica dos parâmetros (para o link do PDF e da tela cheia). */
export function paramsParaQuery(p: ParamsApresentacao, fotos: string[]): string {
  const u = new URLSearchParams()
  u.set('periodo', p.preset)
  if (p.preset === 'custom') {
    if (p.de) u.set('de', p.de)
    if (p.ate) u.set('ate', p.ate)
  }
  u.set('f', '1')
  if (p.blocos.length) u.set('blocos', p.blocos.join(','))
  if (fotos.length) u.set('fotos', fotos.join(','))
  return u.toString()
}

const dias = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** Período [inicio, fim] do preset (esta semana = segunda..hoje; este mês = dia 1..hoje; início = data-base..hoje). */
export function periodoDaApresentacao(
  p: Pick<ParamsApresentacao, 'preset' | 'de' | 'ate'>,
  hoje: string,
  dataBase: string | null,
): { ok: true; inicio: string; fim: string } | { ok: false; erro: string } {
  if (p.preset === 'semana') return { ok: true, inicio: segundaDaSemana(hoje), fim: hoje }
  if (p.preset === 'mes') return { ok: true, inicio: `${hoje.slice(0, 7)}-01`, fim: hoje }
  if (p.preset === 'inicio') {
    if (!dataBase) return { ok: false, erro: 'A obra ainda não tem data-base do cronograma' }
    return { ok: true, inicio: dataBase <= hoje ? dataBase : hoje, fim: hoje }
  }
  if (!p.de || !p.ate) return { ok: false, erro: 'Informe as duas datas do período' }
  if (p.de > p.ate) return { ok: false, erro: 'A data inicial é depois da final' }
  if (p.de > hoje) return { ok: false, erro: 'O período começa no futuro' }
  if (dias(p.de, p.ate) > MAX_DIAS) return { ok: false, erro: 'Período longo demais' }
  return { ok: true, inicio: p.de, fim: p.ate }
}

// ---- Conteúdo ----------------------------------------------------------------

export type SlideProximos = { semana: string; itens: { codigo: string; nome: string; inicio: string; termino: string }[] }

export type ConteudoApresentacao = {
  loja: string
  cliente: string | null
  titulo: string
  subtitulo: string
  inicio: string
  fim: string
  /** Blocos com conteúdo (menos `fotos`, que depende das imagens), na ordem canônica. */
  blocos: BlocoId[]
  resumo: Pick<ConteudoPeriodo, 'sinal' | 'avanco' | 'previsao'> | null
  curva: PontoCurva[] | null
  cronograma: LinhaEtapa[] | null
  marcos: { marcos: ConteudoPeriodo['marcos']; destaques: string[] } | null
  impedimentos: { impedimentos: ConteudoPeriodo['impedimentos']; doCliente: ConteudoPeriodo['doCliente'] } | null
  ppc: { valor: string; semanas: number } | null
  proximos: SlideProximos[] | null
}

const finito = (n: number) => (Number.isFinite(n) ? n : 0)
const MAX_PROXIMOS = 12
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function montarApresentacao(p: {
  obra: ObraGrande
  inicio: string
  fim: string
  /** O fim, ou hoje se o período ainda não acabou; `obra` foi lida nessa data. */
  ref: string
  hoje: string
  planos: PlanoSemana[]
  restricoes: Restricao[]
  /** Textos dos destaques automáticos (nunca os ids). */
  destaques: string[]
  blocos: BlocoId[]
}): ConteudoApresentacao {
  const { obra: og, inicio, fim, ref } = p
  const c = montarConteudoPeriodo({
    lado: 'cliente', tipo: 'mensal', referencia: ref.slice(0, 7), obra: og, inicio, fim, ref, hoje: p.hoje,
    planos: p.planos, restricoes: p.restricoes, highlights: p.destaques, observacoes: null,
  })
  const quer = new Set(p.blocos)
  const atividades = og.calc?.atividades ?? []

  const resumo = quer.has('resumo') && og.calc ? { sinal: c.sinal, avanco: c.avanco, previsao: c.previsao } : null

  const curvaBase = c.curva.filter((x) => Number.isFinite(x.previsto))
  const curva = quer.has('curva') && curvaBase.length > 1 ? curvaBase.map((x) => ({
    data: x.data,
    base: x.base === null ? null : finito(x.base),
    previsto: finito(x.previsto),
    realizado: x.realizado === null ? null : finito(x.realizado),
  })) : null

  const cronograma =
    quer.has('cronograma') && og.calc && og.etapas.length
      ? linhasDeEtapa(og.etapas, atividades, og.calcBase?.atividades ?? null, og.feriados).map((l) => ({
          ...l,
          base: l.base === null ? null : finito(l.base),
          previsto: finito(l.previsto),
          realizado: finito(l.realizado),
        }))
      : null

  const marcos = quer.has('marcos') && (c.marcos.length || c.highlights.length) ? { marcos: c.marcos, destaques: c.highlights } : null
  const impedimentos =
    quer.has('impedimentos') && (c.impedimentos.length || c.doCliente.length)
      ? { impedimentos: c.impedimentos, doCliente: c.doCliente }
      : null
  const ppc = quer.has('ppc') && c.ppc ? c.ppc : null

  let proximos: SlideProximos[] | null = null
  if (quer.has('proximos') && og.calc) {
    const codigos = codigosDeAtividades(atividades, og.feriados)
    let sobra = MAX_PROXIMOS
    const semanas: SlideProximos[] = []
    for (const s of lookahead(atividades, p.restricoes, ref, 3, codigos)) {
      const itens = s.itens.slice(0, sobra).map((i) => ({ codigo: i.codigo, nome: i.nome, inicio: dm(i.inicio), termino: dm(i.termino) }))
      sobra -= itens.length
      if (itens.length) semanas.push({ semana: dm(s.segunda), itens })
    }
    proximos = semanas.length ? semanas : null
  }

  const conteudo: ConteudoApresentacao = {
    loja: c.loja,
    cliente: og.obra.cliente?.trim() || null,
    titulo: c.loja,
    subtitulo: `Período de ${dataBr(inicio)} a ${dataBr(fim)}${ref < fim ? ` · dados até ${dataBr(ref)}` : ''}`,
    inicio, fim,
    blocos: [],
    resumo, curva, cronograma, marcos, impedimentos, ppc, proximos,
  }
  conteudo.blocos = BLOCOS.filter((b) => (b === 'capa' ? quer.has('capa') : b === 'fotos' ? false : conteudo[b as Exclude<BlocoId, 'capa' | 'fotos'>] !== null))
  return conteudo
}

/** Ordem dos slides: os blocos com conteúdo e, na posição canônica, as fotos (se há). */
export const slidesDe = (c: ConteudoApresentacao, temFotos: boolean): BlocoId[] =>
  BLOCOS.filter((b) => (b === 'fotos' ? temFotos : c.blocos.includes(b)))
