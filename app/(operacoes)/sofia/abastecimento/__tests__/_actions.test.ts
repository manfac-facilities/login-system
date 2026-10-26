const insertMock = jest.fn()
const deleteEqMock = jest.fn()
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
      delete: jest.fn(() => ({ eq: deleteEqMock })),
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { lancarAbastecimentoAction, deletarAbastecimentoAction } from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    veiculo_id: 'veiculo-1',
    data: '2026-06-01',
    litros: '45.5',
    valor: '250.00',
    km: '',
    posto: '',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('lancarAbastecimentoAction', () => {
  beforeEach(() => {
    insertMock.mockReset()
    insertMock.mockResolvedValue({ error: null })
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: 'jvictorco28@gmail.com' } } })
  })

  it('accepts an abastecimento with valor 0 (e.g. a free fuel voucher)', async () => {
    const result = await lancarAbastecimentoAction({}, buildFormData({ valor: '0' }))

    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ valor: 0 }))
  })

  it('accepts an abastecimento with litros 0', async () => {
    const result = await lancarAbastecimentoAction({}, buildFormData({ litros: '0' }))

    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ litros: 0 }))
  })

  it('still rejects when litros is left blank', async () => {
    const result = await lancarAbastecimentoAction({}, buildFormData({ litros: '' }))

    expect(result.error).toBeTruthy()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('still rejects when valor is left blank', async () => {
    const result = await lancarAbastecimentoAction({}, buildFormData({ valor: '' }))

    expect(result.error).toBeTruthy()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('still rejects when veiculo_id is missing', async () => {
    const result = await lancarAbastecimentoAction({}, buildFormData({ veiculo_id: '' }))

    expect(result.error).toBeTruthy()
    expect(insertMock).not.toHaveBeenCalled()
  })
})

describe('deletarAbastecimentoAction', () => {
  const MSG = 'Apenas administradores ou gestores de frotas podem executar esta ação'
  function fdId() {
    const fd = new FormData()
    fd.set('id', 'abast-1')
    return fd
  }

  beforeEach(() => {
    deleteEqMock.mockReset()
    deleteEqMock.mockResolvedValue({ error: null })
    insertMock.mockReset()
    insertMock.mockResolvedValue({ error: null })
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: 'operador@manfac.com.br' } } })
    podeGerirMock.mockReset()
  })

  it('gestor de frotas (sofia_pode_gerir = true) exclui', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: null })
    const result = await deletarAbastecimentoAction({}, fdId())
    expect(result).toEqual({ success: true })
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'abast-1')
  })

  it('rejeita quem não pode gerir frotas', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    const result = await deletarAbastecimentoAction({}, fdId())
    expect(result).toEqual({ error: MSG })
    expect(deleteEqMock).not.toHaveBeenCalled()
  })

  it('nega quando a RPC sofia_pode_gerir dá erro', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    const result = await deletarAbastecimentoAction({}, fdId())
    expect(result).toEqual({ error: MSG })
    expect(deleteEqMock).not.toHaveBeenCalled()
  })
})
