/**
 * Calendário de dias úteis (seg–sex, exceto feriados). Datas ISO `YYYY-MM-DD`.
 * Aritmética em UTC para não sofrer fuso. Puro: sem banco, sem React.
 */

const DIA_MS = 86_400_000

function paraMs(data: string): number {
  const [a, m, d] = data.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

function paraISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function ehDiaUtil(data: string, feriados: ReadonlySet<string>): boolean {
  const dow = new Date(paraMs(data)).getUTCDay()
  return dow !== 0 && dow !== 6 && !feriados.has(data)
}

/** A própria data se útil, senão o próximo dia útil. */
export function proximoDiaUtil(data: string, feriados: ReadonlySet<string>): string {
  let ms = paraMs(data)
  while (!ehDiaUtil(paraISO(ms), feriados)) ms += DIA_MS
  return paraISO(ms)
}

/** WORKDAY do Excel (n >= 0). */
export function somarDiasUteis(data: string, n: number, feriados: ReadonlySet<string>): string {
  let ms = paraMs(data)
  let restantes = n
  while (restantes > 0) {
    ms += DIA_MS
    if (ehDiaUtil(paraISO(ms), feriados)) restantes--
  }
  return paraISO(ms)
}

/** NETWORKDAYS do Excel (inclusivo nas duas pontas); b < a → 0. */
export function diasUteisEntre(a: string, b: string, feriados: ReadonlySet<string>): number {
  const fim = paraMs(b)
  let total = 0
  for (let ms = paraMs(a); ms <= fim; ms += DIA_MS) {
    if (ehDiaUtil(paraISO(ms), feriados)) total++
  }
  return total
}
