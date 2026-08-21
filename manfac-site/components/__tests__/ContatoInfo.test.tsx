import { render, screen } from '@testing-library/react'
import ContatoInfo from '../ContatoInfo'
import { WHATSAPP_COMERCIAL_DISPLAY } from '@/lib/whatsapp'

describe('ContatoInfo', () => {
  it('mostra WhatsApp e e-mail como canais diretos', () => {
    const { container } = render(<ContatoInfo />)
    expect(screen.getByText(WHATSAPP_COMERCIAL_DISPLAY)).toBeTruthy()
    expect(container.querySelector('a[href^="mailto:"]')).not.toBeNull()
  })

  it('o link de WhatsApp abre em nova aba com rel seguro', () => {
    const { container } = render(<ContatoInfo />)
    const wa = container.querySelector('a[href*="wa.me"]')
    expect(wa?.getAttribute('target')).toBe('_blank')
    expect(wa?.getAttribute('rel')).toContain('noopener')
  })
})
