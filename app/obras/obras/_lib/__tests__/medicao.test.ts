import {
  aoDigitarPercentual,
  aoDigitarValor,
  centavosDeTexto,
  centesimosDeTexto,
  coerentes,
  diasDesde,
  erroDoBanco,
  lerDecimalBR,
  parAceitavel,
  pctPorValor,
  restanteDaOs,
  percentualDeValor,
  receitaEmCentavos,
  valorDePercentual,
} from '../medicao'

const MACAE = 43_777_241 // R$ 437.772,41

describe('lerDecimalBR', () => {
  it.each([
    ['437.772,41', 437772.41],
    ['10,5', 10.5],
    ['10', 10],
    ['1234.56', 1234.56],
    ['1.234', 1234],
    ['R$ 38.500,00', 38500],
    ['12,34%', 12.34],
    ['', null],
    ['abc', null],
    ['1,2,3', null],
    ['-5', null],
  ])('%s → %s', (t, n) => expect(lerDecimalBR(t)).toBe(n))
})

describe('% ⇄ valor (centavos, 2 casas)', () => {
  it('10% de Macaé 3 = R$ 43.777,24 (arredonda ao centavo para baixo)', () => {
    expect(valorDePercentual(MACAE, 1000)).toBe(4_377_724)
    expect(aoDigitarPercentual('10,00', MACAE)).toBe('43.777,24')
  })
  it('meio centavo arredonda para cima', () => {
    // 0,01% de R$ 50,00 = 0,5 centavo → 1 centavo
    expect(valorDePercentual(5000, 1)).toBe(1)
  })
  it('valor → % com 2 casas', () => {
    expect(percentualDeValor(MACAE, 5_253_269)).toBe(1200) // 52.532,69 = 12,00%
    expect(aoDigitarValor('52.532,69', MACAE)).toBe('12,00')
    expect(percentualDeValor(3_000_000, 1_000_000)).toBe(3333) // 1/3 → 33,33%
  })
  it('sem valor receita: % mostra "—" e não há valor calculado', () => {
    expect(aoDigitarValor('1.000,00', null)).toBe('—')
    expect(aoDigitarPercentual('10', null)).toBe('')
    expect(percentualDeValor(null, 100)).toBeNull()
    expect(percentualDeValor(0, 100)).toBeNull()
  })
  it('coerentes aceita quem digitou o % e quem digitou o valor; recusa o resto', () => {
    expect(coerentes(3_000_000, 3333, valorDePercentual(3_000_000, 3333))).toBe(true) // digitou %
    expect(coerentes(3_000_000, 3333, 1_000_000)).toBe(true) // digitou valor (33,33% de 30.000 = 9.999,00)
    expect(coerentes(3_000_000, 3333, 1_100_000)).toBe(false)
    expect(coerentes(MACAE, 1000, 4_380_000)).toBe(false)
  })
  it('textos → inteiros', () => {
    expect(centavosDeTexto('43.777,245')).toBe(4_377_725)
    expect(centesimosDeTexto('12,345')).toBe(1235)
    expect(centavosDeTexto('x')).toBeNull()
  })
  it('valor receita (reais numeric) → centavos', () => {
    expect(receitaEmCentavos(437772.41)).toBe(MACAE)
    expect(receitaEmCentavos('38500.00')).toBe(3_850_000)
    expect(receitaEmCentavos(null)).toBeNull()
    expect(receitaEmCentavos(0)).toBeNull()
    expect(receitaEmCentavos('abc')).toBeNull()
  })
})

describe('erroDoBanco', () => {
  it('soma > 100% vira pt-BR com vírgula decimal', () => {
    const e = { code: '23514', message: 'OBRAS_MEDICAO_CLIENTE: a soma das liberações desta OS passaria de 100% (já há 90.00%, esta tem 20.00%)' }
    expect(erroDoBanco(e, 'x')).toBe('A soma das liberações desta OS passaria de 100% (já há 90,00%, esta tem 20,00%)')
  })
  it('RLS → sem permissão; desconhecido → padrão', () => {
    expect(erroDoBanco({ code: '42501', message: 'new row violates row-level security' }, 'x')).toBe('Você não tem permissão para isso.')
    expect(erroDoBanco({ message: 'boom' }, 'padrão')).toBe('padrão')
  })
})

describe('diasDesde (dia de Brasília)', () => {
  it('conta dias corridos pelo dia BRT do envio', () => {
    expect(diasDesde('2026-10-20T02:00:00Z', '2026-11-01')).toBe(13) // 19/10 23h BRT
    expect(diasDesde('2026-11-01T12:00:00Z', '2026-11-01')).toBe(0)
  })
})

describe('restante da OS (fix 1)', () => {
  const ms = [
    { id: 'a', situacao: 'aprovada', percentualCentesimos: 3333, valorCentavos: 1_000_000 },
    { id: 'b', situacao: 'enviada', percentualCentesimos: 3333, valorCentavos: 1_000_000 },
    { id: 'c', situacao: 'recusada', percentualCentesimos: 5000, valorCentavos: 1_500_000 },
  ]
  it('soma só as não recusadas e tira a que está sendo editada', () => {
    expect(restanteDaOs(3_000_000, ms)).toEqual({ pct: 3334, valor: 1_000_000 })
    expect(restanteDaOs(3_000_000, ms, 'b')).toEqual({ pct: 6667, valor: 2_000_000 })
  })
  it('valor = restante leva o % restante exato; arredondamento nunca passa do restante', () => {
    const r = { pct: 3334, valor: 1_000_000 }
    expect(pctPorValor(3_000_000, 1_000_000, r)).toBe(3334) // sem o restante daria 33,33%
    expect(pctPorValor(3_000_000, 999_999, r)).toBe(3333)
    expect(pctPorValor(3_000_000, 1_000_000, { pct: 3333, valor: 1_000_100 })).toBe(3333) // limita
  })
  it('servidor: aceita o restante exato e o % limitado; recusa valor acima do restante', () => {
    const r = { pct: 3334, valor: 1_000_000 }
    expect(parAceitavel(3_000_000, 3334, 1_000_000, r)).toBe(true)
    expect(parAceitavel(3_000_000, 3333, 1_000_000, { pct: 3333, valor: 1_000_100 })).toBe(true)
    expect(parAceitavel(3_000_000, 3334, 1_000_001, r)).toBe(false)
    expect(parAceitavel(3_000_000, 3000, 1_000_000, r)).toBe(false)
  })
  it('OBRAS_VALOR do trigger vira pt-BR', () => {
    expect(erroDoBanco({ code: '42501', message: 'OBRAS_VALOR: só administrador altera o valor receita de obra da modalidade OBRA' }, 'x'))
      .toBe('Só administrador altera o valor receita de obra da modalidade OBRA')
  })
})
