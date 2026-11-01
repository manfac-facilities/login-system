/**
 * @jest-environment node
 *
 * GET .../faseamento/<revisaoId>/pdf (Leva 6b): guarda falha fechada (401/403/404);
 * na emitida a base é a planta CONGELADA na revisão (não a do mapa atual) e a
 * fase é a congelada; no rascunho, a planta atual do mapa e sem data (RASCUNHO).
 */
import { criarBanco, type Banco } from './fixtures/banco'

let b: Banco
const getUserMock = jest.fn()
const renderMock = jest.fn<Promise<Buffer>, unknown[]>(async () => Buffer.from('%PDF-1.4 prancha'))

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => b.cliente(getUserMock)) }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...a: unknown[]) => renderMock(...a),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image', Svg: 'Svg', G: 'G', Rect: 'Rect', Path: 'Path',
  Polygon: 'Polygon', Polyline: 'Polyline', Circle: 'Circle', Line: 'Line',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { GET } from '../[revisaoId]/pdf/route'
import type { DadosPrancha } from '../_lib/prancha-pdf'

const OBRA = '11111111-2222-4333-8444-555555555555'
const OUTRA = '99999999-2222-4333-8444-555555555555'
const FASE = '22222222-2222-4222-8222-222222222222'
const R0 = '33333333-3333-4333-8333-333333333333'
const R1 = '44444444-3333-4333-8333-333333333333'

const pedir = (revisaoId = R0, id = OBRA) =>
  GET(new Request(`http://x/obras/obras/${id}/faseamento/${revisaoId}/pdf`), { params: Promise.resolve({ id, revisaoId }) })
/** Props que a rota passou para a prancha (createElement(PranchaFaseamento, dados)). */
const dadosRenderizados = () => (renderMock.mock.calls[0][0] as { props: DadosPrancha }).props

beforeEach(() => {
  jest.clearAllMocks()
  b = criarBanco()
  b.db = {
    obras_obra: [{ id: OBRA, os: '24.0871', loja: 'Macaé 3', cliente: 'DPSP', modalidade: 'obra' }],
    obras_fase: [{ id: FASE, obra_id: OBRA, numero: 1, nome: 'Nome atual da fase', ordem: 1 }],
    obras_mapa: [{ obra_id: OBRA, planta_path: `${OBRA}/mapa/NOVA.png`, planta_largura: 2000, planta_altura: 1000 }],
    obras_fase_revisao: [
      {
        id: R0, fase_id: FASE, obra_id: OBRA, revisao: 0, status: 'emitida', emitida_em: '2026-10-30T15:00:00Z', usa_trava: true,
        camadas: [{ id: 'c1', t: 'extintor', at: [0.5, 0.5] }], regras: ['Regra congelada'], carimbo: { titulo: 'T', cliente: 'C', desenho: 'D', base: 'B', rt: 'R' },
        trava_snapshot: { data: '2026-10-30', atividade: { numero: 6, descricao: 'Escoramento provisório', status: 'em_andamento' }, bloqueadas: [] },
        planta_path: `${OBRA}/mapa/ANTIGA.png`, planta_largura: 1200, planta_altura: 840, fase_nome: 'Nome da emissão', fase_numero: 1,
      },
      { id: R1, fase_id: FASE, obra_id: OBRA, revisao: 1, status: 'rascunho', usa_trava: false, camadas: [], regras: [], carimbo: {} },
    ],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: 'eng@manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
})

describe('guarda', () => {
  it('sem sessão 401; sem acesso obras 403; nada renderizado', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect((await pedir()).status).toBe(401)
    getUserMock.mockResolvedValue({ data: { user: { email: 'x@y.com' } } })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await pedir()).status).toBe(403)
    expect(renderMock).not.toHaveBeenCalled()
    expect(b.assinadas).toEqual([])
  })
  it('id fora do formato, revisão de outra obra ou obra SPOT: 404', async () => {
    expect((await pedir('abc')).status).toBe(404)
    b.db.obras_obra.push({ id: OUTRA, modalidade: 'obra' })
    expect((await pedir(R0, OUTRA)).status).toBe(404)
    b.db.obras_obra[0].modalidade = 'spot'
    expect((await pedir()).status).toBe(404)
    expect(renderMock).not.toHaveBeenCalled()
  })
})

describe('conteúdo', () => {
  it('emitida: planta e fase congeladas na revisão, não as do mapa/fase atuais; trava do retrato', async () => {
    const res = await pedir(R0)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(b.assinadas).toEqual([`${OBRA}/mapa/ANTIGA.png`])
    const d = dadosRenderizados()
    expect(d.plantaUrl).toBe(`https://assinada/${OBRA}/mapa/ANTIGA.png`)
    expect(d.planta).toEqual({ largura: 1200, altura: 840 })
    expect(d.fase).toEqual({ numero: 1, nome: 'Nome da emissão' })
    expect(d.revisao).toEqual({ revisao: 0, emitidaEm: '2026-10-30T15:00:00Z' })
    expect(d.travaTexto).toContain('Status na geração (30/10/2026): atividade nº 6 Escoramento provisório EM ANDAMENTO')
    expect(d.regras).toEqual(['Regra congelada'])
  })
  it('emitida sem planta congelada: quadro branco, mesmo com planta no mapa hoje', async () => {
    Object.assign(b.db.obras_fase_revisao[0], { planta_path: null, planta_largura: null, planta_altura: null })
    expect((await pedir(R0)).status).toBe(200)
    expect(b.assinadas).toEqual([])
    expect(dadosRenderizados()).toMatchObject({ plantaUrl: null, planta: null })
  })
  it('rascunho: planta atual do mapa, nome atual da fase, sem data (marca RASCUNHO) e carimbo padrão', async () => {
    const res = await pedir(R1)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('-R1-rascunho.pdf')
    const d = dadosRenderizados()
    expect(b.assinadas).toEqual([`${OBRA}/mapa/NOVA.png`])
    expect(d.fase.nome).toBe('Nome atual da fase')
    expect(d.revisao.emitidaEm).toBeNull()
    expect(d.carimbo.desenho).toBe('FAS-01')
  })
  it('obra sem mapa: rascunho em quadro branco', async () => {
    b.db.obras_mapa = []
    expect((await pedir(R1)).status).toBe(200)
    expect(dadosRenderizados()).toMatchObject({ plantaUrl: null, planta: null })
  })
})
