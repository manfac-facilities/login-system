import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactForm from '../ContactForm'

describe('ContactForm', () => {
  it('mostra os 3 caminhos e esconde o formulário até escolher', () => {
    render(<ContactForm />)
    expect(screen.getByRole('button', { name: /manutenção recorrente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /obra ou reforma/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /avaliação técnica/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument()
  })

  it('mostra o formulário após escolher caminho; nº de unidades só no recorrente', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await user.click(screen.getByRole('button', { name: /obra ou reforma/i }))
    expect(screen.getByLabelText(/^nome/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/nº de unidades/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /manutenção recorrente/i }))
    expect(screen.getByLabelText(/nº de unidades/i)).toBeInTheDocument()
  })
})
