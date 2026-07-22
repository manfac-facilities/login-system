/**
 * @jest-environment node
 */
// app/api/sofia/__tests__/veiculo-motorista.route.test.ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'is', 'maybeSingle']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let currentUserEmail: string | null
let hasAccessResult: boolean

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => makeChainable({ data: null })),
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUserEmail ? { email: currentUserEmail } : null } })) },
  })),
}))

jest.mock('@/lib/auth/systemAccess', () => ({
  hasSystemAccess: jest.fn(async () => hasAccessResult),
}))

import { GET } from '../veiculo-motorista/route'

describe('GET /api/sofia/veiculo-motorista', () => {
  beforeEach(() => {
    currentUserEmail = 'operador@manfac.com.br'
    hasAccessResult = true
  })

  it('retorna 401 sem usuário autenticado', async () => {
    currentUserEmail = null
    const res = await GET(new Request('http://localhost/api/sofia/veiculo-motorista?veiculo_id=v1'))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem acesso ao sistema sofia', async () => {
    hasAccessResult = false
    const res = await GET(new Request('http://localhost/api/sofia/veiculo-motorista?veiculo_id=v1'))
    expect(res.status).toBe(403)
  })

  it('retorna 200 quando o usuário tem acesso', async () => {
    const res = await GET(new Request('http://localhost/api/sofia/veiculo-motorista?veiculo_id=v1'))
    expect(res.status).toBe(200)
  })
})
