import { hasSystemAccess, systemSlugsComAcesso } from '../systemAccess'

type Resp = { data: unknown; error?: unknown } | 'lanca'

// Fake que responde por tabela, sem mockar roles.ts: o teste cobre o caminho
// real isAdmin -> hub_user_roles e hub_system_access, em paralelo.
function fakeSupabase(tabelas: { roles?: Resp; acesso?: Resp }) {
  const ordem: string[] = []
  const client = {
    from: jest.fn((tabela: string) => {
      const chave = tabela === 'hub_user_roles' ? 'roles' : 'acesso'
      const resp = tabelas[chave] ?? { data: null }
      const q: Record<string, unknown> = {}
      q.select = jest.fn(() => q)
      q.eq = jest.fn(() => q)
      const executa = () => {
        ordem.push(tabela)
        return resp === 'lanca' ? Promise.reject(new Error('rede')) : Promise.resolve(resp)
      }
      q.maybeSingle = jest.fn(executa)
      q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => executa().then(res, rej)
      return q
    }),
    _ordem: ordem,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return client
}

const EMAIL = 'a@manfac.com.br'

describe('hasSystemAccess (resultado idêntico ao de antes)', () => {
  it('administrador: true, mesmo sem linha de acesso', async () => {
    const s = fakeSupabase({ roles: { data: { nivel: 'administrador' } }, acesso: { data: null } })
    expect(await hasSystemAccess(s, EMAIL, 'sofia')).toBe(true)
  })

  it('administrador: true mesmo se a consulta de acesso lançar erro', async () => {
    const s = fakeSupabase({ roles: { data: { nivel: 'administrador' } }, acesso: 'lanca' })
    expect(await hasSystemAccess(s, EMAIL, 'sofia')).toBe(true)
  })

  it('analista com has_access = true: true', async () => {
    const s = fakeSupabase({ roles: { data: { nivel: 'analista' } }, acesso: { data: { has_access: true } } })
    expect(await hasSystemAccess(s, EMAIL, 'obras')).toBe(true)
  })

  it('sem linha de nível mas com has_access = true: true', async () => {
    const s = fakeSupabase({ roles: { data: null }, acesso: { data: { has_access: true } } })
    expect(await hasSystemAccess(s, EMAIL, 'obras')).toBe(true)
  })

  it('has_access = false: false', async () => {
    const s = fakeSupabase({ roles: { data: null }, acesso: { data: { has_access: false } } })
    expect(await hasSystemAccess(s, EMAIL, 'obras')).toBe(false)
  })

  it('sem linha nenhuma: false', async () => {
    const s = fakeSupabase({ roles: { data: null }, acesso: { data: null } })
    expect(await hasSystemAccess(s, EMAIL, 'obras')).toBe(false)
  })

  it('erro de consulta devolvido pelo Supabase (data null): false, falha FECHADO', async () => {
    const s = fakeSupabase({
      roles: { data: null, error: { message: 'x' } },
      acesso: { data: null, error: { message: 'x' } },
    })
    expect(await hasSystemAccess(s, EMAIL, 'obras')).toBe(false)
  })

  it('has_access NULL no banco: false', async () => {
    const s = fakeSupabase({ roles: { data: null }, acesso: { data: { has_access: null } } })
    expect(await hasSystemAccess(s, EMAIL, 'obras')).toBe(false)
  })

  it('não-admin e a consulta de acesso lança: continua lançando, nunca vira true', async () => {
    const s = fakeSupabase({ roles: { data: null }, acesso: 'lanca' })
    await expect(hasSystemAccess(s, EMAIL, 'obras')).rejects.toThrow('rede')
  })

  it('a leitura do nível lança: continua lançando', async () => {
    const s = fakeSupabase({ roles: 'lanca', acesso: { data: { has_access: true } } })
    await expect(hasSystemAccess(s, EMAIL, 'obras')).rejects.toThrow('rede')
  })

  it('dispara as duas consultas antes de esperar qualquer uma (paralelo)', async () => {
    const s = fakeSupabase({ roles: { data: null }, acesso: { data: { has_access: true } } })
    const p = hasSystemAccess(s, EMAIL, 'obras')
    // Síncrono: as duas tabelas já foram pedidas antes de qualquer await resolver.
    expect(s.from).toHaveBeenCalledTimes(2)
    await p
  })
})

describe('systemSlugsComAcesso', () => {
  it('devolve só os slugs com has_access = true', async () => {
    const s = fakeSupabase({
      acesso: {
        data: [
          { system_slug: 'sofia', has_access: true },
          { system_slug: 'crm', has_access: false },
          { system_slug: 'obras', has_access: true },
          { system_slug: 'conversor-os', has_access: null },
        ],
      },
    })
    expect([...(await systemSlugsComAcesso(s, EMAIL))].sort()).toEqual(['obras', 'sofia'])
  })

  it('erro de consulta (data null) ou sem linhas: nenhum slug, falha FECHADO', async () => {
    expect((await systemSlugsComAcesso(fakeSupabase({ acesso: { data: null, error: { message: 'x' } } }), EMAIL)).size).toBe(0)
    expect((await systemSlugsComAcesso(fakeSupabase({ acesso: { data: [] } }), EMAIL)).size).toBe(0)
  })

  it('normaliza o e-mail como hasSystemAccess', async () => {
    const s = fakeSupabase({ acesso: { data: [] } })
    await systemSlugsComAcesso(s, '  A@Manfac.com.BR ')
    const q = s.from.mock.results[0].value
    expect(q.eq).toHaveBeenCalledWith('user_email', 'a@manfac.com.br')
  })
})
