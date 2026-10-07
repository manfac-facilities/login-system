// Simula o cache() do React dentro de uma requisição: memoriza por identidade
// dos argumentos. Fora de renderização o cache() real não memoriza nada.
jest.mock('react', () => ({
  cache: <A extends unknown[], R>(fn: (...a: A) => R) => {
    const memo = new Map<string, R>()
    const ids = new WeakMap<object, number>()
    let n = 0
    const idDe = (x: unknown) => {
      if (typeof x !== 'object' || x === null) return String(x)
      if (!ids.has(x)) ids.set(x, ++n)
      return `#${ids.get(x)}`
    }
    return (...a: A) => {
      const k = a.map(idDe).join('|')
      if (!memo.has(k)) memo.set(k, fn(...a))
      return memo.get(k) as R
    }
  },
}))

import { getNivel, isAdmin } from '../roles'
import { hasSystemAccess } from '../systemAccess'

function fakeSupabase(nivel: string | null) {
  const roles: Record<string, unknown> = {}
  roles.select = () => roles
  roles.eq = () => roles
  roles.maybeSingle = jest.fn().mockResolvedValue({ data: nivel ? { nivel } : null })
  const acesso: Record<string, unknown> = {}
  acesso.select = () => acesso
  acesso.eq = () => acesso
  acesso.maybeSingle = () => Promise.resolve({ data: { has_access: false } })
  return {
    from: jest.fn((t: string) => (t === 'hub_user_roles' ? roles : acesso)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const leiturasDeRoles = (s: { from: jest.Mock }) =>
  s.from.mock.calls.filter((c: string[]) => c[0] === 'hub_user_roles').length

describe('dedupe de hub_user_roles dentro da mesma requisição', () => {
  it('isAdmin + hasSystemAccess com o mesmo client leem o nível uma vez só', async () => {
    const s = fakeSupabase('analista')
    expect(await isAdmin(s, 'a@manfac.com.br')).toBe(false)
    expect(await hasSystemAccess(s, 'A@manfac.com.br ', 'obras')).toBe(false)
    expect(leiturasDeRoles(s)).toBe(1)
  })

  it('outro client (outra requisição/usuário) nunca reaproveita a resposta', async () => {
    const admin = fakeSupabase('administrador')
    const comum = fakeSupabase(null)
    expect(await getNivel(admin, 'a@manfac.com.br')).toBe('administrador')
    expect(await getNivel(comum, 'a@manfac.com.br')).toBeNull()
  })

  it('e-mails diferentes no mesmo client não se misturam', async () => {
    const s = fakeSupabase('administrador')
    await getNivel(s, 'a@manfac.com.br')
    await getNivel(s, 'b@manfac.com.br')
    expect(leiturasDeRoles(s)).toBe(2)
  })
})
