import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConvidarDialog, RemoverDialog } from '../_dialogs'

const convidarMock = jest.fn()
const removerMock = jest.fn()

jest.mock('../_actions', () => ({
  convidarUsuarioAction: (...args: unknown[]) => convidarMock(...args),
  removerUsuarioAction: (...args: unknown[]) => removerMock(...args),
}))

const sistemas = [
  { slug: 'sofia', label: 'Gestão de Frotas' },
  { slug: 'conversor-os', label: 'Conversor OS' },
]

describe('RemoverDialog', () => {
  beforeEach(() => jest.clearAllMocks())

  it('keeps the remove button disabled until "deletar" is typed', () => {
    render(
      <RemoverDialog
        aberto
        usuario={{ email: 'ana@manfac.com.br', nome: 'Ana' }}
        onFechar={jest.fn()}
      />
    )
    const botao = screen.getByRole('button', { name: /remover do hub/i })
    expect(botao).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/digite/i), { target: { value: 'deletar' } })
    expect(botao).toBeEnabled()
  })

  it('does not enable the button for a different word', () => {
    render(
      <RemoverDialog
        aberto
        usuario={{ email: 'ana@manfac.com.br', nome: 'Ana' }}
        onFechar={jest.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/digite/i), { target: { value: 'apagar' } })
    expect(screen.getByRole('button', { name: /remover do hub/i })).toBeDisabled()
  })

  it('renders nothing when closed', () => {
    const { container } = render(
      <RemoverDialog
        aberto={false}
        usuario={{ email: 'ana@manfac.com.br', nome: 'Ana' }}
        onFechar={jest.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ConvidarDialog', () => {
  beforeEach(() => jest.clearAllMocks())

  it('offers both levels in the invite dialog', () => {
    render(<ConvidarDialog aberto sistemas={sistemas} onFechar={jest.fn()} />)
    expect(screen.getByRole('option', { name: 'Analista' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
  })

  it('lists a toggle for every system', () => {
    render(<ConvidarDialog aberto sistemas={sistemas} onFechar={jest.fn()} />)
    expect(screen.getByLabelText('Gestão de Frotas')).toBeInTheDocument()
    expect(screen.getByLabelText('Conversor OS')).toBeInTheDocument()
  })

  it('sends the chosen level and systems', async () => {
    convidarMock.mockResolvedValue({ success: true })
    const onFechar = jest.fn()
    render(<ConvidarDialog aberto sistemas={sistemas} onFechar={onFechar} />)

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'nova@manfac.com.br' },
    })
    fireEvent.change(screen.getByLabelText(/nível/i), { target: { value: 'administrador' } })
    fireEvent.click(screen.getByLabelText('Conversor OS'))
    fireEvent.click(screen.getByRole('button', { name: /enviar convite/i }))

    expect(convidarMock).toHaveBeenCalledWith('nova@manfac.com.br', 'administrador', [
      'conversor-os',
    ])
    await waitFor(() => expect(onFechar).toHaveBeenCalled())
  })
})
