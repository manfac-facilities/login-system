import { render, screen } from '@testing-library/react'

jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
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
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import DashboardPage from '../page'

describe('DashboardPage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('shows all three cards for an administrator', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    render(await DashboardPage())
    expect(screen.getByText('Gestão de Frotas')).toBeInTheDocument()
    expect(screen.getByText('Conversor OS')).toBeInTheDocument()
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('hides systems the analyst cannot open', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    ;(hasSystemAccess as jest.Mock).mockImplementation(
      async (_c: unknown, _e: unknown, slug: string) => slug === 'conversor-os'
    )
    render(await DashboardPage())
    expect(screen.queryByText('Gestão de Frotas')).not.toBeInTheDocument()
    expect(screen.getByText('Conversor OS')).toBeInTheDocument()
    expect(screen.queryByText('CRM')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('shows the CRM card for an analyst with access to it', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    ;(hasSystemAccess as jest.Mock).mockImplementation(
      async (_c: unknown, _e: unknown, slug: string) => slug === 'crm'
    )
    render(await DashboardPage())
    expect(screen.getByText('CRM')).toBeInTheDocument()
  })

  it('shows Financeiro to everyone and explains that the rest needs releasing', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    render(await DashboardPage())
    // Qualquer pessoa logada no hub pode pedir um pagamento, então o Financeiro
    // não depende de liberação por sistema — aparece mesmo para quem não tem nada.
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    expect(screen.queryByText('Gestão de Frotas')).not.toBeInTheDocument()
    expect(screen.getByText(/dependem de liberação/i)).toBeInTheDocument()
  })

  it('keeps the Financeiro card next to the released systems', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    ;(hasSystemAccess as jest.Mock).mockImplementation(
      async (_c: unknown, _e: unknown, slug: string) => slug === 'crm'
    )
    render(await DashboardPage())
    expect(screen.getByText('Financeiro')).toBeInTheDocument()
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.queryByText(/dependem de liberação/i)).not.toBeInTheDocument()
  })
})
