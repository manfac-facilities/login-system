const insertMock = jest.fn()
const getUserMock = jest.fn()
const podeGerirMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : Promise.reject(new Error(`rpc inesperada: ${fn}`))
    ),
    from: jest.fn(() => ({
      insert: insertMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { atualizarCentroCustoAction } from '../_actions'

const MSG = 'Apenas administradores ou gestores de frotas podem executar esta ação'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    veiculo_id: 'veiculo-1',
    centro_custo: 'CC-01',
    vigente_desde: '2026-07-01',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('atualizarCentroCustoAction', () => {
  beforeEach(() => {
    insertMock.mockReset()
    insertMock.mockResolvedValue({ error: null })
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: 'operador@manfac.com.br' } } })
    podeGerirMock.mockReset()
  })

  it('gestor de frotas (sofia_pode_gerir = true) registra o centro de custo', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: null })

    const result = await atualizarCentroCustoAction({}, buildFormData())

    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith({
      veiculo_id: 'veiculo-1',
      centro_custo: 'CC-01',
      vigente_desde: '2026-07-01',
    })
  })

  it('rejeita quem não pode gerir frotas', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })

    const result = await atualizarCentroCustoAction({}, buildFormData())

    expect(result).toEqual({ error: MSG })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('nega quando a RPC sofia_pode_gerir dá erro', async () => {
    podeGerirMock.mockResolvedValue({ data: null, error: { message: 'x' } })

    const result = await atualizarCentroCustoAction({}, buildFormData())

    expect(result).toEqual({ error: MSG })
    expect(insertMock).not.toHaveBeenCalled()
  })
})
