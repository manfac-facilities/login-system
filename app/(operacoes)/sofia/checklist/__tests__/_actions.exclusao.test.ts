// Gate de gestor de frotas em excluirChecklistAction (spec docs/frotas/2026-10-26-spec-gestor-frotas.md, T3).
// Só a action de exclusão: o resto do arquivo segue sem teste de _actions.
const escritaMock = jest.fn()
const eqMock = jest.fn()
const getUserMock = jest.fn()
const podeGerirMock = jest.fn()
const fromMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : Promise.reject(new Error(`rpc inesperada: ${fn}`))
    ),
    from: fromMock,
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { excluirChecklistAction } from '../_actions'

const MSG = 'Apenas administradores ou gestores de frotas podem excluir checklists'

function fdId(): FormData {
  const fd = new FormData()
  fd.set('id', 'reg-1')
  return fd
}

describe('excluirChecklistAction', () => {
  beforeEach(() => {
    escritaMock.mockReset()
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
    escritaMock.mockReturnValue({ eq: eqMock })
    fromMock.mockReset()
    fromMock.mockReturnValue({ delete: escritaMock })
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: 'igor@manfac.com.br' } } })
    podeGerirMock.mockReset()
  })

  it('gestor de frotas (sofia_pode_gerir = true) exclui', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: null })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ success: true })
    expect(fromMock).toHaveBeenCalledWith('checklist')
    expect(eqMock).toHaveBeenCalledWith('id', 'reg-1')
  })

  it('quem não pode gerir recebe a mensagem e nada é gravado', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ error: MSG })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('erro na RPC sofia_pode_gerir nega', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ error: MSG })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('sem usuário nega sem consultar a RPC', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ error: MSG })
    expect(podeGerirMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })
})
