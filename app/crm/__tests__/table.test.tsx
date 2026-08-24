import { render, screen } from '@testing-library/react'
import LeadsTable from '../_table'
import type { Lead } from '@/lib/leads/formato'

const base: Lead = {
  id: '1', criado_em: '2026-08-21T17:32:00.000Z', atualizado_em: null,
  path: 'Obra ou reforma', nome: 'Maria Souza', email: 'maria@empresa.com.br',
  telefone: '(21) 99999-0000', consentimento: true, consentido_em: '2026-08-21T17:32:00.000Z',
  consentimento_texto: 'Autorizo a Manfac Engenharia a usar meus dados de contato para responder a esta solicitação.',
  empresa: null, cargo: null, localidade: null, unidades: null, resumo: null, etapa2_em: null,
}

describe('LeadsTable', () => {
  it('mostra estado vazio quando não há lead', () => {
    render(<LeadsTable leads={[]} />)
    expect(screen.getByText(/nenhum lead/i)).toBeTruthy()
  })

  it('distingue lead parcial de completo', () => {
    render(<LeadsTable leads={[base, { ...base, id: '2', etapa2_em: '2026-08-21T17:40:00.000Z', empresa: 'Rede X' }]} />)
    expect(screen.getByText(/parcial/i)).toBeTruthy()
    expect(screen.getByText(/completo/i)).toBeTruthy()
  })

  it('telefone e e-mail são clicáveis — o próximo passo é sempre contatar', () => {
    const { container } = render(<LeadsTable leads={[base]} />)
    expect(container.querySelector('a[href*="wa.me"]')).not.toBeNull()
    expect(container.querySelector('a[href^="mailto:"]')).not.toBeNull()
  })
})
