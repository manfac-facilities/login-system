const insertMock = jest.fn()
const deleteEqMock = jest.fn()
const getUserMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
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
  beforeEach(() => {
    deleteEqMock.mockReset()
    deleteEqMock.mockResolvedValue({ error: null })
    getUserMock.mockReset()
  })

  it('rejeita usuário não-admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'operador@manfac.com.br' } } })
    const fd = new FormData()
    fd.set('id', 'abast-1')

    const result = await deletarAbastecimentoAction({}, fd)

    expect(result).toEqual({ error: 'Apenas administradores podem executar esta ação' })
    expect(deleteEqMock).not.toHaveBeenCalled()
  })
})
