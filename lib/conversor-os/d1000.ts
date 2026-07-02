import type { ConversorRow } from './types'

export const ABREVIACOES_BANDEIRA: Record<string, string> = {
  TAMOIO: 'TMO',
  DROGASMIL: 'DML',
  FARMALIFE: 'FML',
}

export function abreviarLocalizacao(bandeira: string, loja: string): string | null {
  const abreviacao = ABREVIACOES_BANDEIRA[bandeira.trim().toUpperCase()]
  const lojaLimpa = loja.trim()
  if (!abreviacao || !lojaLimpa) return null
  return `${abreviacao}-${lojaLimpa}`
}

export function filtrarLinhaD1000(valores: unknown[]): boolean {
  const grupoAnalista = String(valores[3] ?? '').toUpperCase()
  const bandeira = String(valores[1] ?? '').toUpperCase()
  return grupoAnalista.includes('MANFAC') && bandeira !== 'ROSARIO'
}

export function mapearLinhaD1000(
  valores: unknown[],
  numeroLinha: number
): { row: ConversorRow } | { erro: string } {
  const colA = String(valores[0] ?? '').trim()
  const bandeira = String(valores[1] ?? '').trim()
  const loja = String(valores[2] ?? '').trim()
  const colH = String(valores[7] ?? '').trim()

  if (!colA) return { erro: `linha ${numeroLinha}: falta Codigo` }

  const localizacao = abreviarLocalizacao(bandeira, loja)
  if (!localizacao)
    return {
      erro: `linha ${numeroLinha}: bandeira ou loja inválida (${bandeira || '—'} / ${loja || '—'})`,
    }

  if (!colH) return { erro: `linha ${numeroLinha}: falta Descrição do Problema` }

  return {
    row: {
      identificador: colA,
      tipoOs: 'Manutenção Corretiva',
      documentoCliente: '',
      nomeCliente: 'D1000',
      nomeLocalizacao: localizacao,
      numeroSerie: '',
      nomeColaborador: '',
      colaboradoresSecundarios: '',
      dataAgendamento: '',
      horaAgendamento: '',
      descricao: colH,
      descricaoTarefa: '',
      etiquetas: '',
    },
  }
}
