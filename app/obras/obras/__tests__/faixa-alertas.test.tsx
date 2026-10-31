/** Faixa de alertas do painel (Leva 3 §2.4): some sem alertas; cada um com atalho. */
import { render, screen } from '@testing-library/react'
import FaixaAlertas from '../_ui/faixa-alertas'

describe('FaixaAlertas', () => {
  it('sem alertas não renderiza nada', () => {
    const { container } = render(<FaixaAlertas alertas={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o texto e o atalho de cada alerta', () => {
    render(
      <FaixaAlertas
        alertas={[
          { id: 'atrasadas', tom: 'negativo', texto: '2 atividades atrasadas — comunicar o cliente hoje', acao: { rotulo: 'Comunicação imediata', href: '/obras/obras/o1/comunicacao' } },
          { id: 'semanal', tom: 'atencao', texto: 'Semanal de 30/10 não enviado', acao: { rotulo: 'Abrir semanal', href: '/obras/obras/o1/comunicacao/semanal?semana=2026-10-26' } },
        ]}
      />,
    )
    expect(screen.getByRole('region', { name: 'Alertas da obra' })).toBeInTheDocument()
    expect(screen.getByText('2 atividades atrasadas — comunicar o cliente hoje')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Comunicação imediata' })).toHaveAttribute('href', '/obras/obras/o1/comunicacao')
    expect(screen.getByRole('link', { name: 'Abrir semanal' })).toHaveAttribute('href', '/obras/obras/o1/comunicacao/semanal?semana=2026-10-26')
  })
})
