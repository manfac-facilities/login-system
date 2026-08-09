import { render, screen } from '@testing-library/react'
import AcessosTable from '../_table'

jest.mock('../../_actions', () => ({
  alternarAcessoAction: jest.fn(),
}))

const sistemas = [{ slug: 'sofia', label: 'Gestão de Frotas' }]

describe('AcessosTable', () => {
  it('shows the full-access label instead of toggles for administrators', () => {
    render(
      <AcessosTable
        usuarios={[
          {
            id: '1',
            email: 'chefe@manfac.com.br',
            nome: null,
            nivel: 'administrador',
            ultimoAcesso: null,
            convitePendente: false,
          },
        ]}
        sistemas={sistemas}
        acessos={[]}
      />
    )
    expect(screen.getByText(/administrador acessa todos os sistemas/i)).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Gestão de Frotas/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Gestão de Frotas/ })).not.toBeInTheDocument()
  })

  it('shows one toggle per system for an analyst', () => {
    render(
      <AcessosTable
        usuarios={[
          {
            id: '2',
            email: 'ana@manfac.com.br',
            nome: 'Ana Souza',
            nivel: 'analista',
            ultimoAcesso: null,
            convitePendente: false,
          },
        ]}
        sistemas={sistemas}
        acessos={[{ user_email: 'ana@manfac.com.br', system_slug: 'sofia', has_access: true }]}
      />
    )
    const toggle = screen.getByRole('switch', { name: /Gestão de Frotas/ })
    expect(toggle).toBeInTheDocument()
    expect(toggle).toBeChecked()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('ana@manfac.com.br')).toBeInTheDocument()
  })
})
