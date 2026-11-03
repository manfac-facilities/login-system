/**
 * PDF da ata (Leva 2 §3.1): dados → árvore do documento. react-pdf trocado por
 * elementos simples (como em rdo.test.tsx) para ler o texto no jsdom.
 */
jest.mock('@react-pdf/renderer', () => {
  const R = jest.requireActual('react')
  const el =
    (tag: string) =>
    ({ children, render }: { children?: unknown; render?: (p: { pageNumber: number; totalPages: number }) => string }) =>
      R.createElement(tag, null, render ? render({ pageNumber: 1, totalPages: 1 }) : children)
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
import { DocumentoAta, montarDadosPdfAta } from '../ata'

const obra = { os: 'OS-4321', loja: 'DP Macaé 3', cliente: 'DPSP', engenheiro_email: 'eng@manfac.com.br' }
const registro: Parameters<typeof montarDadosPdfAta>[0]['registro'] = {
  data: '2026-10-29',
  participantes: 'Ana (cliente)\n\nBeto (Manfac)',
  texto: 'Cliente pediu prioridade no forro.',
  ata: {
    pauta: 'Andamento da obra',
    decisoes: ['Liberar a área do estoque na segunda', ' '],
    pendencias: [
      { oque: 'Enviar projeto elétrico', responsavel: 'Ana', prazo: '2026-11-05' },
      { oque: 'Confirmar data do forro', responsavel: '', prazo: null },
    ],
  },
  criadoPor: 'beto@manfac.com.br',
  criadoEm: '2026-10-29T18:00:00Z',
  editadoEm: null,
}
const montar = (over: Partial<typeof registro> = {}) =>
  montarDadosPdfAta({ obra, registro: { ...registro, ...over }, geradoEm: '2026-10-30T12:05:00Z', logo: null })
const texto = (d: ReturnType<typeof montar>) => render(<DocumentoAta d={d} />).container.textContent ?? ''

describe('PDF da ata', () => {
  it('dados: participantes por linha, decisões limpas, pendências numeradas com prazo', () => {
    const d = montar()
    expect(d.participantes).toEqual(['Ana (cliente)', 'Beto (Manfac)'])
    expect(d.decisoes).toEqual(['Liberar a área do estoque na segunda'])
    expect(d.pendencias).toEqual([
      ['1', 'Enviar projeto elétrico', 'Ana', '05/11/2026'],
      ['2', 'Confirmar data do forro', '—', '—'],
    ])
    expect(d.rodape).toBe('Manfac Facilities · ata registrada em 29/10/2026 às 15:00 · gerada em 30/10/2026 às 09:05')
  })

  it('documento: cabeçalho, seções do modelo e rodapé', () => {
    const t = texto(montar())
    for (const s of [
      'ATA DE REUNIÃO', 'Ata de reunião · DP Macaé 3 · 29/10/2026', 'OS-4321', 'DPSP', 'eng@manfac.com.br', 'beto@manfac.com.br',
      'Participantes', 'Pauta', 'Andamento da obra', 'Registro', 'Cliente pediu prioridade', 'Decisões',
      'Liberar a área do estoque', 'Pendências', 'Enviar projeto elétrico', '05/11/2026', 'página 1 de 1',
    ]) {
      expect(t).toContain(s)
    }
    expect(t).not.toContain('R$')
  })

  it('vazios têm texto explícito; edição aparece no rodapé', () => {
    const d = montar({ participantes: null, texto: null, ata: { pauta: 'p', decisoes: [], pendencias: [] }, editadoEm: '2026-10-29T19:00:00Z' })
    const t = texto(d)
    expect(t).toContain('Não informados.')
    expect(t).toContain('Nenhuma decisão registrada.')
    expect(t).toContain('Nenhuma pendência.')
    expect(t).not.toContain('Registro')
    expect(d.rodape).toContain('(editada em 29/10/2026 às 16:00)')
  })
})
