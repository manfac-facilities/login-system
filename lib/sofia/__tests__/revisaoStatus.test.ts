import { classificarRevisao, situacaoRevisaoView } from '../revisaoStatus'

const HOJE = '2026-10-26'
const rev = (proxima_data: string | null, proxima_km: number | null) => ({ proxima_data, proxima_km })

describe('classificarRevisao', () => {
  it('km previsto nulo: só a data conta', () => {
    expect(classificarRevisao(rev('2099-01-01', null), 999999, HOJE).situacao).toBe('em_dia')
    const c = classificarRevisao(rev('2020-01-01', null), 1, HOJE)
    expect(c).toMatchObject({ situacao: 'atrasada', motivos: ['data'], kmPassados: null })
  })

  it('km_atual nulo ou indefinido: nunca atrasa nem avisa por km', () => {
    expect(classificarRevisao(rev(null, 10000), null, HOJE).situacao).toBe('em_dia')
    expect(classificarRevisao(rev(null, 10000), undefined, HOJE).situacao).toBe('em_dia')
  })

  it('exatamente no limite de km já é atrasada, com 0 km passados', () => {
    const c = classificarRevisao(rev(null, 10000), 10000, HOJE)
    expect(c).toMatchObject({ situacao: 'atrasada', motivos: ['km'], kmPassados: 0 })
  })

  it('depois do limite informa quantos km passaram', () => {
    expect(classificarRevisao(rev(null, 10000), 10350, HOJE).kmPassados).toBe(350)
  })

  it('faltando exatamente 1.000 km vence em breve; 1.001 km ainda está em dia', () => {
    const c = classificarRevisao(rev(null, 10000), 9000, HOJE)
    expect(c).toMatchObject({ situacao: 'vence_em_breve', motivos: [], kmRestantes: 1000 })
    expect(classificarRevisao(rev(null, 10000), 8999, HOJE).situacao).toBe('em_dia')
  })

  it('1 km antes do limite ainda é vence em breve, não atrasada', () => {
    expect(classificarRevisao(rev(null, 10000), 9999, HOJE)).toMatchObject({ situacao: 'vence_em_breve', kmRestantes: 1 })
  })

  it('data vencida e km vencido ao mesmo tempo: atrasada com os dois motivos', () => {
    const c = classificarRevisao(rev('2020-01-01', 10000), 10200, HOJE)
    expect(c).toMatchObject({ situacao: 'atrasada', motivos: ['data', 'km'], kmPassados: 200 })
  })

  it('data vencida com km ainda na margem: atrasada só por data', () => {
    const c = classificarRevisao(rev('2020-01-01', 10000), 9500, HOJE)
    expect(c).toMatchObject({ situacao: 'atrasada', motivos: ['data'], kmRestantes: 500 })
  })

  it('data igual a hoje não é atrasada', () => {
    expect(classificarRevisao(rev(HOJE, null), null, HOJE).situacao).toBe('em_dia')
  })
})

describe('situacaoRevisaoView', () => {
  it('em dia mostra quanto falta, em tom neutro', () => {
    expect(situacaoRevisaoView(rev('2027-01-01', 60000), 48360, HOJE)).toEqual({
      label: 'Em dia', tom: 'verde', dicas: [{ texto: 'faltam 11.640 km', tom: 'neutro' }],
    })
  })
  it('vence em breve: faltam <= 1.000 km', () => {
    expect(situacaoRevisaoView(rev(null, 49000), 48360, HOJE)).toEqual({
      label: 'Vence em breve', tom: 'ambar', dicas: [{ texto: 'faltam 640 km', tom: 'ambar' }],
    })
  })
  it('atrasada por KM', () => {
    expect(situacaoRevisaoView(rev(null, 60000), 61230, HOJE)).toEqual({
      label: 'Atrasada por KM', tom: 'vermelho', dicas: [{ texto: 'passou 1.230 km', tom: 'vermelho' }],
    })
  })
  it('atrasada por data, com singular e plural de dias', () => {
    const v = situacaoRevisaoView(rev('2026-10-15', null), null, HOJE)
    expect(v.label).toBe('Atrasada por data')
    expect(v.dicas).toEqual([{ texto: 'venceu há 11 dias', tom: 'vermelho' }])
    expect(situacaoRevisaoView(rev('2026-10-25', null), null, HOJE).dicas[0].texto).toBe('venceu há 1 dia')
  })
  it('atrasada por KM e data', () => {
    const v = situacaoRevisaoView(rev('2026-10-15', 30150), 31000, HOJE)
    expect(v.label).toBe('Atrasada por KM e data')
    expect(v.dicas.map((d) => d.texto)).toEqual(['passou 850 km', 'venceu há 11 dias'])
  })
  it('sem km atual e sem data vencida: em dia sem dicas', () => {
    expect(situacaoRevisaoView(rev(null, 50000), null, HOJE)).toEqual({ label: 'Em dia', tom: 'verde', dicas: [] })
  })
})
