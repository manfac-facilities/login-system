const getUserMock = jest.fn()
const upsertMock = jest.fn()
const listUsersMock = jest.fn()
const isAdminMock = jest.fn()
const rolesSelectMock = jest.fn()
const contarAdminsMock = jest.fn()
const nivelAtualMock = jest.fn()
const deleteUserMock = jest.fn()
const inviteMock = jest.fn()
const resetSenhaMock = jest.fn()
const deleteRowsMock = jest.fn()
const tabelasApagadas: string[] = []

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock, resetPasswordForEmail: resetSenhaMock },
  })),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    auth: {
      admin: {
        listUsers: listUsersMock,
        deleteUser: deleteUserMock,
        inviteUserByEmail: inviteMock,
      },
    },
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
jest.mock('@/lib/auth/domain', () => ({ isManfacEmail: jest.fn(() => true) }))

import { isManfacEmail } from '@/lib/auth/domain'
import {
  listarUsuariosAction,
  alternarAcessoAction,
  alterarNivelAction,
  removerUsuarioAction,
  convidarUsuarioAction,
  reenviarConviteAction,
  cancelarConviteAction,
  enviarResetSenhaAction,
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

  it('warns when a row survives the deletion, so it is not silently reused', async () => {
    deleteUserMock.mockResolvedValue({ error: null })
    deleteRowsMock.mockResolvedValue({ error: { message: 'boom' } })
    expect(await removerUsuarioAction('ana@manfac.com.br')).toEqual({
      error:
        'Conta apagada, mas sobraram registros de nível ou de acesso. Remova-os no Supabase antes de convidar esse e-mail de novo.',
    })
  })
})

describe('convidarUsuarioAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
    ;(isManfacEmail as jest.Mock).mockReturnValue(true)
    inviteMock.mockResolvedValue({ data: { user: { id: 'novo' } }, error: null })
    upsertMock.mockResolvedValue({ error: null })
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await convidarUsuarioAction('nova@manfac.com.br', 'analista', [])).toEqual({
      error: 'Apenas administradores podem convidar usuários',
    })
    expect(inviteMock).not.toHaveBeenCalled()
  })

  it('refuses an email outside the allowed domain before calling the API', async () => {
    ;(isManfacEmail as jest.Mock).mockReturnValue(false)
    expect(await convidarUsuarioAction('alguem@gmail.com', 'analista', [])).toEqual({
      error: 'Só é possível convidar e-mails @manfac.com.br',
    })
    expect(inviteMock).not.toHaveBeenCalled()
  })

  it('refuses an invalid level', async () => {
    // @ts-expect-error valor inválido em runtime
    expect(await convidarUsuarioAction('nova@manfac.com.br', 'dono', [])).toEqual({
      error: 'Nível inválido',
    })
    expect(inviteMock).not.toHaveBeenCalled()
  })

  it('invites, records the level and grants the chosen systems', async () => {
    expect(await convidarUsuarioAction('Nova@Manfac.com.br', 'analista', ['conversor-os'])).toEqual({
      success: true,
    })

    expect(inviteMock).toHaveBeenCalledWith('nova@manfac.com.br')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_email: 'nova@manfac.com.br', nivel: 'analista' }),
      { onConflict: 'user_email' }
    )
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_email: 'nova@manfac.com.br',
          system_slug: 'conversor-os',
          has_access: true,
        }),
      ]),
      { onConflict: 'user_email,system_slug' }
    )
  })

  it('does not touch hub_system_access when no system was chosen', async () => {
    await convidarUsuarioAction('nova@manfac.com.br', 'analista', [])
    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it('warns when the invite went out but the level could not be saved', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'boom' } })
    expect(await convidarUsuarioAction('nova@manfac.com.br', 'analista', [])).toEqual({
      error: 'Convite enviado, mas não foi possível gravar o nível. Ajuste na lista.',
    })
  })

  it('warns when the invite went out but the systems could not be granted', async () => {
    upsertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'boom' } })
    expect(await convidarUsuarioAction('nova@manfac.com.br', 'analista', ['sofia'])).toEqual({
      error: 'Convite enviado, mas não foi possível liberar os sistemas. Ajuste na lista.',
    })
  })

  it('reports a clear error when the invite fails', async () => {
    inviteMock.mockResolvedValue({ data: null, error: { message: 'já existe' } })
    expect(await convidarUsuarioAction('nova@manfac.com.br', 'analista', [])).toEqual({
      error: 'Erro ao enviar o convite. O e-mail já pode estar cadastrado.',
    })
    expect(upsertMock).not.toHaveBeenCalled()
  })
})

describe('ações de convite e senha', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    tabelasApagadas.length = 0
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
    deleteRowsMock.mockResolvedValue({ error: null })
    listUsersMock.mockResolvedValue({
      data: {
        users: [{ id: 'id-da-nova', email: 'nova@manfac.com.br', confirmed_at: null }],
      },
      error: null,
    })
  })

  it('reenviarConviteAction rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await reenviarConviteAction('nova@manfac.com.br')).toEqual({
      error: 'Apenas administradores podem reenviar convites',
    })
    expect(inviteMock).not.toHaveBeenCalled()
  })

  it('reenviarConviteAction invites again', async () => {
    inviteMock.mockResolvedValue({ data: { user: { id: 'x' } }, error: null })
    expect(await reenviarConviteAction('Nova@Manfac.com.br')).toEqual({ success: true })
    expect(inviteMock).toHaveBeenCalledWith('nova@manfac.com.br')
  })

  it('reenviarConviteAction reports a failure', async () => {
    inviteMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await reenviarConviteAction('nova@manfac.com.br')).toEqual({
      error: 'Erro ao reenviar o convite',
    })
  })

  it('cancelarConviteAction refuses to cancel a confirmed account', async () => {
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: '1', email: 'ana@manfac.com.br', confirmed_at: '2026-01-01' }] },
      error: null,
    })
    expect(await cancelarConviteAction('ana@manfac.com.br')).toEqual({
      error: 'Esse usuário já confirmou o cadastro. Use "Remover do hub".',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('cancelarConviteAction deletes the pending account and its rows', async () => {
    deleteUserMock.mockResolvedValue({ error: null })
    expect(await cancelarConviteAction('Nova@Manfac.com.br')).toEqual({ success: true })
    expect(deleteUserMock).toHaveBeenCalledWith('id-da-nova')
    expect(tabelasApagadas).toEqual(['hub_user_roles', 'hub_system_access'])
  })

  it('enviarResetSenhaAction rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await enviarResetSenhaAction('ana@manfac.com.br')).toEqual({
      error: 'Apenas administradores podem enviar redefinição de senha',
    })
    expect(resetSenhaMock).not.toHaveBeenCalled()
  })

  it('enviarResetSenhaAction sends the email with the normalized address', async () => {
    resetSenhaMock.mockResolvedValue({ error: null })
    expect(await enviarResetSenhaAction('Ana@Manfac.com.br')).toEqual({ success: true })
    expect(resetSenhaMock).toHaveBeenCalledWith('ana@manfac.com.br', expect.any(Object))
  })
})

describe('alternarAcessoAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await alternarAcessoAction('ana@manfac.com.br', 'sofia', true)).toEqual({
      error: 'Apenas administradores podem alterar acessos',
    })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('writes with the admin client and normalizes the email', async () => {
    upsertMock.mockResolvedValue({ error: null })
    expect(await alternarAcessoAction('Ana@Manfac.com.br', 'sofia', true)).toEqual({
      success: true,
    })
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_email: 'ana@manfac.com.br',
        system_slug: 'sofia',
        has_access: true,
        granted_by: 'chefe@manfac.com.br',
      },
      { onConflict: 'user_email,system_slug' }
    )
  })

  it('reports an error when the upsert fails', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'boom' } })
    expect(await alternarAcessoAction('ana@manfac.com.br', 'sofia', true)).toEqual({
      error: 'Erro ao atualizar acesso',
    })
  })
})
