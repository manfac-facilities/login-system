/**
 * Medição ao cliente (Fases B/C §2.4): % ⇄ valor sobre o valor receita da OS. Puro.
 * Dinheiro em CENTAVOS inteiros, percentual em CENTÉSIMOS (10,00% = 1000). O banco guarda
 * os dois como digitados; a tela calcula um do outro e o servidor confere a coerência.
 */

const fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Texto digitado em pt-BR → número (ou null se não for número).
 * "1.234,56" → 1234.56 · "10,5" → 10.5 · "1234.56" → 1234.56 · "1.234" → 1234 (milhar).
 */
export function lerDecimalBR(bruto: string | null | undefined): number | null {
  let s = String(bruto ?? '').replace(/[R$\s%]/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Texto em reais → centavos (arredondado ao centavo); null se inválido. */
export function centavosDeTexto(bruto: string | null | undefined): number | null {
  const n = lerDecimalBR(bruto)
  return n === null ? null : Math.round(n * 100)
}

/** Texto em % → centésimos (2 casas); null se inválido. */
export function centesimosDeTexto(bruto: string | null | undefined): number | null {
  const n = lerDecimalBR(bruto)
  return n === null ? null : Math.round(n * 100)
}

/** Centavos → "43.777,24" (sem "R$"). */
export const textoDeCentavos = (c: number): string => fmt2.format(c / 100)
/** Centésimos → "10,00". */
export const textoDeCentesimos = (p: number): string => fmt2.format(p / 100)

/** Valor (centavos) de um % (centésimos) sobre a receita (centavos), arredondado ao centavo. */
export function valorDePercentual(receitaCentavos: number, pctCentesimos: number): number {
  return Math.round((receitaCentavos * pctCentesimos) / 10000)
}

/** % (centésimos, 2 casas) de um valor sobre a receita; null sem receita. */
export function percentualDeValor(receitaCentavos: number | null, valorCentavos: number): number | null {
  if (!receitaCentavos || receitaCentavos <= 0) return null
  return Math.round((valorCentavos * 10000) / receitaCentavos)
}

/**
 * % e valor coerentes: um é o arredondamento do outro. Quem digitou o % gera o valor exato
 * (valorDePercentual); quem digitou o valor gera o % de 2 casas (percentualDeValor).
 */
export function coerentes(receitaCentavos: number, pctCentesimos: number, valorCentavos: number): boolean {
  return valorDePercentual(receitaCentavos, pctCentesimos) === valorCentavos || percentualDeValor(receitaCentavos, valorCentavos) === pctCentesimos
}

/** O usuário digitou o % → texto do valor (vazio se o % não é número ou não há receita). */
export function aoDigitarPercentual(texto: string, receitaCentavos: number | null): string {
  const p = centesimosDeTexto(texto)
  if (p === null || !receitaCentavos) return ''
  return textoDeCentavos(valorDePercentual(receitaCentavos, p))
}

/** O usuário digitou o valor → texto do % ("—" sem receita; vazio se o valor não é número). */
export function aoDigitarValor(texto: string, receitaCentavos: number | null): string {
  if (!receitaCentavos) return '—'
  const v = centavosDeTexto(texto)
  if (v === null) return ''
  return textoDeCentesimos(percentualDeValor(receitaCentavos, v) ?? 0)
}

/** O que ainda falta liberar na OS (receita − medições não recusadas). Pode ser ≤ 0. */
export type Restante = { pct: number; valor: number }

/** Restante da OS: soma das medições NÃO recusadas, menos a que está sendo editada. */
export function restanteDaOs(
  receitaCentavos: number,
  medicoes: { id: string; situacao: string; percentualCentesimos: number; valorCentavos: number }[],
  excetoId?: string,
): Restante {
  const vale = medicoes.filter((m) => m.situacao !== 'recusada' && m.id !== excetoId)
  return {
    pct: 10000 - vale.reduce((s, m) => s + m.percentualCentesimos, 0),
    valor: receitaCentavos - vale.reduce((s, m) => s + m.valorCentavos, 0),
  }
}

/**
 * % (centésimos) de um valor digitado, sem passar do % restante: o valor igual ao restante leva
 * exatamente o % restante; o arredondamento nunca empurra a soma além de 100%.
 */
export function pctPorValor(receitaCentavos: number, valorCentavos: number, r: Restante | null): number {
  const p = percentualDeValor(receitaCentavos, valorCentavos) ?? 0
  if (!r) return p
  if (valorCentavos === r.valor) return r.pct
  return Math.min(p, r.pct)
}

/**
 * O servidor aceita o par (%, valor): coerentes entre si, ou o % é o restante (valor = restante,
 * ou o arredondamento do valor passaria do restante e foi limitado). Valor acima do restante em
 * R$ nunca passa.
 */
export function parAceitavel(receitaCentavos: number, pct: number, valor: number, r: Restante): boolean {
  if (valor > r.valor) return false
  if (coerentes(receitaCentavos, pct, valor)) return true
  return pct === r.pct && (valor === r.valor || (percentualDeValor(receitaCentavos, valor) ?? 0) >= r.pct)
}

/** Valor receita (`obras_obra.valor`, numeric em REAIS) → centavos; null/0/inválido → null. */
export function receitaEmCentavos(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

/** Dias corridos (dia de Brasília) entre o envio e hoje. */
export function diasDesde(isoTimestamp: string, hoje: string): number {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(isoTimestamp))
  return Math.round((Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10)) - Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10))) / 86_400_000)
}

/** Alerta de medição aguardando o cliente: a partir de mais de 10 dias (spec §2.4). */
export const LIMITE_DIAS_AGUARDANDO = 10

/**
 * Mensagem do banco (prefixo OBRAS_MEDICAO_CLIENTE / OBRAS_LOCACAO / OBRAS_CLIENTE_PESSOA / OBRAS_VALOR)
 * → texto pt-BR para a tela.
 * Números "90.00%" viram "90,00%".
 */
export function erroDoBanco(e: { message?: string; code?: string } | null | undefined, padrao: string): string {
  const msg = String(e?.message ?? '')
  const m = /OBRAS_(?:MEDICAO_CLIENTE|LOCACAO|CLIENTE_PESSOA|VALOR): (.+)/.exec(msg)
  if (m) {
    const t = m[1].replace(/(\d+)\.(\d{2})%/g, '$1,$2%')
    return t.charAt(0).toUpperCase() + t.slice(1)
  }
  if (e?.code === '42501' || msg.includes('row-level security')) return 'Você não tem permissão para isso.'
  if (e?.code === '23505') return 'Já existe um registro igual.'
  return padrao
}
