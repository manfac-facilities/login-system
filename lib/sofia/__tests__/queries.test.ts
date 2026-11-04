type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'lte', 'gte', 'single', 'is', 'range']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let fromMock: jest.Mock

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: (...args: unknown[]) => fromMock(...args),
  })),
}))

import { getMultasPendentes, getRevisoesAtrasadas, getRevisoesVenceEmBreve, getResponsabilidadesAtuais, getChecklistsRecentes, getVeiculos, getKmResumoMensal } from '../queries'

describe('propagação de erro (achado B-08)', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('propaga (lança) quando a query simples retorna erro, em vez de devolver lista vazia', async () => {
    fromMock = jest.fn(() => makeChainable({ data: null, error: { message: 'RLS negou' } }))

    await expect(getVeiculos()).rejects.toThrow(/carregar/i)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('propaga também nas queries com pós-processamento (getRevisoesAtrasadas)', async () => {
    fromMock = jest.fn(() => makeChainable({ data: null, error: { message: 'timeout' } }))

    await expect(getRevisoesAtrasadas()).rejects.toThrow(/carregar/i)
  })

  it('propaga na agregação de KM (getKmResumoMensal)', async () => {
    fromMock = jest.fn(() => makeChainable({ data: null, error: { message: 'timeout' } }))

    await expect(getKmResumoMensal()).rejects.toThrow(/carregar/i)
  })

  it('não lança quando não há erro, mesmo com data vazio', async () => {
    fromMock = jest.fn(() => makeChainable({ data: [], error: null }))

    await expect(getVeiculos()).resolves.toEqual([])
  })
})

describe('getMultasPendentes', () => {
  it('counts multas as pending while validada, not only while pendente', async () => {
    const chain = makeChainable({ data: [] })
    fromMock = jest.fn(() => chain)

    await getMultasPendentes()

    expect(chain.neq).toHaveBeenCalledWith('status', 'descontada')
    expect(chain.eq).not.toHaveBeenCalled()
  })
})

// Regra da revisão vigente (spec 2026-11-03 manutenção §1.1): por carro, maior km_realizada; próxima efetiva.
function porTabela(revisoes: unknown[], veiculos: unknown[]) {
  fromMock = jest.fn((t: string) => makeChainable({ data: t === 'revisoes' ? revisoes : t === 'veiculos' ? veiculos : [] }))
}
const V = (id: string, km_atual: number, extra: Record<string, unknown> = {}) => ({
  id, placa: 'P-' + id, modelo: 'Strada', km_atual, status: 'ativo', intervalo_revisao_km: null, ...extra,
})
const R = (id: string, veiculo_id: string, extra: Record<string, unknown>) => ({
  id, veiculo_id, tipo: 'preventiva', km_realizada: null, data_realizada: null, created_at: '2026-06-01',
  proxima_km: null, proxima_data: null, prever_proxima: true, ...extra,
})

describe('getRevisoesAtrasadas', () => {
  it('vigente = maior KM realizado: histórico importado depois (KM menor) não vira vigente', async () => {
    porTabela(
      [
        R('atual', 'v1', { km_realizada: 40000, created_at: '2026-01-01' }),
        R('importada', 'v1', { km_realizada: 10000, created_at: '2026-11-03' }),
      ],
      [V('v1', 45000)]
    )
    // atual: próxima 50.000 (auto), carro em 45.000 → em dia; a importada (próxima 20.000) diria atrasada.
    expect(await getRevisoesAtrasadas()).toEqual([])
  })

  it('próxima calculada sozinha (sem proxima_km) atrasa por KM e devolve a próxima efetiva', async () => {
    porTabela([R('r1', 'v1', { km_realizada: 10000 })], [V('v1', 20250)])
    const result = await getRevisoesAtrasadas()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'r1', placa: 'P-v1', motivo: 'km', km_passados: 250, proxima_km: 20000 })
  })

  it('usa o intervalo próprio do carro', async () => {
    porTabela([R('r1', 'v1', { km_realizada: 10000 })], [V('v1', 16000, { intervalo_revisao_km: 5000 })])
    expect((await getRevisoesAtrasadas()).map((r) => r.id)).toEqual(['r1'])
  })

  it('vigente com "não prever" e carro inativo ficam de fora', async () => {
    porTabela(
      [R('r1', 'v1', { km_realizada: 10000, prever_proxima: false }), R('r2', 'v2', { km_realizada: 10000 })],
      [V('v1', 90000), V('v2', 90000, { status: 'inativo' })]
    )
    expect(await getRevisoesAtrasadas()).toEqual([])
  })

  it('data vencida e KM vencido: motivo data, km_passados preenchido', async () => {
    porTabela([R('r1', 'v1', { km_realizada: 0, proxima_km: 10000, proxima_data: '2020-01-01' })], [V('v1', 10000)])
    expect((await getRevisoesAtrasadas())[0]).toMatchObject({ motivo: 'data', km_passados: 0 })
  })
})

describe('getRevisoesVenceEmBreve', () => {
  it('lista só a que está a <= 1.000 km, com placa e km_restantes; atrasada fica de fora', async () => {
    porTabela(
      [
        R('breve', 'v1', { km_realizada: 39000, proxima_km: 49000 }),
        R('atrasada', 'v2', { km_realizada: 50000, proxima_km: 60000 }),
        R('longe', 'v3', { km_realizada: 0, proxima_km: 90000 }),
      ],
      [V('v1', 48360), V('v2', 61230), V('v3', 1000)]
    )
    const result = await getRevisoesVenceEmBreve()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'breve', placa: 'P-v1', km_restantes: 640 })
    expect((await getRevisoesAtrasadas()).map((r) => r.id)).toEqual(['atrasada'])
  })
})

describe('getResponsabilidadesAtuais', () => {
  it('filters to rows whose fim is still null', async () => {
    const chain = makeChainable({ data: [] })
    fromMock = jest.fn(() => chain)

    await getResponsabilidadesAtuais()

    expect(chain.is).toHaveBeenCalledWith('fim', null)
  })
})

describe('getChecklistsRecentes', () => {
  it('orders by created_at descending so the first row per vehicle is the most recent', async () => {
    const chain = makeChainable({ data: [] })
    fromMock = jest.fn(() => chain)

    await getChecklistsRecentes()

    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })
})
