import { abreviarLocalizacao, filtrarLinhaD1000, mapearLinhaD1000 } from '../d1000'

describe('abreviarLocalizacao', () => {
  it('abbreviates known bandeiras', () => {
    expect(abreviarLocalizacao('TAMOIO', '180')).toBe('TMO-180')
    expect(abreviarLocalizacao('DROGASMIL', '611')).toBe('DML-611')
    expect(abreviarLocalizacao('FARMALIFE', '624')).toBe('FML-624')
  })

  it('is case-insensitive on bandeira and trims whitespace', () => {
    expect(abreviarLocalizacao('  tamoio  ', ' 180 ')).toBe('TMO-180')
  })

  it('returns null for an unknown bandeira', () => {
    expect(abreviarLocalizacao('ROSARIO', '10')).toBeNull()
  })

  it('returns null when loja is empty', () => {
    expect(abreviarLocalizacao('TAMOIO', '')).toBeNull()
  })
})

describe('filtrarLinhaD1000', () => {
  function valores(grupoAnalista: string, bandeira: string): unknown[] {
    const v: unknown[] = []
    v[1] = bandeira
    v[3] = grupoAnalista
    return v
  }

  it('keeps rows where Grupo Analista contains MANFAC and bandeira is not ROSARIO', () => {
    expect(filtrarLinhaD1000(valores('EQUIPE MANFAC SP', 'TAMOIO'))).toBe(true)
  })

  it('drops rows where Grupo Analista does not contain MANFAC', () => {
    expect(filtrarLinhaD1000(valores('EQUIPE TERCEIROS', 'TAMOIO'))).toBe(false)
  })

  it('drops rows where bandeira is ROSARIO even if Grupo Analista contains MANFAC', () => {
    expect(filtrarLinhaD1000(valores('EQUIPE MANFAC SP', 'ROSARIO'))).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(filtrarLinhaD1000(valores('equipe manfac sp', 'tamoio'))).toBe(true)
    expect(filtrarLinhaD1000(valores('equipe manfac sp', 'rosario'))).toBe(false)
  })
})

describe('mapearLinhaD1000', () => {
  function valoresValidos(overrides: Record<number, unknown> = {}): unknown[] {
    const v: unknown[] = []
    v[0] = 'D-999' // Codigo
    v[1] = 'DROGASMIL' // Bandeira
    v[2] = '611' // Loja
    v[7] = 'Câmara fria com falha' // Descrição do Problema
    Object.assign(v, overrides)
    return v
  }

  it('maps a valid row to the Field Control shape', () => {
    const resultado = mapearLinhaD1000(valoresValidos(), 8)
    expect(resultado).toEqual({
      row: {
        identificador: 'D-999',
        tipoOs: 'Manutenção Corretiva',
        documentoCliente: '',
        nomeCliente: 'D1000',
        nomeLocalizacao: 'DML-611',
        numeroSerie: '',
        nomeColaborador: '',
        colaboradoresSecundarios: '',
        dataAgendamento: '',
        horaAgendamento: '',
        descricao: 'Câmara fria com falha',
        descricaoTarefa: '',
        etiquetas: '',
      },
    })
  })

  it('errors when Codigo is missing', () => {
    const resultado = mapearLinhaD1000(valoresValidos({ 0: '' }), 8)
    expect(resultado).toEqual({ erro: 'linha 8: falta Codigo' })
  })

  it('errors when bandeira is unknown (concatenation fails)', () => {
    const resultado = mapearLinhaD1000(valoresValidos({ 1: 'DESCONHECIDA' }), 8)
    expect(resultado).toEqual({
      erro: 'linha 8: bandeira ou loja inválida (DESCONHECIDA / 611)',
    })
  })

  it('errors when Descrição do Problema is missing', () => {
    const resultado = mapearLinhaD1000(valoresValidos({ 7: '' }), 8)
    expect(resultado).toEqual({ erro: 'linha 8: falta Descrição do Problema' })
  })
})
