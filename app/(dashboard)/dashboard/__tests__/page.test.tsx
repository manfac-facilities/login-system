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
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('explains itself when the user has no system at all', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    render(await DashboardPage())
    expect(screen.getByText(/nenhum sistema liberado/i)).toBeInTheDocument()
  })
})
