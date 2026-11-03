/**
 * @jest-environment node
 *
 * GET .../apresentacao/pdf (Leva 4 §2.4): guarda falha fechada (401/403),
 * 400 para período inválido, 404 para obra de outra modalidade; PDF da versão
 * cliente; fotos só pelos ids pedidos, re-resolvidas contra os diários
 * validados DESTA obra no período; blocos desmarcados fora.
 */
import { obraPeriodo } from '../../../_pdf/__tests__/fixtures/periodo'

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
const getUserMock = jest.fn()
const lerObraGrandeMock = jest.fn()
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 apresentacao'))
const downloadMock = jest.fn()

function consulta(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  const linhas = () => (db[tabela] ?? []).filter((l) => filtros.every((f) => f(l)))
  const q = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    gte: (c: string, v: string) => (filtros.push((l) => String(l[c]) >= v), q),
    lte: (c: string, v: string) => (filtros.push((l) => String(l[c]) <= v), q),
    in: (c: string, v: unknown[]) => (filtros.push((l) => v.includes(l[c])), q),
    order: () => q,
    maybeSingle: async () => ({ data: linhas()[0] ?? null, error: null }),
    then: (ok: (r: { data: Linha[]; error: null }) => unknown) => Promise.resolve({ data: linhas(), error: null }).then(ok),
  }
  return q
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => consulta(t) })),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ storage: { from: () => ({ download: downloadMock }) } }),
}))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../../../_lib/tipos', () => ({
  ...jest.requireActual('../../../../_lib/tipos'),
  hojeISO: () => '2026-11-10',
}))
jest.mock('../../../_lib/leitura', () => ({
  ...jest.requireActual('../../../_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a),
}))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...a: unknown[]) => renderMock(...(a as [])),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image', Svg: 'Svg', Polyline: 'Polyline', Line: 'Line', Rect: 'Rect',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { GET } from '../pdf/route'

const pedir = (qs = 'periodo=mes&f=1&blocos=capa,resumo,fotos&fotos=f1', id = 'o1') =>
  GET(new Request(`http://x/obras/obras/${id}/apresentacao/pdf?${qs}`), { params: Promise.resolve({ id }) })
const pdfRenderizado = () =>
  ((renderMock.mock.calls[0] as unknown[])[0] as {
    props: { d: { conteudo: Record<string, unknown> & { blocos: string[] }; fotos: { legenda: string }[]; fotosOmitidas: number } }
  }).props.d

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { email: 'Fulano@Manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  lerObraGrandeMock.mockImplementation(async () => ({ ok: true, dados: obraPeriodo() }))
  db = {
    obras_plano_semana: [],
    obras_restricao: [],
    obras_rdo: [
      { id: 'd1', obra_id: 'o1', data: '2026-11-03', estado: 'enviado' },
      { id: 'd2', obra_id: 'o1', data: '2026-11-04', estado: 'rascunho' },
      { id: 'd3', obra_id: 'o1', data: '2026-10-20', estado: 'enviado' },
      { id: 'dx', obra_id: 'outra', data: '2026-11-03', estado: 'enviado' },
    ],
    obras_rdo_foto: [
      { id: 'f1', rdo_id: 'd1', path: 'o1/rdo/2026-11-03/a.jpg', legenda: 'valida', ordem: 1 },
      { id: 'f2', rdo_id: 'd1', path: 'o1/rdo/2026-11-03/b.jpg', legenda: 'outra valida', ordem: 2 },
      { id: 'f3', rdo_id: 'd2', path: 'o1/rdo/2026-11-04/c.jpg', legenda: 'rascunho', ordem: 1 },
      { id: 'f4', rdo_id: 'd1', path: 'o1/rdo/2026-11-03/../../outra/x.jpg', legenda: 'torta', ordem: 3 },
      { id: 'f5', rdo_id: 'd3', path: 'o1/rdo/2026-10-20/fora.jpg', legenda: 'fora do periodo', ordem: 1 },
      { id: 'f6', rdo_id: 'dx', path: 'outra/rdo/2026-11-03/y.jpg', legenda: 'outra obra', ordem: 1 },
    ],
  }
})

describe('rota do PDF da apresentação', () => {
  it('401 sem sessão e 403 sem acesso, sem ler nada', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    expect((await pedir()).status).toBe(401)
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await pedir()).status).toBe(403)
    expect(lerObraGrandeMock).not.toHaveBeenCalled()
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('400 para período inválido; 404 para SPOT e obra inexistente', async () => {
    expect((await pedir('periodo=custom&de=2026-11-05&ate=2026-11-01')).status).toBe(400)
    expect((await pedir('periodo=custom&de=2026-02-31&ate=2026-11-01')).status).toBe(400)
    const spot = obraPeriodo()
    spot.obra = { ...spot.obra, modalidade: 'spot' }
    lerObraGrandeMock.mockResolvedValueOnce({ ok: true, dados: spot })
    expect((await pedir()).status).toBe(404)
    lerObraGrandeMock.mockResolvedValueOnce({ ok: false, erro: 'Obra não encontrada' })
    expect((await pedir()).status).toBe(404)
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('PDF inline da versão cliente: só os blocos pedidos; fotos só as pedidas, validadas, desta obra e do período', async () => {
    downloadMock.mockImplementation(async () => ({ data: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0, 0])]), error: null }))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await pedir('periodo=mes&f=1&blocos=capa,resumo,fotos&fotos=f1,f2,f3,f4,f5,f6,..%2Fx')
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/pdf')
    expect(r.headers.get('Content-Disposition')).toBe('inline; filename="apresentacao-dp-macae-3-2026-11-10.pdf"')
    expect(r.headers.get('Cache-Control')).toContain('no-store')
    const d = pdfRenderizado()
    expect(d.conteudo.blocos).toEqual(['capa', 'resumo'])
    expect(JSON.stringify(d.conteudo)).not.toMatch(/Pedreiro faltou|98765|R\$|NaN/)
    // f3 (rascunho), f5 (fora do período) e f6 (outra obra) somem; f4 (caminho torto) é omitida sem download.
    expect(d.fotos.map((f) => f.legenda)).toEqual(['valida', 'outra valida'])
    expect(d.fotosOmitidas).toBe(1)
    expect(downloadMock.mock.calls.map((c) => c[0])).toEqual(['o1/rdo/2026-11-03/a.jpg', 'o1/rdo/2026-11-03/b.jpg'])
  })

  it('sem o bloco de fotos marcado, nada é baixado', async () => {
    const r = await pedir('periodo=semana&f=1&blocos=capa&fotos=f1')
    expect(r.status).toBe(200)
    expect(downloadMock).not.toHaveBeenCalled()
    expect(pdfRenderizado().fotos).toEqual([])
  })
})
