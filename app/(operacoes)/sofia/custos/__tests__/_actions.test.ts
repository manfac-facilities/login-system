const insertMock = jest.fn()
const getUserMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({
      insert: insertMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { atualizarCentroCustoAction } from '../_actions'

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
  })

  it('rejeita usuário não-admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'operador@manfac.com.br' } } })

    const result = await atualizarCentroCustoAction({}, buildFormData())

    expect(result).toEqual({ error: 'Apenas administradores podem executar esta ação' })
    expect(insertMock).not.toHaveBeenCalled()
  })
})
