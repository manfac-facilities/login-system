import type { NotaTela } from '../../../obras/_lib/financeiro-tela'
import type { Custo } from '../../../obras/_lib/financeiro-obra'

export type NotaExterna = { nfse: string; emitidaEm: string; valorCentavos: number }

export type ResumoSpot = {
  valorCentavos: number | null
  faturadoCentavos: number
  faturadoPct: number | null
  faltaCentavos: number | null
  acimaDoValorCentavos: number | null
  notas: number
  foraDoSistema: boolean
  custo: Custo
  margemPrevistaCentavos: number | null
  margemPrevistaPct: number | null
  margemRealizadaCentavos: number
  margemRealizadaPct: number | null
}

const pct = (parte: number, base: number | null): number | null =>
  base ? Math.round((parte / base) * 1000) / 10 : null

export function resumoSpot(p: {
  valorCentavos: number | null
  etapa: string
  fatNfse: string | null
  notas: NotaTela[]
  externas: NotaExterna[]
  custo: Custo
}): ResumoSpot {
  const contam = p.notas.filter((n) => n.contaNaReceita)
  let faturado =
    contam.reduce((s, n) => s + (n.parcelaCentavos ?? 0), 0) +
    p.externas.reduce((s, n) => s + n.valorCentavos, 0)
  let foraDoSistema = false
  if (faturado === 0 && p.etapa === 'faturado' && p.fatNfse && p.fatNfse.trim() !== '') {
    faturado = p.valorCentavos ?? 0
    foraDoSistema = true
  }
  const valor = p.valorCentavos
  const temValor = valor != null && valor > 0
  const margemPrevista = temValor ? valor - p.custo.comprometido : null
  return {
    valorCentavos: valor,
    faturadoCentavos: faturado,
    faturadoPct: temValor ? pct(faturado, valor) : null,
    faltaCentavos: temValor ? Math.max(0, valor - faturado) : null,
    acimaDoValorCentavos: temValor && faturado > valor ? faturado - valor : null,
    notas: foraDoSistema ? 0 : contam.length + p.externas.length,
    foraDoSistema,
    custo: p.custo,
    margemPrevistaCentavos: margemPrevista,
    margemPrevistaPct: margemPrevista == null ? null : pct(margemPrevista, valor),
    margemRealizadaCentavos: faturado - p.custo.realizado,
    margemRealizadaPct: pct(faturado - p.custo.realizado, faturado),
  }
}
