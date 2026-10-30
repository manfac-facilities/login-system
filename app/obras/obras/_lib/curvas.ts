/**
 * Curvas S e séries do painel (spec §6). Puro. Datas ISO, valores em fração 0–1.
 */
import { diasUteisEntre } from './calendario'
import type { AtividadeCalculada } from './cronograma'

type Feriados = ReadonlySet<string>
export type PontoHist = {
  numero: number
  dataStatus: string
  percentual: number
  /** Dias restantes gravados nesta linha (âncora da projeção); ausente = não informado. */
  diasRestantes?: number | null
  registradoEm?: string
}
export type Serie = { data: string; valor: number }[]

const DIA_MS = 86_400_000
const ms = (d: string) => { const [a, m, x] = d.split('-').map(Number); return Date.UTC(a, m - 1, x) }
const iso = (n: number) => new Date(n).toISOString().slice(0, 10)

/** Σ peso × %previsto na data D. */
export function curvaPlanejada(atividades: AtividadeCalculada[], datas: string[], feriados: Feriados): Serie {
  return datas.map((d) => ({
    data: d,
    valor: atividades.reduce((s, a) => {
      const dur = Math.max(a.duracao, 1)
      const p = d < a.inicioPrevisto ? 0 : d >= a.fimPrevisto ? 1 : diasUteisEntre(a.inicioPrevisto, d, feriados) / dur
      return s + a.peso * p
    }, 0),
  }))
}

/** % de cada atividade em D = último registro com dataStatus ≤ D; só até a última data com histórico (que entra como ponto final se fora da grade). */
export function curvaRealizada(atividades: AtividadeCalculada[], hist: PontoHist[], datas: string[]): Serie {
  if (!datas.length) return []
  if (!hist.length) return [{ data: datas[0], valor: 0 }]
  const ultima = hist.reduce((m, h) => (h.dataStatus > m ? h.dataStatus : m), '')
  const ordenado = hist.slice().sort((a, b) => a.dataStatus.localeCompare(b.dataStatus))
  const pontos = datas.filter((d, i) => i === 0 || d <= ultima)
  if (ultima > pontos[pontos.length - 1] && ultima <= datas[datas.length - 1]) pontos.push(ultima)
  return pontos.map((d) => {
      const pct = new Map<number, number>()
      for (const h of ordenado) if (h.dataStatus <= d) pct.set(h.numero, h.percentual)
      return { data: d, valor: atividades.reduce((s, a) => s + a.peso * (pct.get(a.numero) ?? 0), 0) }
    })
}

/** Sextas (semana; entra mesmo se feriado) ou último dia útil (seg–sex) do mês; inclui o fim. */
export function datasDaCurva(inicio: string, fim: string, passo: 'semana' | 'mes'): string[] {
  const out: string[] = []
  const fimMs = ms(fim)
  if (passo === 'semana') {
    let t = ms(inicio)
    while (new Date(t).getUTCDay() !== 5) t += DIA_MS
    for (; t <= fimMs; t += 7 * DIA_MS) out.push(iso(t))
  } else {
    const d0 = new Date(ms(inicio))
    let a = d0.getUTCFullYear(), m = d0.getUTCMonth()
    for (;;) {
      let t = Date.UTC(a, m + 1, 0)
      while ([0, 6].includes(new Date(t).getUTCDay())) t -= DIA_MS
      if (t > fimMs) break
      if (t >= ms(inicio)) out.push(iso(t))
      m++
      if (m > 11) { m = 0; a++ }
    }
  }
  if (out[out.length - 1] !== fim) out.push(fim)
  return out
}

/** Diferença entre pontos consecutivos, em pontos percentuais (0–100). Realizado ausente = 0. */
export function progressoPorPeriodo(base: Serie, previsto: Serie, realizado: Serie) {
  const dif = (s: Serie, i: number) => (i < s.length && i >= 1 ? (s[i].valor - s[i - 1].valor) * 100 : 0)
  return previsto.slice(1).map((p, k) => ({
    periodo: p.data,
    base: dif(base, k + 1),
    previsto: dif(previsto, k + 1),
    realizado: dif(realizado, k + 1),
  }))
}
