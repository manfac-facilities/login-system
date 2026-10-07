import { render, screen } from '@testing-library/react'

jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ systemSlugsComAcesso: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { email: 'ana@manfac.com.br', user_metadata: { full_name: 'Ana Souza' } } },
      })),
    },
  })),
}))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('../actions', () => ({ logoutAction: jest.fn() }))

import { isAdmin } from '@/lib/auth/roles'
import { systemSlugsComAcesso } from '@/lib/auth/systemAccess'
import DashboardPage from '../page'

function comAcessoA(...slugs: string[]) {
  ;(systemSlugsComAcesso as jest.Mock).mockResolvedValue(new Set(slugs))
}

describe('DashboardPage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows all three cards for an administrator', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    comAcessoA()
    render(await DashboardPage())
    expect(screen.getByText('Gestão de Frotas')).toBeInTheDocument()
    expect(screen.getByText('Conversor OS')).toBeInTheDocument()
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Gestão de Obras')).toBeInTheDocument()
  })

  it('hides systems the analyst cannot open', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    comAcessoA('conversor-os')
    render(await DashboardPage())
    expect(screen.queryByText('Gestão de Frotas')).not.toBeInTheDocument()
    expect(screen.getByText('Conversor OS')).toBeInTheDocument()
    expect(screen.queryByText('CRM')).not.toBeInTheDocument()
    expect(screen.queryByText('Gestão de Obras')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows the CRM card for an analyst with access to it', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    comAcessoA('crm')
    render(await DashboardPage())
    expect(screen.getByText('CRM')).toBeInTheDocument()
  })

  it('o card da Gestão de Obras vai direto para /obras/base', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    comAcessoA('obras')
    render(await DashboardPage())
    expect(screen.getByText('Gestão de Obras').closest('a')).toHaveAttribute('href', '/obras/base')
  })

  it('has_access de um slug não vaza para os outros cards', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    comAcessoA('sofia', 'dashboard-manutencao')
    render(await DashboardPage())
    expect(screen.getByText('Gestão de Frotas')).toBeInTheDocument()
    expect(screen.queryByText('Conversor OS')).not.toBeInTheDocument()
    expect(screen.queryByText('CRM')).not.toBeInTheDocument()
    expect(screen.queryByText('Gestão de Obras')).not.toBeInTheDocument()
  })

  it('consulta de acesso sem resultado (erro): nenhum card de sistema, falha FECHADO', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    comAcessoA()
    render(await DashboardPage())
    expect(screen.queryByText('Gestão de Frotas')).not.toBeInTheDocument()
    expect(screen.queryByText('Conversor OS')).not.toBeInTheDocument()
    expect(screen.queryByText('CRM')).not.toBeInTheDocument()
    expect(screen.queryByText('Gestão de Obras')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows Financeiro to everyone and explains that the rest needs releasing', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    comAcessoA()
    render(await DashboardPage())
    // Qualquer pessoa logada no hub pode pedir um pagamento, então o Financeiro
    // não depende de liberação por sistema — aparece mesmo para quem não tem nada.
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    // Compras segue o mesmo conceito: qualquer pessoa logada pode solicitar uma compra.
    expect(screen.getByText('Compras').closest('a')).toHaveAttribute('href', '/compras')
    expect(screen.queryByText('Gestão de Frotas')).not.toBeInTheDocument()
    expect(screen.getByText(/dependem de liberação/i)).toBeInTheDocument()
  })

  it('keeps the Financeiro card next to the released systems', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    comAcessoA('crm')
    render(await DashboardPage())
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.queryByText(/dependem de liberação/i)).not.toBeInTheDocument()
  })
})
