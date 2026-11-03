/**
 * PDF da apresentação ao cliente (Leva 4 §2.4): uma página por bloco com dado,
 * paisagem, sem R$/oculto/NaN; período sem dados só tem a capa.
 */
jest.mock('@react-pdf/renderer', () => {
  const R = jest.requireActual('react')
  const el =
    (tag: string) =>
    ({ children, render, orientation }: { children?: unknown; orientation?: string; render?: (p: { pageNumber: number; totalPages: number }) => string }) =>
      R.createElement(tag, orientation ? { 'data-orientation': orientation } : null, render ? render({ pageNumber: 1, totalPages: 1 }) : children)
  return {
    Document: el('pdf-document'),
    Page: el('pdf-page'),
    View: el('pdf-view'),
    Text: el('pdf-text'),
    Svg: el('pdf-svg'),
    Rect: () => R.createElement('pdf-rect'),
    Polyline: ({ points }: { points: string }) => R.createElement('pdf-polyline', { 'data-points': points }),
    Line: () => R.createElement('pdf-line'),
    Image: () => R.createElement('pdf-image'),
    StyleSheet: { create: <T,>(s: T) => s },
    Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  }
})
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { render } from '@testing-library/react'
import { BLOCOS, montarApresentacao } from '../../_lib/apresentacao'
import { DocumentoApresentacao, montarDadosPdfApresentacao } from '../apresentacao'
import { obraPeriodo } from './fixtures/periodo'

const hoje = '2026-11-10'
const pdf = (over: Parameters<typeof montarApresentacao>[0] extends infer P ? Partial<P> : never = {}, fotos = 0) =>
  montarDadosPdfApresentacao({
    conteudo: montarApresentacao({
      obra: obraPeriodo(), inicio: '2026-10-26', fim: hoje, ref: hoje, hoje, planos: [], restricoes: [],
      destaques: ['Etapa 1 concluída antes do previsto'], blocos: [...BLOCOS], ...over,
    }),
    fotos: Array.from({ length: fotos }, () => ({ dados: Buffer.from([0xff, 0xd8, 0xff]), formato: 'jpg' as const, legenda: 'fachada', data: '2026-11-04' })),
    fotosOmitidas: 0, geradoEm: '2026-11-11T12:00:00Z', logo: null,
  })

describe('DocumentoApresentacao', () => {
  it('paisagem, um bloco por página, sem R$ nem oculto nem NaN', () => {
    const { container } = render(<DocumentoApresentacao d={pdf({}, 1)} />)
    const t = container.textContent ?? ''
    for (const x of ['Apresentação de andamento da obra', 'Resumo e sinal', 'Avanço e curva S', 'Cronograma por etapa', 'Marcos e destaques', 'Fotos', 'Etapa 1 concluída antes do previsto', '04/11 · fachada']) {
      expect(t).toContain(x)
    }
    expect(t).not.toMatch(/R\$|98765|123456|Pedreiro faltou|NaN|Infinity|undefined/)
    expect([...container.querySelectorAll('pdf-page')].every((p) => p.getAttribute('data-orientation') === 'landscape')).toBe(true)
    const pontos = [...container.querySelectorAll('pdf-polyline')].map((p) => p.getAttribute('data-points') ?? '')
    expect(pontos.length).toBeGreaterThan(0)
    expect(pontos.join(' ')).not.toMatch(/NaN|Infinity/)
  })

  it('sem dados no período: só a capa', () => {
    const og = obraPeriodo()
    og.calc = null
    og.calcBase = null
    og.etapas = []
    og.impedimentos = []
    const { container } = render(<DocumentoApresentacao d={pdf({ obra: og, destaques: [] })} />)
    expect(container.querySelectorAll('pdf-page')).toHaveLength(1)
    expect(container.textContent).not.toMatch(/NaN|undefined/)
  })

  it('bloco desmarcado não vira página', () => {
    const { container } = render(<DocumentoApresentacao d={pdf({ blocos: ['capa', 'ppc'] })} />)
    expect(container.textContent).not.toContain('Cronograma por etapa')
  })
})
