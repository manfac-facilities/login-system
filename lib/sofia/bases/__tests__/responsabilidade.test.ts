import { resolverNaData, type TrechoBruto } from '../responsabilidade'

const t = (o: Partial<TrechoBruto> & { inicio: string }): TrechoBruto => ({
  veiculo_id: 'v1', equipe_id: 'e1', motorista_id: 'm1', fim: null, created_at: '2026-01-01T00:00:00Z', ...o,
})

describe('resolverNaData', () => {
  it('acha o trecho que cobre a data', () => {
    const h = [t({ inicio: '2026-01-01', fim: '2026-03-10', equipe_id: 'A' }), t({ inicio: '2026-03-10', equipe_id: 'B' })]
    expect(resolverNaData(h, 'v1', '2026-02-01')?.equipe_id).toBe('A')
    expect(resolverNaData(h, 'v1', '2026-05-01')?.equipe_id).toBe('B')
  })
  it('no dia da troca vale o trecho novo', () => {
    const h = [t({ inicio: '2026-01-01', fim: '2026-03-10', equipe_id: 'A' }), t({ inicio: '2026-03-10', equipe_id: 'B' })]
    expect(resolverNaData(h, 'v1', '2026-03-10')?.equipe_id).toBe('B')
  })
  it('empate de início: o criado por último', () => {
    const h = [
      t({ inicio: '2026-03-10', fim: '2026-03-10', equipe_id: 'A', created_at: '2026-03-10T08:00:00Z' }),
      t({ inicio: '2026-03-10', equipe_id: 'B', created_at: '2026-03-10T09:00:00Z' }),
    ]
    expect(resolverNaData(h, 'v1', '2026-03-10')?.equipe_id).toBe('B')
  })
  it('antes do primeiro trecho, outro veículo ou sem histórico: null', () => {
    const h = [t({ inicio: '2026-01-01' })]
    expect(resolverNaData(h, 'v1', '2025-12-31')).toBeNull()
    expect(resolverNaData(h, 'v2', '2026-02-01')).toBeNull()
    expect(resolverNaData([], 'v1', '2026-02-01')).toBeNull()
  })
  it('depois do fim sem trecho seguinte: null', () => {
    expect(resolverNaData([t({ inicio: '2026-01-01', fim: '2026-02-01' })], 'v1', '2026-02-02')).toBeNull()
  })
})
