/**
 * Motor Last Planner (puro): semana, lookahead, PPC e causas. Datas ISO `YYYY-MM-DD`.
 */
import type { AtividadeCalculada, Responsavel } from './cronograma'
import { ehDiaUtil } from './calendario'
import { CAUSA, type CausaRdo } from './causas'
import type { PontoHist } from './curvas'

export type Restricao = {
  id: string
  obraId: string
  atividadeNumero: number
  tipo: 'acesso' | 'material' | 'mao_de_obra' | 'projeto' | 'decisao_cliente' | 'equipamento' | 'outro'
  descricao: string
  responsavel: 'cliente' | 'manfac' | 'terceiro'
  prazo: string | null
  situacao: 'identificada' | 'em_tratativa' | 'liberada'
  liberadaEm: string | null
  criadoPor: string | null
  criadoEm: string
}

export type PlanoItem = {
  id: string
  planoId: string
  numero: number
  metaPercentual: number
  percentualFinal: number | null
  cumprido: boolean | null
  causa: CausaRdo | null
  avaliadoEm: string | null
}

export type PlanoSemana = {
  id: string
  obraId: string
  semanaInicio: string
  fechadoEm: string | null
  fechadoPor: string | null
  itens: PlanoItem[]
}

export type ItemLookahead = {
  numero: number
  codigo: string
  nome: string
  inicio: string
  termino: string
  restricoesAbertas: Restricao[]
  pronta: boolean
}
export type SemanaLookahead = { segunda: string; itens: ItemLookahead[] }

const DIA_MS = 86_400_000
const ms = (d: string) => {
  const [a, m, x] = d.split('-').map(Number)
  return Date.UTC(a, m - 1, x)
}
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)

export function segundaDaSemana(data: string): string {
  const dow = new Date(ms(data)).getUTCDay() // 0 = domingo
  return iso(ms(data) - ((dow + 6) % 7) * DIA_MS)
}

export function diasDaSemana(segunda: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => iso(ms(segunda) + i * DIA_MS))
}

/** Sexta, ou o último dia útil anterior da mesma semana (se a semana toda for feriado, a sexta). */
export function dataEnvioSemanal(segunda: string, feriados: ReadonlySet<string>): string {
  const dias = diasDaSemana(segunda)
  for (let i = dias.length - 1; i >= 0; i--) if (ehDiaUtil(dias[i], feriados)) return dias[i]
  return dias[4]
}

export function lookahead(
  atividades: AtividadeCalculada[],
  restricoes: Restricao[],
  hojeIso: string,
  semanas: 3 | 4 | 6,
  codigos: ReadonlyMap<number, string>,
): SemanaLookahead[] {
  const primeira = segundaDaSemana(hojeIso)
  const out: SemanaLookahead[] = Array.from({ length: semanas }, (_, i) => ({
    segunda: iso(ms(primeira) + i * 7 * DIA_MS),
    itens: [],
  }))
  for (const a of atividades) {
    if (a.status === 'concluido') continue
    const inicio = a.inicioProjetado || a.inicioPrevisto
    if (!inicio) continue
    // Atrasadas (início antes da semana atual) entram na primeira semana.
    const seg = segundaDaSemana(inicio)
    const alvo = seg < primeira ? out[0] : out.find((s) => s.segunda === seg)
    if (!alvo) continue
    const abertas = restricoes.filter((r) => r.atividadeNumero === a.numero && r.situacao !== 'liberada')
    alvo.itens.push({
      numero: a.numero,
      codigo: codigos.get(a.numero) ?? '',
      nome: a.descricao,
      inicio,
      termino: a.fimProjetado || a.fimPrevisto,
      restricoesAbertas: abertas,
      pronta: abertas.length === 0,
    })
  }
  for (const s of out) s.itens.sort((x, y) => x.inicio.localeCompare(y.inicio) || x.numero - y.numero)
  return out
}

/**
 * % de cada atividade na data, pelo histórico de status: o último registro com
 * data_status <= data (empate: o registrado por último) — a mesma âncora da
 * curva Realizado. Atividade sem registro até a data fica fora do mapa.
 */
export function percentuaisNaData(hist: PontoHist[], data: string): Map<number, number> {
  const ordenado = hist
    .filter((h) => h.dataStatus <= data)
    .sort((a, b) => a.dataStatus.localeCompare(b.dataStatus) || (a.registradoEm ?? '').localeCompare(b.registradoEm ?? ''))
  const m = new Map<number, number>()
  for (const h of ordenado) m.set(h.numero, Math.min(1, Math.max(0, h.percentual)))
  return m
}

/** Data em que o plano da semana é medido: a sexta, ou hoje se a semana ainda não acabou. */
export const dataDaAvaliacao = (segunda: string, hoje: string): string => {
  const sexta = diasDaSemana(segunda)[4]
  return sexta < hoje ? sexta : hoje
}

export const avaliarItem = (meta: number, percentualFinal: number): boolean =>
  percentualFinal >= meta - 0.0001

export function ppc(itens: { cumprido: boolean | null }[]): number | null {
  const av = itens.filter((i) => i.cumprido !== null)
  if (av.length === 0) return null
  return av.filter((i) => i.cumprido).length / av.length
}

export function causasNaoCumpridas(
  itens: { cumprido: boolean | null; causa?: CausaRdo | string | null }[],
): { causa: CausaRdo; responsavel: Responsavel | null; n: number }[] {
  const cont = new Map<CausaRdo, number>()
  for (const i of itens) {
    if (i.cumprido !== false || !i.causa || !(i.causa in CAUSA)) continue
    cont.set(i.causa as CausaRdo, (cont.get(i.causa as CausaRdo) ?? 0) + 1)
  }
  return [...cont]
    .map(([causa, n]) => ({ causa, responsavel: CAUSA[causa].resp, n }))
    .sort((a, b) => b.n - a.n)
}
