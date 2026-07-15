import { render, screen } from '@testing-library/react'
import Counter from '../Counter'

// jsdom não tem IntersectionObserver nem matchMedia — exatamente o cenário
// "JS de animação indisponível". O Counter deve mostrar o valor final assim mesmo.

describe('Counter', () => {
  it('renderiza "+R$800 mil" imediatamente, sem animação', () => {
    render(<Counter value="+R$800 mil" />)
    expect(screen.getByText('+R$800 mil')).toBeInTheDocument()
  })

  it('renderiza "400+" imediatamente', () => {
    render(<Counter value="400+" />)
    expect(screen.getByText('400+')).toBeInTheDocument()
  })

  it('renderiza "+1.000" com separador pt-BR imediatamente', () => {
    render(<Counter value="+1.000" />)
    expect(screen.getByText('+1.000')).toBeInTheDocument()
  })

  it('renderiza "100%" imediatamente', () => {
    render(<Counter value="100%" />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
