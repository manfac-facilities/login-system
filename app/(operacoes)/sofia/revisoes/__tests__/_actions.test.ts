// criarRevisaoAction: peças trocadas e a próxima revisão (spec 2026-11-03 §1.3).
const insertMock = jest.fn()
let veiculo: Record<string, unknown> | null
let anteriores: Record<string, unknown>[]

function consulta(resultado: () => unknown) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'range']) q[m] = () => q
  q.maybeSingle = async () => resultado()
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado()).then(ok)
  return q
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((t: string) => {
      if (t === 'veiculos') return consulta(() => ({ data: veiculo, error: null }))
      return { ...consulta(() => ({ data: anteriores, error: null })), insert: insertMock }
    }),
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: jest.fn() }))

import { criarRevisaoAction } from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    veiculo_id: 'veiculo-1',
    tipo: 'preventiva',
    fornecedor: '',
    observacoes: '',
    pecas_trocadas: '',
    km_realizada: '30000',
    data_realizada: '2026-11-01',
    modo_proxima: 'auto',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const rev = (km: number, data: string) => ({
  id: `r${km}`, veiculo_id: 'veiculo-1', tipo: 'preventiva', km_realizada: km, data_realizada: data,
  created_at: `${data}T10:00:00Z`, proxima_km: null, proxima_data: null, prever_proxima: true,
})

beforeEach(() => {
  insertMock.mockReset()
  insertMock.mockResolvedValue({ error: null })
  veiculo = { id: 'veiculo-1', km_atual: 31000, intervalo_revisao_km: null }
  anteriores = []
})

describe('criarRevisaoAction: peças trocadas', () => {
  it('grava o texto das peças, sem espaços nas pontas', async () => {
    const result = await criarRevisaoAction({}, buildFormData({ pecas_trocadas: '  Óleo 5W30\nFiltro de óleo  ' }))

    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ pecas_trocadas: 'Óleo 5W30\nFiltro de óleo' }))
  })

  it('campo vazio ou só espaços grava null', async () => {
    await criarRevisaoAction({}, buildFormData({ pecas_trocadas: '   ' }))

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ pecas_trocadas: null }))
  })
})

describe('criarRevisaoAction: próxima revisão', () => {
  it('auto grava km + 10.000 mesmo se o form mandar outro proxima_km; origem manual', async () => {
    expect(await criarRevisaoAction({}, buildFormData({ proxima_km: '99999' }))).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      km_realizada: 30000, proxima_km: 40000, prever_proxima: true, origem: 'manual',
    }))
  })

  it('auto usa o intervalo próprio do carro', async () => {
    veiculo = { id: 'veiculo-1', km_atual: 31000, intervalo_revisao_km: 15000 }
    await criarRevisaoAction({}, buildFormData())
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ proxima_km: 45000 }))
  })

  it('manual grava o informado; sem KM → erro e nada gravado', async () => {
    await criarRevisaoAction({}, buildFormData({ modo_proxima: 'manual', proxima_km: '38000' }))
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ proxima_km: 38000, prever_proxima: true }))
    insertMock.mockClear()
    expect(await criarRevisaoAction({}, buildFormData({ modo_proxima: 'manual', proxima_km: '' }))).toEqual({
      error: 'Informe o KM da próxima revisão ou escolha outra opção.',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('"nao" grava prever_proxima=false e proxima_km=null', async () => {
    await criarRevisaoAction({}, buildFormData({ modo_proxima: 'nao', proxima_km: '40000', proxima_data: '2027-01-01' }))
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ prever_proxima: false, proxima_km: null, proxima_data: null }))
  })

  it('KM da revisão é obrigatório', async () => {
    expect(await criarRevisaoAction({}, buildFormData({ km_realizada: '' }))).toEqual({ error: 'Informe o KM da revisão.' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('KM menor que o da vigente com data igual ou posterior → erro', async () => {
    anteriores = [rev(32000, '2026-10-01')]
    expect(await criarRevisaoAction({}, buildFormData({ km_realizada: '30000', data_realizada: '2026-11-01' }))).toEqual({
      error: 'O KM (30.000) é menor que o da última revisão deste carro (32.000). Confira o número.',
    })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('KM menor que o da vigente com data anterior (histórico) passa', async () => {
    anteriores = [rev(32000, '2026-10-01')]
    expect(await criarRevisaoAction({}, buildFormData({ km_realizada: '20000', data_realizada: '2026-03-01' }))).toEqual({ success: true })
  })
})
