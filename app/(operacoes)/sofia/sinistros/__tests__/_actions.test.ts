const updateMock = jest.fn()
const eqMock = jest.fn()
const getUserMock = jest.fn()
const deleteEqMock = jest.fn()
const podeGerirMock = jest.fn()
const isAdminMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string) =>
      fn === 'sofia_pode_gerir'
        ? podeGerirMock()
        : fn === 'sofia_is_admin'
          ? isAdminMock()
          : Promise.reject(new Error(`rpc inesperada: ${fn}`))
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

describe('excluirSinistroAction (só admin, decisão do João 03/11)', () => {
  const MSG = 'Apenas administradores podem excluir sinistros'
  beforeEach(() => {
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    deleteEqMock.mockReset()
    deleteEqMock.mockResolvedValue({ error: null })
    podeGerirMock.mockReset()
    podeGerirMock.mockResolvedValue(PODE)
    isAdminMock.mockReset()
  })
  const fdId = () => {
    const f = new FormData()
    f.set('id', 'sinistro-1')
    return f
  }

  it('admin exclui', async () => {
    isAdminMock.mockResolvedValue(PODE)
    expect(await excluirSinistroAction({}, fdId())).toEqual({ success: true })
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'sinistro-1')
  })

  it.each([
    ['gestor de frotas (não é admin)', NAO_PODE],
    ['erro na RPC', ERRO_RPC],
  ])('nega quando %s, sem tentar excluir', async (_n, resposta) => {
    isAdminMock.mockResolvedValue(resposta)
    expect(await excluirSinistroAction({}, fdId())).toEqual({ error: MSG })
    expect(deleteEqMock).not.toHaveBeenCalled()
  })

  it('erro de FK (23503) vira texto fixo de vínculo', async () => {
    isAdminMock.mockResolvedValue(PODE)
    deleteEqMock.mockResolvedValue({ error: { code: '23503', message: 'interno' } })
    expect(await excluirSinistroAction({}, fdId())).toEqual({
      error: 'Este registro tem vínculos (troca de responsabilidade/documentos) e não pode ser excluído',
    })
  })

  it('outro erro do banco vira mensagem genérica (nunca a do banco)', async () => {
    isAdminMock.mockResolvedValue(PODE)
    deleteEqMock.mockResolvedValue({ error: { code: 'P0001', message: 'Apenas administradores podem excluir' } })
    expect(await excluirSinistroAction({}, fdId())).toEqual({ error: 'Erro ao excluir sinistro' })
  })
})
