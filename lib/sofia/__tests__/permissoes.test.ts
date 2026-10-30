import {
  MSG_SEM_PERMISSAO_FROTAS,
  podeGerirFrotas,
  requireGestorFrotas,
} from '../permissoes'

function cliente(rpcImpl: () => unknown, user: unknown = { email: 'igor@manfac.com.br' }) {
  const rpc = jest.fn(rpcImpl)
  const getUser = jest.fn(async () => ({ data: { user } }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = { rpc, auth: { getUser } } as any
  return { supabase, rpc, getUser }
}

describe('podeGerirFrotas', () => {
  it('true só com { data: true, error: null }', async () => {
    const { supabase } = cliente(async () => ({ data: true, error: null }))
    expect(await podeGerirFrotas(supabase)).toBe(true)
  })

  it('chama rpc("sofia_pode_gerir") sem argumentos (identidade vem do JWT)', async () => {
    const { supabase, rpc } = cliente(async () => ({ data: true, error: null }))
    await podeGerirFrotas(supabase)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0]).toEqual(['sofia_pode_gerir'])
  })

  it.each([
    ['false', false],
    ['null', null],
    ['undefined', undefined],
    ['string "true"', 'true'],
    ['número 1', 1],
    ['objeto', { ok: true }],
  ])('false com data %s', async (_nome, data) => {
    const { supabase } = cliente(async () => ({ data, error: null }))
    expect(await podeGerirFrotas(supabase)).toBe(false)
  })

  it('false com error preenchido mesmo que data seja true', async () => {
    const { supabase } = cliente(async () => ({ data: true, error: { message: 'boom' } }))
    expect(await podeGerirFrotas(supabase)).toBe(false)
  })

  it('false quando a RPC lança (rede, função inexistente)', async () => {
    const { supabase } = cliente(async () => {
      throw new Error('fetch failed')
    })
    expect(await podeGerirFrotas(supabase)).toBe(false)
  })
})

describe('requireGestorFrotas', () => {
  it('nega sem chamar rpc quando não há usuário', async () => {
    const { supabase, rpc } = cliente(async () => ({ data: true, error: null }), null)
    expect(await requireGestorFrotas(supabase)).toBe(MSG_SEM_PERMISSAO_FROTAS)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('nega sem chamar rpc quando o usuário não tem e-mail', async () => {
    const { supabase, rpc } = cliente(async () => ({ data: true, error: null }), { id: 'x' })
    expect(await requireGestorFrotas(supabase)).toBe(MSG_SEM_PERMISSAO_FROTAS)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('null quando rpc devolve true', async () => {
    const { supabase } = cliente(async () => ({ data: true, error: null }))
    expect(await requireGestorFrotas(supabase)).toBeNull()
  })

  it('mensagem quando rpc devolve false', async () => {
    const { supabase } = cliente(async () => ({ data: false, error: null }))
    expect(await requireGestorFrotas(supabase)).toBe(MSG_SEM_PERMISSAO_FROTAS)
  })

  it('mensagem quando rpc dá erro', async () => {
    const { supabase } = cliente(async () => ({ data: null, error: { message: 'x' } }))
    expect(await requireGestorFrotas(supabase)).toBe(MSG_SEM_PERMISSAO_FROTAS)
  })

  it('a mensagem cita gestores de frotas', () => {
    expect(MSG_SEM_PERMISSAO_FROTAS).toBe(
      'Apenas administradores ou gestores de frotas podem executar esta ação'
    )
  })
})
