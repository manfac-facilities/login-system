import { fireEvent, render, screen } from '@testing-library/react'
import ContasCard from '../_contas'

jest.mock('../../_actions', () => ({
  alterarNivelAction: jest.fn(),
  removerUsuarioAction: jest.fn(),
  reenviarConviteAction: jest.fn(),
  cancelarConviteAction: jest.fn(),
  enviarResetSenhaAction: jest.fn(),
  convidarUsuarioAction: jest.fn(),
}))

const usuarios = [
  {
    id: '1',
    email: 'ana@manfac.com.br',
    nome: 'Ana Souza',
    nivel: 'analista' as const,
    ultimoAcesso: '2026-07-03T13:52:00Z',
    convitePendente: false,
  },
  {
    id: '2',
    email: 'suporte@manfac.com.br',
    nome: null,
    nivel: 'analista' as const,
    ultimoAcesso: null,
    convitePendente: true,
  },
]

describe('ContasCard', () => {
  it('shows the name above the email', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('ana@manfac.com.br')).toBeInTheDocument()
  })

  it('shows the pending invite chip instead of a date', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)
    expect(screen.getByText('Convite pendente')).toBeInTheDocument()
  })

  it('formats the last access in pt-BR', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)
    expect(screen.getByText(/3 de julho de 2026/)).toBeInTheDocument()
  })

  it('marks your own row and disables its actions', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="ana@manfac.com.br" />)
    expect(screen.getByText('você')).toBeInTheDocument()
  })

  it('filters by name or email', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)
    fireEvent.change(screen.getByPlaceholderText('Pesquisar usuários...'), {
      target: { value: 'suporte' },
    })
    expect(screen.queryByText('ana@manfac.com.br')).not.toBeInTheDocument()
    expect(screen.getByText('suporte@manfac.com.br')).toBeInTheDocument()
  })

  it('finds an address stored with uppercase letters', () => {
    render(
      <ContasCard
        usuarios={[{ ...usuarios[0], email: 'Ana@Manfac.com.br' }]}
        emailAtual="chefe@manfac.com.br"
      />
    )
    fireEvent.change(screen.getByPlaceholderText('Pesquisar usuários...'), {
      target: { value: 'ana@manfac' },
    })
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
  })

  it('reopens the invite dialog empty', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar novo usuário' }))
    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'digitado@manfac.com.br' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar novo usuário' }))
    expect(screen.getByLabelText(/e-mail/i)).toHaveValue('')
  })

  it('filters by level', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)
    fireEvent.change(screen.getByLabelText('Filtrar por nível'), {
      target: { value: 'administrador' },
    })
    expect(screen.getByText('Nenhum usuário encontrado.')).toBeInTheDocument()
  })
})
