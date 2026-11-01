jest.mock('@react-pdf/renderer', () => {
  const R = jest.requireActual('react')
  const el =
    (tag: string) =>
    ({ children, render }: { children?: unknown; render?: (p: { pageNumber: number; totalPages: number }) => string }) =>
      R.createElement(tag, null, render ? render({ pageNumber: 1, totalPages: 1 }) : children)
  const vazio = (tag: string) => () => R.createElement(tag)
  return {
    Document: el('pdf-document'),
    Page: ({ children, size, orientation }: { children?: unknown; size?: unknown; orientation?: string }) =>
      R.createElement('pdf-page', { 'data-size': String(size), 'data-orientation': orientation }, children),
    View: el('pdf-view'),
    Text: el('pdf-text'),
    Svg: el('pdf-svg'),
    G: el('pdf-g'),
    Rect: vazio('pdf-rect'),
    Path: vazio('pdf-path'),
    Polyline: vazio('pdf-polyline'),
    Polygon: vazio('pdf-polygon'),
    Circle: vazio('pdf-circle'),
    Line: vazio('pdf-line'),
    Image: ({ src }: { src: unknown }) => R.createElement('pdf-image', { 'data-src': typeof src === 'string' ? src : 'logo' }),
    StyleSheet: { create: <T,>(s: T) => s },
    Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  }
})

import { render } from '@testing-library/react'
import { PranchaFaseamento, type DadosPrancha } from '../prancha-pdf'
import { CAMADAS_EXEMPLO_FASE1 } from '../camadas'
import { textoDaTrava } from '../trava'

const trava = textoDaTrava(
  { atividade: { numero: 6, nome: 'Escoramento provisório', status: 'em_andamento' }, bloqueadas: [{ numero: 11, nome: 'Demolição' }], liberada: false },
  '2026-10-30',
)

const dados = (over: Partial<DadosPrancha> = {}): DadosPrancha => ({
  obra: { nome: 'Macaé 3', os: '24.0871' },
  fase: { numero: 1, nome: 'Demolição e reforço' },
  revisao: { revisao: 1, emitidaEm: '2026-10-30T15:00:00Z' },
  camadas: CAMADAS_EXEMPLO_FASE1,
  regras: ['Nenhuma demolição antes do escoramento.', 'Clientes usam só a entrada existente.'],
  carimbo: { titulo: 'Fase 1 · Demolição e reforço', cliente: 'DPSP', desenho: 'Planta de faseamento', base: 'Layout aprovado do térreo · sem escala', rt: 'Eng. Fulano CREA 123' },
  travaTexto: trava,
  plantaUrl: 'https://x/planta.png',
  planta: { largura: 2000, altura: 1400 },
  ...over,
})

describe('PranchaFaseamento', () => {
  it('imprime título, regras numeradas, revisão R1, trava, legenda e planta; A3 paisagem', () => {
    const { container } = render(<PranchaFaseamento {...dados()} />)
    const t = container.textContent ?? ''
    expect(t).toContain('Fase 1 · Demolição e reforço')
    expect(t).toContain('Nenhuma demolição antes do escoramento.')
    expect(t).toContain('2. Clientes usam só a entrada existente.')
    expect(t).toContain('R1')
    expect(t).toContain('30/10/2026')
    expect(t).toContain('Status na geração (30/10/2026): atividade nº 6 Escoramento provisório EM ANDAMENTO')
    expect(t).toContain('Zona de obra')
    expect(t).toContain('Eng. Fulano CREA 123')
    expect(t).not.toContain('RASCUNHO')
    expect(t).not.toContain('Sem planta enviada')
    expect(container.querySelector('pdf-image[data-src="https://x/planta.png"]')).not.toBeNull()
    const pg = container.querySelector('pdf-page')
    expect(pg?.getAttribute('data-size')).toBe('A3')
    expect(pg?.getAttribute('data-orientation')).toBe('landscape')
  })

  it('sem planta: quadro branco com aviso e sem imagem', () => {
    const { container } = render(<PranchaFaseamento {...dados({ plantaUrl: null, planta: null })} />)
    expect(container.textContent).toContain('Sem planta enviada: camadas sobre quadro branco')
    expect(container.querySelector('pdf-image[data-src="https://x/planta.png"]')).toBeNull()
    expect(container.querySelectorAll('pdf-rect').length).toBeGreaterThan(0)
  })

  it('rascunho mostra a marca d\'água e não quebra sem trava', () => {
    const { container } = render(<PranchaFaseamento {...dados({ revisao: { revisao: 0, emitidaEm: null }, travaTexto: null })} />)
    const t = container.textContent ?? ''
    expect(t).toContain('RASCUNHO')
    expect(t).toContain('R0')
    expect(t).not.toContain('Status na geração')
  })
})
