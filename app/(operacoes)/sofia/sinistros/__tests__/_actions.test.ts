const updateMock = jest.fn()
const eqMock = jest.fn()
const getUserMock = jest.fn()
const deleteEqMock = jest.fn()
const podeGerirMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : Promise.reject(new Error(`rpc inesperada: ${fn}`))
    ),
    from: jest.fn(() => ({
      update: updateMock,
      delete: jest.fn(() => ({ eq: deleteEqMock })),
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import {
  atualizarTratativaSinistroAction,
  atualizarAutorizacaoSinistroAction,
  excluirSinistroAction,
} from '../_actions'

const NON_ADMIN_EMAIL = 'operador@manfac.com.br'
const PODE = { data: true, error: null }
const NAO_PODE = { data: false, error: null }
const ERRO_RPC = { data: true, error: { message: 'x' } }

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
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    updateMock.mockReset()
    updateMock.mockReturnValue({ eq: eqMock })
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
    podeGerirMock.mockReset()
  })
  const fd = () => {
    const f = new FormData()
    f.set('status', 'autorizado')
    return f
  }

  it('gestor de frotas atualiza', async () => {
    podeGerirMock.mockResolvedValue(PODE)
    await atualizarAutorizacaoSinistroAction('sinistro-1', fd())
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['não pode gerir', NAO_PODE],
    ['erro na RPC', ERRO_RPC],
  ])('não atualiza quando %s', async (_n, resposta) => {
    podeGerirMock.mockResolvedValue(resposta)
    await atualizarAutorizacaoSinistroAction('sinistro-1', fd())
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('excluirSinistroAction', () => {
  const MSG = 'Apenas administradores ou gestores de frotas podem excluir sinistros'
  beforeEach(() => {
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    deleteEqMock.mockReset()
    deleteEqMock.mockResolvedValue({ error: null })
    podeGerirMock.mockReset()
  })
  const fdId = () => {
    const f = new FormData()
    f.set('id', 'sinistro-1')
    return f
  }

  it('gestor de frotas exclui', async () => {
    podeGerirMock.mockResolvedValue(PODE)
    expect(await excluirSinistroAction({}, fdId())).toEqual({ success: true })
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'sinistro-1')
  })

  it.each([
    ['não pode gerir', NAO_PODE],
    ['erro na RPC', ERRO_RPC],
  ])('nega quando %s', async (_n, resposta) => {
    podeGerirMock.mockResolvedValue(resposta)
    expect(await excluirSinistroAction({}, fdId())).toEqual({ error: MSG })
    expect(deleteEqMock).not.toHaveBeenCalled()
  })
})
