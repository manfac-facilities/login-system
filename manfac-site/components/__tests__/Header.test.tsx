import { fireEvent, render, screen } from '@testing-library/react'
import Header from '../Header'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('Header', () => {
  it('renderiza os 5 itens de navegação', () => {
    render(<Header />)
    ;['Início', 'Quem somos', 'Serviços', 'Resultados', 'Contato'].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })
  })

  it('o CTA aponta para o WhatsApp e abre em nova aba', () => {
    render(<Header />)
    const cta = screen.getByText('Solicitar atendimento').closest('a')
    expect(cta?.getAttribute('href')).toContain('wa.me/5521984280058')
    expect(cta?.getAttribute('target')).toBe('_blank')
    expect(cta?.getAttribute('rel')).toContain('noopener')
  })

  it('o header é fixo, não sticky', () => {
    const { container } = render(<Header />)
    const header = container.querySelector('header')
    expect(header?.className).toContain('fixed')
  })

  it('a barra é uma pílula com vidro em 70% de opacidade', () => {
    const { container } = render(<Header />)
    const barra = container.querySelector('header > div')
    expect(barra?.className).toContain('rounded-full')
    expect(barra?.className).toContain('bg-white/70')
    expect(barra?.className).toContain('backdrop-blur')
  })

  it('cada item de navegação tem o traço do sublinhado, animável por hover', () => {
    const { container } = render(<Header />)
    const tracos = container.querySelectorAll('nav span.origin-left')
    expect(tracos.length).toBeGreaterThanOrEqual(5)
  })

  it('o item da rota ativa já vem com o traço estendido', () => {
    const { container } = render(<Header />)
    const ativo = container.querySelector('nav span.origin-left.scale-x-100')
    expect(ativo).not.toBeNull()
  })

  // Regressão: com o header virando wrapper transparente em volta da pílula, o
  // menu mobile deixou de herdar fundo e abria por cima do conteúdo da página.
  it('o menu mobile abre como cartão com fundo próprio', () => {
    const { container } = render(<Header />)
    expect(container.querySelector('nav.md\\:hidden')).toBeNull()

    fireEvent.click(screen.getByLabelText('Abrir menu'))

    const menu = container.querySelector('nav.md\\:hidden')
    expect(menu).not.toBeNull()
    expect(menu?.className).toMatch(/bg-white/)
    expect(menu?.className).toContain('rounded-2xl')
  })
})
