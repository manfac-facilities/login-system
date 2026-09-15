import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Historico from '../_historico'

describe('Historico', () => {
  it('sem linhas, mostra o estado vazio e ainda assim a linha de entrada', () => {
    render(<Historico linhas={[]} entrada={{ data: '2026-09-09', fonte: 'field' }} />)
    expect(screen.getByText(/nenhuma alteração/i)).toBeInTheDocument()
    expect(screen.getByText(/09\/09\/2026/)).toBeInTheDocument()
    // Regex mais específica que "/field/i": o texto do estado vazio também contém a
    // palavra "Field" ("...pelo Field."), então "/field/i" batia em dois elementos.
    // "· Field" só aparece na linha de entrada.
    expect(screen.getByText(/· Field/)).toBeInTheDocument()
  })

  it('mostra as linhas e filtra por bloco ao clicar no chip', async () => {
    const user = userEvent.setup()
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Autorização' as const, campo: 'liberado_por' as const,
        de: null, para: 'JUAN', motivo: null, quem: 'amanda@manfac.com.br', created_at: '2026-07-02T14:30:00Z',
      },
      {
        id: '2', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'prioridade' as const,
        de: 'Normal', para: 'Urgente', motivo: null, quem: 'yuri@manfac.com.br', created_at: '2026-08-01T09:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)

    expect(screen.getByText(/Liberado por/)).toBeInTheDocument()
    expect(screen.getByText(/Prioridade/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Autorização' }))

    expect(screen.getByText(/Liberado por/)).toBeInTheDocument()
    expect(screen.queryByText(/^Prioridade/)).not.toBeInTheDocument()
  })

  it('mostra o motivo só quando a linha tem motivo (remarcação)', () => {
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'inicio_plan' as const,
        de: '10/09/2026', para: '16/09/2026', motivo: 'Loja pediu para adiar',
        quem: 'yuri@manfac.com.br', created_at: '2026-09-14T10:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)
    expect(screen.getByText(/Motivo: Loja pediu para adiar/)).toBeInTheDocument()
  })
})
