/**
 * @jest-environment node
 *
 * GET /portal-obra/obras/<obraId>/faseamento/<revisaoId>/pdf (Leva 6b, Review Focus 3): sem sessão
 * recusa; só a última emitida da fase desta obra vira PDF; rascunho, revisão antiga, de outra obra,
 * id inválido e obra SPOT dão 404 igual, sem renderizar nem assinar nada.
 */
import { criarBanco, type Banco } from '@/app/obras/obras/[id]/faseamento/__tests__/fixtures/banco'

let b: Banco
let mockAdmin: unknown
const mockSessao = jest.fn()
const renderMock = jest.fn<Promise<Buffer>, unknown[]>(async () => Buffer.from('%PDF-1.4 prancha'))

jest.mock('@/lib/portal-obra/sessao', () => ({ lerSessao: (...a: unknown[]) => mockSessao(...a) }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdmin }))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...a: unknown[]) => renderMock(...a),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image', Svg: 'Svg', G: 'G', Rect: 'Rect', Path: 'Path',
  Polygon: 'Polygon', Polyline: 'Polyline', Circle: 'Circle', Line: 'Line',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { GET } from '../(obra)/obras/[obraId]/faseamento/[revisaoId]/pdf/route'
import type { DadosPrancha } from '@/app/obras/obras/[id]/faseamento/_lib/prancha-pdf'

const O = '11111111-1111-4111-8111-111111111111'
const OUTRA = '22222222-2222-4222-8222-222222222222'
const FASE = '33333333-3333-4333-8333-333333333333'
const R0 = '44444444-4444-4444-8444-444444444444'
const R1 = '55555555-5555-4555-8555-555555555555'
const R2 = '66666666-6666-4666-8666-666666666666'
const RALHEIA = '77777777-7777-4777-8777-777777777777'

const pedir = (revisaoId: string, obraId = O) =>
  GET(new NextRequest(`http://x/portal-obra/obras/${obraId}/faseamento/${revisaoId}/pdf`), { params: Promise.resolve({ obraId, revisaoId }) })
const dadosRenderizados = () => (renderMock.mock.calls[0][0] as { props: DadosPrancha }).props

beforeEach(() => {
  jest.clearAllMocks()
  b = criarBanco()
  b.db = {
    obras_obra: [
      { id: O, os: '24.0871', loja: 'Macaé 3', cliente: 'DPSP', modalidade: 'obra' },
      { id: OUTRA, os: '1', loja: 'Outra', cliente: 'X', modalidade: 'obra' },
    ],
    obras_fase: [{ id: FASE, obra_id: O, numero: 1, nome: 'Nome vivo', ordem: 1 }],
    obras_mapa: [{ obra_id: O, planta_path: `${O}/mapa/ATUAL.png`, planta_largura: 2000, planta_altura: 1000 }],
    obras_fase_revisao: [
      {
        id: R0, fase_id: FASE, obra_id: O, revisao: 0, status: 'emitida', emitida_em: '2026-10-30T15:00:00Z', usa_trava: false,
        camadas: [], regras: [], carimbo: {}, planta_path: `${O}/mapa/R0.png`, planta_largura: 1200, planta_altura: 840, fase_nome: 'Congelada R0', fase_numero: 1,
      },
      {
        id: R1, fase_id: FASE, obra_id: O, revisao: 1, status: 'emitida', emitida_em: '2026-10-31T15:00:00Z', usa_trava: false,
        camadas: [], regras: [], carimbo: {}, planta_path: `${O}/mapa/R1.png`, planta_largura: 1200, planta_altura: 840, fase_nome: 'Congelada R1', fase_numero: 1,
      },
      { id: R2, fase_id: FASE, obra_id: O, revisao: 2, status: 'rascunho', usa_trava: false, camadas: [], regras: [], carimbo: {} },
      {
        id: RALHEIA, fase_id: '88888888-8888-4888-8888-888888888888', obra_id: OUTRA, revisao: 0, status: 'emitida', emitida_em: '2026-10-31T15:00:00Z',
        usa_trava: false, camadas: [], regras: [], carimbo: {}, planta_path: null, planta_largura: null, planta_altura: null, fase_nome: 'Alheia', fase_numero: 1,
      },
    ],
  }
  mockAdmin = b.cliente(async () => null)
  mockSessao.mockResolvedValue({ email: 'cliente@loja.com.br', obras: [O] })
})

const semRender = () => {
  expect(renderMock).not.toHaveBeenCalled()
  expect(b.assinadas).toEqual([])
}

describe('guarda', () => {
  it('sem sessão do portal: recusa (303 para a entrada), sem ler nada', async () => {
    mockSessao.mockResolvedValue(null)
    const res = await pedir(R1)
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/portal-obra')
    semRender()
  })

  it('obra fora da sessão: 404, sem ler a revisão', async () => {
    const res = await pedir(RALHEIA, OUTRA)
    expect(res.status).toBe(404)
    semRender()
  })
})

describe('o que vira PDF', () => {
  it('a última emitida da fase: 200, com planta e nome congelados (não os vivos)', async () => {
    const res = await pedir(R1)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(b.assinadas).toEqual([`${O}/mapa/R1.png`])
    expect(dadosRenderizados()).toMatchObject({ fase: { numero: 1, nome: 'Congelada R1' }, revisao: { revisao: 1, emitidaEm: '2026-10-31T15:00:00Z' } })
  })

  it('rascunho nunca, nem pelo id direto: 404 igual ao de id inexistente', async () => {
    const rascunho = await pedir(R2)
    const inexistente = await pedir('99999999-9999-4999-8999-999999999999')
    expect(rascunho.status).toBe(404)
    expect(inexistente.status).toBe(404)
    expect(await rascunho.text()).toBe(await inexistente.text())
    semRender()
  })

  it('revisão emitida de outra obra (id adivinhado): 404', async () => {
    expect((await pedir(RALHEIA)).status).toBe(404)
    semRender()
  })

  it('revisão antiga já substituída: 404 (só a última emitida abre)', async () => {
    expect((await pedir(R0)).status).toBe(404)
    semRender()
  })

  it('id fora do formato: 404', async () => {
    expect((await pedir('abc')).status).toBe(404)
    semRender()
  })

  it('obra que não é modalidade obra (SPOT): 404', async () => {
    b.db.obras_obra[0].modalidade = 'spot'
    expect((await pedir(R1)).status).toBe(404)
    semRender()
  })

  it('falha de leitura: 500 sem vazar detalhe', async () => {
    b.erro['obras_fase_revisao.select'] = { message: 'segredo do banco' }
    const res = await pedir(R1)
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('segredo')
    semRender()
  })
})
