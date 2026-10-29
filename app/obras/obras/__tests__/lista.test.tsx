import { render, screen } from '@testing-library/react'

const lerObraGrandeMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { email: 'a@manfac.com.br' } } }) },
    from: () => {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = () => q
      q.order = async () => ({ data: [{ id: 'o1', os: '1', loja: 'Macaé', cliente: 'DPSP' }], error: null })
      return q
    },
  })),
}))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async () => true) }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async () => true) }))
jest.mock('../_lib/leitura', () => ({ lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a) }))
jest.mock('../_lib/ultimo-diario', () => ({
  ultimosDiariosEnviados: jest.fn(async () => ({ ultimo: new Map(), error: null })),
}))

import ListaObrasPage from '../page'

describe('lista de obras', () => {
  it('lerObraGrande falha: mostra erro, não "sem cronograma"', async () => {
    lerObraGrandeMock.mockResolvedValue({ ok: false, erro: 'boom' })
    render(await ListaObrasPage())
    expect(screen.getByText('erro ao ler o cronograma')).toBeInTheDocument()
    expect(screen.queryByText('sem cronograma')).toBeNull()
  })

  it('obra sem versão: continua "sem cronograma"', async () => {
    lerObraGrandeMock.mockResolvedValue({ ok: true, dados: { calc: null } })
    render(await ListaObrasPage())
    expect(screen.getByText('sem cronograma')).toBeInTheDocument()
  })
})
