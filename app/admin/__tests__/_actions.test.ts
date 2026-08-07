const getUserMock = jest.fn()
const upsertMock = jest.fn()
const listUsersMock = jest.fn()
const isAdminMock = jest.fn()
const rolesSelectMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({ upsert: upsertMock })),
  })),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    auth: { admin: { listUsers: listUsersMock } },
    from: jest.fn(() => ({ select: rolesSelectMock })),
  })),
}))
jest.mock('@/lib/auth/roles', () => ({
  isAdmin: (...args: unknown[]) => isAdminMock(...args),
  normalizarEmail: (email: string) => email.trim().toLowerCase(),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { listarUsuariosAction, alternarAcessoAction } from '../_actions'

describe('listarUsuariosAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
    rolesSelectMock.mockResolvedValue({
      data: [{ user_email: 'ana@manfac.com.br', nivel: 'analista' }],
      error: null,
    })
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    const result = await listarUsuariosAction()
    expect(result).toEqual({ error: 'Apenas administradores podem ver esta página' })
    expect(listUsersMock).not.toHaveBeenCalled()
  })

  it('merges nivel, nome and last sign in, sorted by email', async () => {
    listUsersMock.mockResolvedValueOnce({
      data: {
        users: [
          {
            id: '2',
            email: 'zeca@manfac.com.br',
            user_metadata: {},
            last_sign_in_at: null,
            confirmed_at: null,
          },
          {
            id: '1',
            email: 'ana@manfac.com.br',
            user_metadata: { full_name: 'Ana Souza' },
            last_sign_in_at: '2026-07-03T13:52:00Z',
            confirmed_at: '2026-06-01T10:00:00Z',
          },
        ],
      },
      error: null,
    })
    const result = await listarUsuariosAction()
    expect(result).toEqual([
      {
        id: '1',
        email: 'ana@manfac.com.br',
        nome: 'Ana Souza',
        nivel: 'analista',
        ultimoAcesso: '2026-07-03T13:52:00Z',
        convitePendente: false,
      },
      {
        id: '2',
        email: 'zeca@manfac.com.br',
        nome: null,
        nivel: null,
        ultimoAcesso: null,
        convitePendente: true,
      },
    ])
  })

  it('pages until a short page comes back, so it does not stop at 50', async () => {
    const cheia = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      email: `u${String(i).padStart(3, '0')}@manfac.com.br`,
      user_metadata: {},
      last_sign_in_at: null,
      confirmed_at: '2026-01-01T00:00:00Z',
    }))
    listUsersMock
      .mockResolvedValueOnce({ data: { users: cheia }, error: null })
      .mockResolvedValueOnce({ data: { users: [] }, error: null })

    const result = await listarUsuariosAction()
    expect(Array.isArray(result) && result).toHaveLength(100)
    expect(listUsersMock).toHaveBeenCalledTimes(2)
    expect(listUsersMock).toHaveBeenNthCalledWith(1, { page: 1, perPage: 100 })
    expect(listUsersMock).toHaveBeenNthCalledWith(2, { page: 2, perPage: 100 })
  })

  it('returns an error when listUsers fails', async () => {
    listUsersMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect(await listarUsuariosAction()).toEqual({ error: 'Erro ao listar usuários' })
  })
})

describe('alternarAcessoAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-admins', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'usuario@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(false)
    const result = await alternarAcessoAction('outro@manfac.com.br', 'conversor-os', true)
    expect(result).toEqual({ error: 'Apenas administradores podem alterar acessos' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('upserts access for an admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'jvictorco28@gmail.com' } } })
    isAdminMock.mockResolvedValue(true)
    upsertMock.mockResolvedValue({ error: null })
    const result = await alternarAcessoAction('outro@manfac.com.br', 'conversor-os', true)
    expect(result).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_email: 'outro@manfac.com.br',
        system_slug: 'conversor-os',
        has_access: true,
        granted_by: 'jvictorco28@gmail.com',
      },
      { onConflict: 'user_email,system_slug' }
    )
  })
})
