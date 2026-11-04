import { podeAutorizarDescontoMulta } from '../multaPermissoes'

function cliente(rpcImpl: () => unknown) {
  const rpc = jest.fn(rpcImpl)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = { rpc } as any
  return { supabase, rpc }
}

describe('podeAutorizarDescontoMulta (só admin, falha fechada)', () => {
  it('true só com { data: true, error: null } e pergunta sofia_is_admin sem argumentos', async () => {
    const { supabase, rpc } = cliente(async () => ({ data: true, error: null }))
    expect(await podeAutorizarDescontoMulta(supabase)).toBe(true)
    expect(rpc.mock.calls[0]).toEqual(['sofia_is_admin'])
  })

  it.each([
    ['false', false],
    ['null', null],
    ['undefined', undefined],
    ['string "true"', 'true'],
  ])('false com data %s', async (_n, data) => {
    const { supabase } = cliente(async () => ({ data, error: null }))
    expect(await podeAutorizarDescontoMulta(supabase)).toBe(false)
  })

  it('false com erro de RPC mesmo que data seja true', async () => {
    const { supabase } = cliente(async () => ({ data: true, error: { message: 'x' } }))
    expect(await podeAutorizarDescontoMulta(supabase)).toBe(false)
  })

  it('false quando a RPC lança', async () => {
    const { supabase } = cliente(async () => {
      throw new Error('fetch failed')
    })
    expect(await podeAutorizarDescontoMulta(supabase)).toBe(false)
  })
})
