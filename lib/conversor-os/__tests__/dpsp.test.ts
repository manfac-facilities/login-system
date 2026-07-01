import { mapearLinhaDPSP } from '../dpsp'

function valoresValidos(overrides: Record<number, unknown> = {}): unknown[] {
  const v: unknown[] = []
  v[0] = 'CH-123' // Col A
  v[5] = 'Ar-condicionado não liga' // Col F
  v[7] = 'Silva' // Col H
  Object.assign(v, overrides)
  return v
}

describe('mapearLinhaDPSP', () => {
  it('maps a valid row to the Field Control shape', () => {
    const resultado = mapearLinhaDPSP(valoresValidos(), 5)
    expect(resultado).toEqual({
      row: {
        identificador: 'CH-123',
        tipoOs: 'Manutenção Corretiva',
        documentoCliente: '',
        nomeCliente: 'DPSP',
        nomeLocalizacao: 'Silva',
        numeroSerie: '',
        nomeColaborador: '',
        colaboradoresSecundarios: '',
        dataAgendamento: '',
        horaAgendamento: '',
        descricao: 'Ar-condicionado não liga',
        descricaoTarefa: '',
        etiquetas: '',
      },
    })
  })

  it('trims whitespace from mapped fields', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 0: '  CH-123  ', 7: '  Silva  ' }), 5)
    expect('row' in resultado && resultado.row.identificador).toBe('CH-123')
    expect('row' in resultado && resultado.row.nomeLocalizacao).toBe('Silva')
  })

  it('errors when Nº Chamado (Col A) is missing', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 0: '' }), 12)
    expect(resultado).toEqual({ erro: 'linha 12: falta Nº Chamado' })
  })

  it('errors when Sobrenome do Solicitante (Col H) is missing', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 7: '' }), 12)
    expect(resultado).toEqual({ erro: 'linha 12: falta Sobrenome do Solicitante' })
  })

  it('errors when Descrição (Col F) is missing', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 5: '' }), 12)
    expect(resultado).toEqual({ erro: 'linha 12: falta Descrição' })
  })

  it('treats a cell holding only whitespace as missing', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 0: '   ' }), 12)
    expect(resultado).toEqual({ erro: 'linha 12: falta Nº Chamado' })
  })
})
