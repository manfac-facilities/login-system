/**
 * Locações da obra (Fases B/C §2.9): aviso 5 dias úteis antes do fim e no vencimento, pelo
 * calendário da obra (seg–sex menos feriados). Puro.
 */
import { ehDiaUtil } from './calendario'

export const DIAS_UTEIS_AVISO = 5

export type EstadoLocacao = 'ativa' | 'renovada' | 'devolvida'

export type AvisoLocacao =
  | { tipo: 'vencida'; fim: string }
  | { tipo: 'hoje'; fim: string }
  | { tipo: 'proxima'; fim: string; diasUteis: number }

const DIA_MS = 86_400_000
const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const iso = (m: number) => new Date(m).toISOString().slice(0, 10)

/** Dias úteis depois de `hoje` até `fim` (inclusive); 0 se `fim` <= hoje. */
export function diasUteisAte(hoje: string, fim: string, feriados: ReadonlySet<string>): number {
  let n = 0
  for (let m = ms(hoje) + DIA_MS; m <= ms(fim); m += DIA_MS) if (ehDiaUtil(iso(m), feriados)) n++
  return n
}

/**
 * Aviso da locação: devolvida ou sem período → nenhum. Fim passado → vencida; fim hoje → hoje;
 * até 5 dias úteis antes do fim → próxima (com quantos dias úteis faltam).
 */
export function avisoLocacao(
  l: { fim: string | null; estado: string | null },
  hoje: string,
  feriados: ReadonlySet<string>,
): AvisoLocacao | null {
  if (!l.fim || l.estado === 'devolvida') return null
  if (l.fim < hoje) return { tipo: 'vencida', fim: l.fim }
  if (l.fim === hoje) return { tipo: 'hoje', fim: l.fim }
  const n = diasUteisAte(hoje, l.fim, feriados)
  return n <= DIAS_UTEIS_AVISO ? { tipo: 'proxima', fim: l.fim, diasUteis: n } : null
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** Texto curto do aviso (pílula da lista e faixa de alertas). */
export function textoAviso(a: AvisoLocacao): string {
  if (a.tipo === 'vencida') return `venceu em ${ddmm(a.fim)}`
  if (a.tipo === 'hoje') return 'vence hoje'
  if (a.diasUteis === 0) return `vence em ${ddmm(a.fim)}`
  return `vence em ${a.diasUteis} ${a.diasUteis === 1 ? 'dia útil' : 'dias úteis'} (${ddmm(a.fim)})`
}
