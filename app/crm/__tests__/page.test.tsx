import { render, screen } from '@testing-library/react'

// Defesa em profundidade: createAdminClient() ignora RLS e site_leads não
// tem policy nenhuma — o middleware é "optimistic" (node_modules/next/dist/docs/
// 01-app/02-guides/authentication.md), então a página precisa checar de novo,
// perto do dado. Estes testes provam essa checagem e os dois estados de
// leitura (erro explícito vs. vazio) separadamente — nunca o mesmo caminho.

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/auth/systemAccess', () => ({
  hasSystemAccess: jest.fn(),
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import CrmPage from '../page'

function mockUsuario(user: { email: string } | null) {
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user } })) },
  })
}

function mockLeads(leads: unknown[]) {
  ;(createAdminClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: leads, error: null }),
        }),
      }),
    }),
  })
}

function mockErroLeitura() {
  ;(createAdminClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } }),
        }),
      }),
    }),
  })
}

describe('CrmPage — guarda de autorização', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sem usuário logado, redireciona para /login', async () => {
    mockUsuario(null)
    await expect(CrmPage()).rejects.toThrow('REDIRECT:/login')
  })

  it('sem acesso ao sistema crm, redireciona para /dashboard', async () => {
    mockUsuario({ email: 'analista@manfac.com.br' })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    await expect(CrmPage()).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('com acesso, segue e lê os leads', async () => {
    mockUsuario({ email: 'comercial@manfac.com.br' })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    mockLeads([])
    render(await CrmPage())
    expect(screen.getByText(/nenhum lead chegou/i)).toBeInTheDocument()
  })
})

describe('CrmPage — leitura de site_leads', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUsuario({ email: 'comercial@manfac.com.br' })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  })

  it('erro de leitura mostra estado de erro explícito — nunca o estado vazio', async () => {
    mockErroLeitura()
    render(await CrmPage())
    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument()
    expect(screen.queryByText(/nenhum lead chegou/i)).not.toBeInTheDocument()
  })

  it('leitura funcionando e sem leads mostra o estado vazio — nunca o de erro', async () => {
    mockLeads([])
    render(await CrmPage())
    expect(screen.getByText(/nenhum lead chegou/i)).toBeInTheDocument()
    expect(screen.queryByText(/não foi possível carregar/i)).not.toBeInTheDocument()
  })

  it('sem bater no teto de 200, não avisa truncamento', async () => {
    const leads = Array.from({ length: 5 }, (_, i) => leadFake(String(i)))
    mockLeads(leads)
    render(await CrmPage())
    expect(screen.queryByText(/mostrando os 200/i)).not.toBeInTheDocument()
  })

  it('ao bater exatamente 200 leads, avisa que está truncando', async () => {
    const leads = Array.from({ length: 200 }, (_, i) => leadFake(String(i)))
    mockLeads(leads)
    render(await CrmPage())
    expect(screen.getByText(/mostrando os 200/i)).toBeInTheDocument()
  })
})

function leadFake(id: string) {
  return {
    id,
    criado_em: '2026-08-21T17:32:00.000Z',
    atualizado_em: null,
    path: 'Obra ou reforma',
    nome: `Lead ${id}`,
    email: `lead${id}@empresa.com.br`,
    telefone: '(21) 99999-0000',
    consentimento: true,
    consentido_em: '2026-08-21T17:32:00.000Z',
    consentimento_texto: 'Autorizo a Manfac Engenharia a usar meus dados de contato para responder a esta solicitação.',
    empresa: null,
    cargo: null,
    localidade: null,
    unidades: null,
    resumo: null,
    etapa2_em: null,
  }
}
