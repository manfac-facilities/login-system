const updateEqMock = jest.fn()
const getUserMock = jest.fn()
const podeGerirMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : Promise.reject(new Error(`rpc inesperada: ${fn}`))
    ),
    from: jest.fn(() => ({
      update: jest.fn(() => ({ eq: updateEqMock })),
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { toggleEquipeAction, desativarEquipeAction } from '../_actions'

beforeEach(() => {
  updateEqMock.mockReset()
  updateEqMock.mockResolvedValue({ error: null })
  getUserMock.mockReset()
  getUserMock.mockResolvedValue({ data: { user: { email: 'operador@manfac.com.br' } } })
  podeGerirMock.mockReset()
})

describe('toggleEquipeAction', () => {
  it('gestor de frotas ativa a equipe', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: null })
    await toggleEquipeAction('equipe-1', true)
    expect(updateEqMock).toHaveBeenCalledWith('id', 'equipe-1')
  })

  it('não atualiza quando o usuário não pode gerir frotas', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    await toggleEquipeAction('equipe-1', true)
    expect(updateEqMock).not.toHaveBeenCalled()
  })

  it('não atualiza quando a RPC sofia_pode_gerir dá erro', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    await toggleEquipeAction('equipe-1', true)
    expect(updateEqMock).not.toHaveBeenCalled()
  })
})

describe('desativarEquipeAction', () => {
  const MSG = 'Apenas administradores ou gestores de frotas podem desativar equipes'
  function fdId() {
    const fd = new FormData()
    fd.set('id', 'equipe-1')
    return fd
  }

  it('gestor de frotas desativa', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: null })
    expect(await desativarEquipeAction({}, fdId())).toEqual({ success: true })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'equipe-1')
  })

  it('quem não pode gerir recebe a mensagem e nada é gravado', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await desativarEquipeAction({}, fdId())).toEqual({ error: MSG })
    expect(updateEqMock).not.toHaveBeenCalled()
  })

  it('erro na RPC sofia_pode_gerir nega', async () => {
    podeGerirMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await desativarEquipeAction({}, fdId())).toEqual({ error: MSG })
    expect(updateEqMock).not.toHaveBeenCalled()
  })
})
