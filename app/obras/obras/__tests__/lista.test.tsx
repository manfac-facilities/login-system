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

  it('obra com cronograma: cartão com sinal em texto, barras e entrega (base riscada se mudou)', async () => {
    lerObraGrandeMock.mockResolvedValue({
      ok: true,
      dados: {
        calc: { previsto: 0.5, realizado: 0.4, terminoProjetado: '2026-12-10' },
        calcBase: { previsto: 0.55 },
        terminoBase: '2026-12-01',
        sinal: 'amarelo',
      },
    })
    render(await ListaObrasPage())
    expect(screen.getByRole('link', { name: /Macaé/ })).toHaveAttribute('href', '/obras/obras/o1')
    expect(screen.getAllByText('Atenção').length).toBeGreaterThan(0)
    expect(screen.getByText('55%')).toBeInTheDocument()
    expect(screen.getByText('10/12/2026')).toBeInTheDocument()
    expect(screen.getByText('01/12/2026')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '40% concluído' })).toBeInTheDocument()
  })
})
