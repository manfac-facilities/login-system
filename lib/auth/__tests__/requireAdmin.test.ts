import { requireAdmin } from '../requireAdmin'

function makeSupabase(email: string | null) {
  return {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: email ? { email } : null } })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('requireAdmin', () => {
  it('retorna null para um e-mail admin', async () => {
    const result = await requireAdmin(makeSupabase('jvictorco28@gmail.com'))
    expect(result).toBeNull()
  })

  it('retorna mensagem de erro para um e-mail não-admin', async () => {
    const result = await requireAdmin(makeSupabase('operador@manfac.com.br'))
    expect(result).toBe('Apenas administradores podem executar esta ação')
  })

  it('retorna mensagem de erro quando não há usuário autenticado', async () => {
    const result = await requireAdmin(makeSupabase(null))
    expect(result).toBe('Apenas administradores podem executar esta ação')
  })
})
