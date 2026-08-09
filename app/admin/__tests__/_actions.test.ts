const getUserMock = jest.fn()
const upsertMock = jest.fn()
const listUsersMock = jest.fn()
const isAdminMock = jest.fn()
const rolesSelectMock = jest.fn()
const contarAdminsMock = jest.fn()
const nivelAtualMock = jest.fn()
const deleteUserMock = jest.fn()
const deleteRowsMock = jest.fn()
const tabelasApagadas: string[] = []

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({ upsert: upsertMock })),
  })),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    auth: { admin: { listUsers: listUsersMock, deleteUser: deleteUserMock } },
    from: jest.fn((tabela: string) => ({
      // O `select` do client admin serve a três chamadas diferentes:
      // a contagem de administradores, a leitura do nível atual de um e-mail
      // e a listagem completa de níveis.
      select: (colunas: string, opcoes?: { count?: string; head?: boolean }) => {
        if (opcoes?.count) {
          return { eq: async () => ({ count: await contarAdminsMock() }) }
        }
        if (colunas === 'nivel') {
          return {
            eq: () => ({
              maybeSingle: async () => {
                const nivel = await nivelAtualMock()
                return { data: nivel ? { nivel } : null }
              },
            }),
          }
        }
        return rolesSelectMock()
      },
      upsert: upsertMock,
      delete: () => ({
        eq: (...args: unknown[]) => {
          tabelasApagadas.push(tabela)
          return deleteRowsMock(...args)
        },
      }),
    })),
  })),
}))
jest.mock('@/lib/auth/roles', () => ({
  isAdmin: (...args: unknown[]) => isAdminMock(...args),
  normalizarEmail: (email: string) => email.trim().toLowerCase(),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  listarUsuariosAction,
  alternarAcessoAction,
  alterarNivelAction,
  removerUsuarioAction,
} from '../_actions'

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

describe('alterarNivelAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
    contarAdminsMock.mockResolvedValue(3)
    nivelAtualMock.mockResolvedValue('analista')
    upsertMock.mockResolvedValue({ error: null })
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await alterarNivelAction('ana@manfac.com.br', 'administrador')).toEqual({
      error: 'Apenas administradores podem alterar níveis',
    })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('refuses to change your own level', async () => {
    expect(await alterarNivelAction('CHEFE@manfac.com.br', 'analista')).toEqual({
      error: 'Você não pode alterar o seu próprio nível',
    })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('refuses an invalid level', async () => {
    // @ts-expect-error teste de valor inválido em runtime
    expect(await alterarNivelAction('ana@manfac.com.br', 'chefão')).toEqual({
      error: 'Nível inválido',
    })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('refuses to demote the last administrator', async () => {
    contarAdminsMock.mockResolvedValue(1)
    nivelAtualMock.mockResolvedValue('administrador')
    expect(await alterarNivelAction('outro@manfac.com.br', 'analista')).toEqual({
      error: 'O hub precisa de pelo menos um administrador',
    })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('demotes an administrator while others remain', async () => {
    contarAdminsMock.mockResolvedValue(2)
    nivelAtualMock.mockResolvedValue('administrador')
    expect(await alterarNivelAction('outro@manfac.com.br', 'analista')).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalled()
  })

  it('upserts the new level for an admin', async () => {
    expect(await alterarNivelAction('Ana@Manfac.com.br', 'administrador')).toEqual({
      success: true,
    })
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_email: 'ana@manfac.com.br',
        nivel: 'administrador',
        granted_by: 'chefe@manfac.com.br',
      }),
      { onConflict: 'user_email' }
    )
  })

  it('reports an error when the upsert fails', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'boom' } })
    expect(await alterarNivelAction('ana@manfac.com.br', 'administrador')).toEqual({
      error: 'Erro ao alterar o nível',
    })
  })
})

describe('removerUsuarioAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    tabelasApagadas.length = 0
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
    contarAdminsMock.mockResolvedValue(3)
    nivelAtualMock.mockResolvedValue('analista')
    deleteRowsMock.mockResolvedValue({ error: null })
    listUsersMock.mockResolvedValue({
      data: {
        users: [{ id: 'id-da-ana', email: 'ana@manfac.com.br', confirmed_at: '2026-01-01' }],
      },
      error: null,
    })
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await removerUsuarioAction('ana@manfac.com.br')).toEqual({
      error: 'Apenas administradores podem remover usuários',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('refuses to remove yourself', async () => {
    expect(await removerUsuarioAction('CHEFE@manfac.com.br')).toEqual({
      error: 'Você não pode remover a si mesmo',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('refuses to remove the last administrator', async () => {
    nivelAtualMock.mockResolvedValue('administrador')
    contarAdminsMock.mockResolvedValue(1)
    expect(await removerUsuarioAction('outro@manfac.com.br')).toEqual({
      error: 'O hub precisa de pelo menos um administrador',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('refuses when the user does not exist', async () => {
    listUsersMock.mockResolvedValue({ data: { users: [] }, error: null })
    expect(await removerUsuarioAction('fantasma@manfac.com.br')).toEqual({
      error: 'Usuário não encontrado',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('does not delete rows when deleting the account fails', async () => {
    deleteUserMock.mockResolvedValue({ error: { message: 'boom' } })
    expect(await removerUsuarioAction('ana@manfac.com.br')).toEqual({
      error: 'Erro ao remover o usuário',
    })
    expect(deleteRowsMock).not.toHaveBeenCalled()
  })

  it('deletes the account, the role and the system access', async () => {
    deleteUserMock.mockResolvedValue({ error: null })
    expect(await removerUsuarioAction('Ana@Manfac.com.br')).toEqual({ success: true })
    expect(deleteUserMock).toHaveBeenCalledWith('id-da-ana')
    expect(tabelasApagadas).toEqual(['hub_user_roles', 'hub_system_access'])
    expect(deleteRowsMock).toHaveBeenCalledWith('user_email', 'ana@manfac.com.br')
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
