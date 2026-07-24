const updateMock = jest.fn()
const eqMock = jest.fn()
const getUserMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({
      update: updateMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { atualizarTratativaSinistroAction, atualizarAutorizacaoSinistroAction } from '../_actions'

const NON_ADMIN_EMAIL = 'operador@manfac.com.br'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    id: 'sinistro-1',
    status: 'em_tratativa',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('atualizarTratativaSinistroAction', () => {
  beforeEach(() => {
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
    updateMock.mockReset()
    updateMock.mockReturnValue({ eq: eqMock })
  })

  it('updates only the case status, not the desconto fields', async () => {
    const result = await atualizarTratativaSinistroAction({}, buildFormData())

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ status: 'em_tratativa' })
  })

  it('rejeita status fora do enum sem gravar (achado B-17)', async () => {
    const result = await atualizarTratativaSinistroAction({}, buildFormData({ status: 'hackeado' }))

    expect(result.error).toBeTruthy()
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('atualizarAutorizacaoSinistroAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    updateMock.mockReset()
    updateMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
  })

  it('não atualiza quando o usuário não é admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    const fd = new FormData()
    fd.set('status', 'autorizado')
    await atualizarAutorizacaoSinistroAction('sinistro-1', fd)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
