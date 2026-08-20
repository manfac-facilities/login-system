import { render, screen } from '@testing-library/react'
import Footer from '../Footer'
import { SERVICOS_DATA } from '@/lib/servicos'
import { WHATSAPP_COMERCIAL_DISPLAY } from '@/lib/whatsapp'

describe('Footer', () => {
  it('linka todas as subpáginas de serviço', () => {
    const { container } = render(<Footer />)
    SERVICOS_DATA.forEach((s) => {
      expect(container.querySelector(`a[href="/servicos/${s.slug}"]`)).not.toBeNull()
    })
  })

  it('linka o hub de serviços e as páginas institucionais', () => {
    const { container } = render(<Footer />)
    ;['/', '/servicos', '/quem-somos', '/resultados', '/contato'].forEach((href) => {
      expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull()
    })
  })

  it('mostra os canais de contato', () => {
    render(<Footer />)
    expect(screen.getByText(/contato@manfac\.com\.br/)).toBeTruthy()
    expect(screen.getByText(WHATSAPP_COMERCIAL_DISPLAY)).toBeTruthy()
  })

  it('tem um caminho direto pro WhatsApp', () => {
    const { container } = render(<Footer />)
    const wa = container.querySelector('a[href*="wa.me"]')
    expect(wa).not.toBeNull()
    expect(wa?.getAttribute('target')).toBe('_blank')
  })

  it('mantém a linha de copyright com o ano corrente', () => {
    render(<Footer />)
    const ano = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(`${ano}.*Manfac`))).toBeTruthy()
  })
})
