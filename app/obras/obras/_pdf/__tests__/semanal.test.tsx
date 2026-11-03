/**
 * PDF do semanal (Leva 3 §2.3): dados → árvore do documento (react-pdf trocado
 * por elementos simples). Versão cliente sem R$, sem oculto; recusa o interno.
 */
jest.mock('@react-pdf/renderer', () => {
  const R = jest.requireActual('react')
  const el =
    (tag: string) =>
    ({ children, render }: { children?: unknown; render?: (p: { pageNumber: number; totalPages: number }) => string }) =>
      R.createElement(tag, null, render ? render({ pageNumber: 1, totalPages: 2 }) : children)
  return {
    Document: el('pdf-document'),
    Page: el('pdf-page'),
    View: el('pdf-view'),
    Text: el('pdf-text'),
    Image: () => R.createElement('pdf-image'),
    StyleSheet: { create: <T,>(s: T) => s },
    Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  }
})

import { render } from '@testing-library/react'
import { montarConteudoSemanal } from '../../_lib/email-semanal'
import { DocumentoSemanal, montarDadosPdfSemanal } from '../semanal'
import { obraGrandePdf } from './fixtures/rdo'

const conteudo = (lado: 'cliente' | 'interno') =>
  montarConteudoSemanal({
    lado, obra: obraGrandePdf(), segunda: '2026-10-26', ref: '2026-10-30', hoje: '2026-10-30',
    plano: null, planoProximo: null, restricoes: [], observacoes: 'Recuperar a alvenaria na segunda.',
  })

const dados = (lado: 'cliente' | 'interno' = 'cliente') =>
  montarDadosPdfSemanal({
    conteudo: conteudo(lado), os: 'OS-4321', cliente: 'DPSP', engenheiro: 'eng@manfac.com.br',
    validadoEm: '2026-10-30T20:00:00Z',
    fotos: [{ dados: Buffer.from([0xff, 0xd8, 0xff]), formato: 'jpg', legenda: 'fachada', data: '2026-10-27' }],
    fotosOmitidas: 1, geradoEm: '2026-10-31T12:00:00Z', logo: null,
  })

describe('PDF do semanal', () => {
  it('versão cliente: seções, observações, fotos; sem R$ nem oculto', () => {
    const { container } = render(<DocumentoSemanal d={dados()} />)
    const t = container.textContent ?? ''
    expect(t).toContain('RELATÓRIO SEMANAL DE OBRA')
    expect(t).toContain('Sem plano fechado para esta semana.')
    expect(t).toContain('Recuperar a alvenaria na segunda.')
    expect(t).toContain('27/10 · fachada')
    expect(t).toContain('1 foto omitida')
    expect(t).toContain('página 1 de 2')
    expect(t).not.toMatch(/R\$|98765|123456/)
    expect(t).not.toContain('Pedreiro faltou')
  })

  it('recusa o conteúdo interno', () => {
    expect(() => dados('interno')).toThrow()
  })
})
