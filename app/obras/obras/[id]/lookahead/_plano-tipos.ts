/** Regras puras do plano da semana e dados do gráfico de PPC (fora do 'use server'). */
import { ppc, segundaDaSemana, type PlanoSemana } from '../../_lib/last-planner'

export type ItemFechamento = { numero: number; meta: number }
export type ItemAvaliacao = { numero: number; causa: string | null }
export type PontoPpc = { semana: string; ppc: number; avaliados: number }

const ISO = /^\d{4}-\d{2}-\d{2}$/
const DIA_MS = 86_400_000
const ms = (d: string) => {
  const [a, m, x] = d.split('-').map(Number)
  return Date.UTC(a, m - 1, x)
}
export const somarDias = (d: string, n: number) => new Date(ms(d) + n * DIA_MS).toISOString().slice(0, 10)

/** Segunda-feira ISO válida, senão null. */
export function segundaValida(s: string | null | undefined): string | null {
  if (!s || !ISO.test(s)) return null
  return segundaDaSemana(s) === s ? s : null
}

/** Semana a montar: a atual se ainda não tem plano; senão a próxima. */
export function semanaAlvo(hoje: string, planosExistentes: ReadonlySet<string>): string {
  const atual = segundaDaSemana(hoje)
  return planosExistentes.has(atual) ? somarDias(atual, 7) : atual
}

/** Últimas `n` semanas com algum item avaliado, da mais antiga à mais recente. */
export function dadosPpc(planos: PlanoSemana[], n = 8): PontoPpc[] {
  const pontos: PontoPpc[] = []
  for (const p of planos) {
    const v = ppc(p.itens)
    if (v === null) continue
    pontos.push({ semana: p.semanaInicio, ppc: v, avaliados: p.itens.filter((i) => i.cumprido !== null).length })
  }
  return pontos.sort((a, b) => a.semana.localeCompare(b.semana)).slice(-n)
}
