const getUserMock = jest.fn()
const upsertMock = jest.fn()
const listUsersMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({ upsert: upsertMock })),
  })),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { admin: { listUsers: listUsersMock } },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { listarUsuariosAction, alternarAcessoAction } from '../_actions'

describe('listarUsuariosAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-admins', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'usuario@manfac.com.br' } } })
    const result = await listarUsuariosAction()
    expect(result).toEqual({ error: 'Apenas administradores podem ver esta página' })
    expect(listUsersMock).not.toHaveBeenCalled()
  })

  it('returns a sorted list of users for an admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'jvictorco28@gmail.com' } } })
    listUsersMock.mockResolvedValue({
      data: {
        users: [
          { id: '2', email: 'zeca@manfac.com.br' },
          { id: '1', email: 'ana@manfac.com.br' },
        ],
      },
      error: null,
    })
    const result = await listarUsuariosAction()
    expect(result).toEqual([
      { id: '1', email: 'ana@manfac.com.br' },
      { id: '2', email: 'zeca@manfac.com.br' },
    ])
  })
})

describe('alternarAcessoAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-admins', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'usuario@manfac.com.br' } } })
    const result = await alternarAcessoAction('outro@manfac.com.br', 'conversor-os', true)
    expect(result).toEqual({ error: 'Apenas administradores podem alterar acessos' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('upserts access for an admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'jvictorco28@gmail.com' } } })
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
