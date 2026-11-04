// Gate de excluirChecklistAction: só admin desde 03/11/2026 (decisão do João; antes gestor de frotas).
// Só a action de exclusão: o resto do arquivo segue sem teste de _actions.
const escritaMock = jest.fn()
const eqMock = jest.fn()
const getUserMock = jest.fn()
const isAdminMock = jest.fn()
const fromMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string) =>
      fn === 'sofia_is_admin' ? isAdminMock() : Promise.reject(new Error(`rpc inesperada: ${fn}`))
    ),
    from: fromMock,
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { excluirChecklistAction } from '../_actions'

const MSG = 'Apenas administradores podem excluir checklists'

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
    isAdminMock.mockReset()
  })

  it('admin (sofia_is_admin = true) exclui', async () => {
    isAdminMock.mockResolvedValue({ data: true, error: null })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ success: true })
    expect(fromMock).toHaveBeenCalledWith('checklist')
    expect(eqMock).toHaveBeenCalledWith('id', 'reg-1')
  })

  it('gestor de frotas (não admin) recebe a mensagem e nada é gravado', async () => {
    isAdminMock.mockResolvedValue({ data: false, error: null })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ error: MSG })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('erro na RPC sofia_is_admin nega', async () => {
    isAdminMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ error: MSG })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('sem usuário nega sem consultar a RPC', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ error: MSG })
    expect(isAdminMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('erro de FK (23503) vira texto fixo de vínculo', async () => {
    isAdminMock.mockResolvedValue({ data: true, error: null })
    eqMock.mockResolvedValue({ error: { code: '23503', message: 'interno' } })
    expect(await excluirChecklistAction({}, fdId())).toEqual({
      error: 'Este registro tem vínculos (troca de responsabilidade/documentos) e não pode ser excluído',
    })
  })

  it('outro erro do banco vira mensagem genérica (nunca a do banco)', async () => {
    isAdminMock.mockResolvedValue({ data: true, error: null })
    eqMock.mockResolvedValue({ error: { code: 'P0001', message: 'Foto salva é prova' } })
    expect(await excluirChecklistAction({}, fdId())).toEqual({ error: 'Erro ao excluir checklist' })
  })
})
