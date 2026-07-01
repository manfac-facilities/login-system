import type { ConversaoResultado, ConversorRow, LinhaErro } from './types'

export interface LinhaBruta {
  numeroLinha: number
  valores: unknown[]
}

export type MapearLinha = (
  valores: unknown[],
  numeroLinha: number
) => { row: ConversorRow } | { erro: string }

export type FiltrarLinha = (valores: unknown[]) => boolean

export function converterLinhas(
  linhas: LinhaBruta[],
  mapear: MapearLinha,
  filtrar?: FiltrarLinha
): ConversaoResultado {
  const linhasOrigem = linhas.length
  const linhasFiltradas = filtrar ? linhas.filter((l) => filtrar(l.valores)) : linhas

  const erros: LinhaErro[] = []
  const vistos = new Set<string>()
  const rows: ConversorRow[] = []
  let duplicadosRemovidos = 0

  for (const linha of linhasFiltradas) {
    const resultado = mapear(linha.valores, linha.numeroLinha)
    if ('erro' in resultado) {
      erros.push({ linha: linha.numeroLinha, motivo: resultado.erro })
      continue
    }
    if (vistos.has(resultado.row.identificador)) {
      duplicadosRemovidos++
      continue
    }
    vistos.add(resultado.row.identificador)
    rows.push(resultado.row)
  }

  return { linhasOrigem, linhasConvertidas: rows.length, duplicadosRemovidos, erros, rows }
}
