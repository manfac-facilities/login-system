import { converterLinhas, type LinhaBruta } from '../converter'
import type { ConversorRow } from '../types'

function linha(numeroLinha: number, id: string): LinhaBruta {
  return { numeroLinha, valores: [id] }
}

function rowFixture(id: string): ConversorRow {
  return {
    identificador: id, tipoOs: 'Manutenção Corretiva', documentoCliente: '',
    nomeCliente: 'DPSP', nomeLocalizacao: 'Loja X', numeroSerie: '',
    nomeColaborador: '', colaboradoresSecundarios: '', dataAgendamento: '',
    horaAgendamento: '', descricao: 'desc', descricaoTarefa: '', etiquetas: '',
  }
}

describe('converterLinhas', () => {
  it('maps every row when the mapper always succeeds', () => {
    const linhas = [linha(5, 'A1'), linha(6, 'A2')]
    const resultado = converterLinhas(linhas, (valores) => ({ row: rowFixture(valores[0] as string) }))
    expect(resultado.linhasOrigem).toBe(2)
    expect(resultado.linhasConvertidas).toBe(2)
    expect(resultado.rows.map((r) => r.identificador)).toEqual(['A1', 'A2'])
    expect(resultado.erros).toEqual([])
    expect(resultado.duplicadosRemovidos).toBe(0)
  })

  it('collects errors with the original row number instead of dropping silently', () => {
    const linhas = [linha(5, 'A1'), linha(6, '')]
    const resultado = converterLinhas(linhas, (valores, numeroLinha) =>
      valores[0] ? { row: rowFixture(valores[0] as string) } : { erro: `linha ${numeroLinha}: falta identificador` }
    )
    expect(resultado.linhasConvertidas).toBe(1)
    expect(resultado.erros).toEqual([{ linha: 6, motivo: 'linha 6: falta identificador' }])
  })

  it('removes duplicates by identificador, keeping the first occurrence', () => {
    const linhas = [linha(5, 'A1'), linha(6, 'A1'), linha(7, 'A2')]
    const resultado = converterLinhas(linhas, (valores) => ({ row: rowFixture(valores[0] as string) }))
    expect(resultado.rows.map((r) => r.identificador)).toEqual(['A1', 'A2'])
    expect(resultado.duplicadosRemovidos).toBe(1)
    expect(resultado.linhasConvertidas).toBe(2)
  })

  it('applies the optional filter before mapping, and filtered rows are neither errors nor converted', () => {
    const linhas = [linha(5, 'KEEP'), linha(6, 'DROP')]
    const resultado = converterLinhas(
      linhas,
      (valores) => ({ row: rowFixture(valores[0] as string) }),
      (valores) => valores[0] === 'KEEP'
    )
    expect(resultado.linhasOrigem).toBe(2)
    expect(resultado.linhasConvertidas).toBe(1)
    expect(resultado.erros).toEqual([])
  })
})
