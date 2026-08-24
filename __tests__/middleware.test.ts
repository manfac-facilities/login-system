/**
 * @jest-environment node
 */
// middleware.ts importa `next/server`, que depende do global `Request` do
// Node (Fetch API) — daí rodar isolado em ambiente node, como sistemas.test.ts.
//
// Este é o único teste da guarda de autorização do diff do CRM — a parte
// mais importante e a única sem cobertura. O que importa aqui é o
// ROTEAMENTO: provar que a rota `/crm` cai na checagem de
// `hasSystemAccess('crm')`. Não testamos `hasSystemAccess` isolado — seria
// tautologia, já é coberto em outro lugar e é agnóstico de slug. É esta
// rede que impede alguém de "limpar" o bloco `isCrmPage` no futuro sem
// quebrar um teste.
import { NextRequest } from 'next/server'

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))
jest.mock('@/lib/auth/domain', () => ({
  isManfacEmail: jest.fn(),
}))
jest.mock('@/lib/auth/roles', () => ({
  isAdmin: jest.fn(),
}))
jest.mock('@/lib/auth/systemAccess', () => ({
  hasSystemAccess: jest.fn(),
}))

import { createServerClient } from '@supabase/ssr'
import { isManfacEmail } from '@/lib/auth/domain'
import { isAdmin } from '@/lib/auth/roles'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { middleware } from '@/middleware'

function mockUsuarioLogado(user: { email: string } | null) {
  ;(createServerClient as jest.Mock).mockReturnValue({
    auth: {
      getUser: jest.fn(async () => ({ data: { user } })),
      signOut: jest.fn(async () => ({ error: null })),
    },
  })
}

describe('middleware — guarda de autorização de /crm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(isManfacEmail as jest.Mock).mockReturnValue(true)
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
  })

  it('sem usuário logado, redireciona para /login', async () => {
    mockUsuarioLogado(null)
    const request = new NextRequest('https://hub.manfac.com.br/crm')

    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://hub.manfac.com.br/login')
  })

  it('logado sem acesso ao sistema crm, redireciona para /dashboard', async () => {
    mockUsuarioLogado({ email: 'analista@manfac.com.br' })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const request = new NextRequest('https://hub.manfac.com.br/crm')

    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://hub.manfac.com.br/dashboard')
    expect(hasSystemAccess).toHaveBeenCalledWith(
      expect.anything(),
      'analista@manfac.com.br',
      'crm'
    )
  })

  it('logado com acesso ao sistema crm, segue adiante sem redirecionar', async () => {
    mockUsuarioLogado({ email: 'comercial@manfac.com.br' })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    const request = new NextRequest('https://hub.manfac.com.br/crm')

    const response = await middleware(request)

    expect(response.headers.get('location')).toBeNull()
  })

  it('sub-rotas de /crm passam pela mesma checagem', async () => {
    mockUsuarioLogado({ email: 'analista@manfac.com.br' })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const request = new NextRequest('https://hub.manfac.com.br/crm/algum-lead')

    const response = await middleware(request)

    expect(hasSystemAccess).toHaveBeenCalledWith(
      expect.anything(),
      'analista@manfac.com.br',
      'crm'
    )
    expect(response.headers.get('location')).toBe('https://hub.manfac.com.br/dashboard')
  })
})
