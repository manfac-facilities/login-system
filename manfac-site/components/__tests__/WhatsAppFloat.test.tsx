import { render, screen } from '@testing-library/react'
import WhatsAppFloat from '../WhatsAppFloat'

describe('WhatsAppFloat', () => {
  it('aponta para o wa.me com o número comercial', () => {
    render(<WhatsAppFloat />)
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link.getAttribute('href')).toContain('wa.me/5521984280058')
  })

  it('abre em nova aba com rel seguro', () => {
    render(<WhatsAppFloat />)
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('está visível desde o carregamento, sem depender de scroll', () => {
    render(<WhatsAppFloat />)
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link.className).not.toContain('opacity-0')
    expect(link.className).not.toContain('pointer-events-none')
  })

  it('fica fixo no canto inferior direito', () => {
    render(<WhatsAppFloat />)
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link.className).toContain('fixed')
    expect(link.className).toContain('bottom-')
    expect(link.className).toContain('right-')
  })

  it('carrega a classe do halo verde', () => {
    render(<WhatsAppFloat />)
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link.className).toContain('wa-float')
  })
})
