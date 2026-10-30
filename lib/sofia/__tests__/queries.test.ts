type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'lte', 'gte', 'single', 'is']
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

describe('getRevisoesAtrasadas', () => {
  it('does not let a newer corretiva entry mask an older overdue preventiva for the same vehicle', async () => {
    const rows = [
      { id: 'r-corretiva', veiculo_id: 'v1', tipo: 'corretiva', created_at: '2026-06-01', proxima_data: null },
      { id: 'r-preventiva', veiculo_id: 'v1', tipo: 'preventiva', created_at: '2026-01-01', proxima_data: '2020-01-01' },
    ]
    fromMock = jest.fn(() => makeChainable({ data: rows }))

    const result = await getRevisoesAtrasadas()

    expect(result.map((r) => r.id)).toContain('r-preventiva')
  })

  it('still flags only once per vehicle+tipo, using the most recent row of that tipo', async () => {
    const rows = [
      { id: 'r-new', veiculo_id: 'v1', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: '2020-01-01' },
      { id: 'r-old', veiculo_id: 'v1', tipo: 'preventiva', created_at: '2026-01-01', proxima_data: '2020-01-01' },
    ]
    fromMock = jest.fn(() => makeChainable({ data: rows }))

    const result = await getRevisoesAtrasadas()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r-new')
  })

  it('does not flag a vehicle+tipo whose most recent row is not overdue', async () => {
    const rows = [
      { id: 'r1', veiculo_id: 'v1', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: '2099-01-01' },
    ]
    fromMock = jest.fn(() => makeChainable({ data: rows }))

    const result = await getRevisoesAtrasadas()

    expect(result).toEqual([])
  })

  it('flags por KM quando km_atual do veículo >= proxima_km, informando km_passados', async () => {
    const rows = [
      { id: 'r1', veiculo_id: 'v1', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: null, proxima_km: 10000, veiculos: { km_atual: 10250 } },
    ]
    fromMock = jest.fn(() => makeChainable({ data: rows }))

    const result = await getRevisoesAtrasadas()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'r1', motivo: 'km', km_passados: 250 })
    expect(result[0]).not.toHaveProperty('veiculos')
  })

  it('não flaga por KM quando km_atual é nulo ou ainda não chegou', async () => {
    const rows = [
      { id: 'r1', veiculo_id: 'v1', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: null, proxima_km: 10000, veiculos: { km_atual: null } },
      { id: 'r2', veiculo_id: 'v2', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: null, proxima_km: 10000, veiculos: { km_atual: 9999 } },
    ]
    fromMock = jest.fn(() => makeChainable({ data: rows }))

    expect(await getRevisoesAtrasadas()).toEqual([])
  })

  it('data vencida e KM vencido: motivo data, km_passados preenchido', async () => {
    const rows = [
      { id: 'r1', veiculo_id: 'v1', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: '2020-01-01', proxima_km: 10000, veiculos: { km_atual: 10000 } },
    ]
    fromMock = jest.fn(() => makeChainable({ data: rows }))

    const result = await getRevisoesAtrasadas()

    expect(result[0]).toMatchObject({ motivo: 'data', km_passados: 0 })
  })
})

describe('getRevisoesVenceEmBreve', () => {
  it('lista só a que está a <= 1.000 km, com placa e km_restantes; atrasada fica de fora', async () => {
    const rows = [
      { id: 'breve', veiculo_id: 'v1', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: null, proxima_km: 49000, veiculos: { placa: 'RTE-4F21', km_atual: 48360 } },
      { id: 'atrasada', veiculo_id: 'v2', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: null, proxima_km: 60000, veiculos: { placa: 'QXB-7J58', km_atual: 61230 } },
      { id: 'longe', veiculo_id: 'v3', tipo: 'preventiva', created_at: '2026-06-01', proxima_data: null, proxima_km: 90000, veiculos: { placa: 'AAA-0A00', km_atual: 1000 } },
    ]
    fromMock = jest.fn(() => makeChainable({ data: rows }))

    const result = await getRevisoesVenceEmBreve()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'breve', placa: 'RTE-4F21', km_restantes: 640 })
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
