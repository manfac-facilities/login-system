/**
 * @jest-environment node
 *
 * GET .../comunicacao/relatorio/<tipo>/<referencia>/pdf (Leva 4 §2.1): guarda
 * falha fechada (401/403), 404 para rascunho, tipo/referência fora do formato
 * e SPOT; PDF da versão cliente saído do congelado; fotos só pelos ids
 * congelados, re-resolvidas contra os diários validados DESTA obra no período.
 */
import { obraPeriodo } from '../../../../../../_pdf/__tests__/fixtures/periodo'
import { montarConteudoPeriodo } from '../../../../../../_lib/relatorio-periodo'

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
const getUserMock = jest.fn()
const lerObraGrandeMock = jest.fn()
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 periodo'))
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
jest.mock('../../../../../../../_lib/tipos', () => ({
  ...jest.requireActual('../../../../../../../_lib/tipos'),
  hojeISO: () => '2026-11-10',
}))
jest.mock('../../../../../../_lib/leitura', () => ({
  ...jest.requireActual('../../../../../../_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a),
}))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...a: unknown[]) => renderMock(...(a as [])),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image', Svg: 'Svg', Polyline: 'Polyline', Line: 'Line',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { GET } from '../pdf/route'

const pedir = (tipo = 'fase', referencia = '10', id = 'o1') =>
  GET(new Request(`http://x/obras/obras/${id}/comunicacao/relatorio/${tipo}/${referencia}/pdf`), { params: Promise.resolve({ id, tipo, referencia }) })

const congelado = () => {
  const base = {
    tipo: 'fase' as const, referencia: '10', obra: obraPeriodo(), inicio: '2026-10-26', fim: '2026-11-06', ref: '2026-11-06', hoje: '2026-11-10',
    planos: [], restricoes: [], highlights: ['Só o marcado'], observacoes: 'Como foi validado.',
  }
  return JSON.parse(JSON.stringify({
    cliente: montarConteudoPeriodo({ ...base, lado: 'cliente' }),
    interno: montarConteudoPeriodo({ ...base, lado: 'interno' }),
    fotos: ['f1', 'f4', 'f3'],
  }))
}
const relatorio = (estado: string, over: Linha = {}): Linha => ({
  id: 'r1', obra_id: 'o1', tipo: 'fase', referencia: '10', estado, periodo_inicio: '2026-10-26', periodo_fim: '2026-11-06',
  observacoes: 'Como foi validado.', highlights: { marcados: [], livre: null },
  conteudo: estado === 'rascunho' ? null : congelado(), validado_por: 'eng@manfac.com.br', validado_em: '2026-11-07T20:00:00Z', ...over,
})
const pdfRenderizado = () =>
  ((renderMock.mock.calls[0] as unknown[])[0] as {
    props: { d: { conteudo: Record<string, unknown>; fotos: { legenda: string }[]; fotosOmitidas: number } }
  }).props.d

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { email: 'Fulano@Manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  lerObraGrandeMock.mockImplementation(async () => ({ ok: true, dados: obraPeriodo() }))
  db = {
    obras_relatorio: [relatorio('enviado')],
    obras_plano_semana: [],
    obras_restricao: [],
    obras_rdo: [
      { id: 'd1', obra_id: 'o1', data: '2026-11-03', estado: 'enviado' },
      { id: 'd2', obra_id: 'o1', data: '2026-11-04', estado: 'rascunho' },
      { id: 'd3', obra_id: 'o1', data: '2026-11-20', estado: 'enviado' },
    ],
    obras_rdo_foto: [],
  }
})

describe('rota do PDF do relatório de período', () => {
  it('401 sem sessão e 403 sem acesso, sem ler nada', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    expect((await pedir()).status).toBe(401)
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await pedir()).status).toBe(403)
    expect(lerObraGrandeMock).not.toHaveBeenCalled()
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('404: rascunho, inexistente, tipo/referência inválidos, SPOT', async () => {
    db.obras_relatorio = [relatorio('rascunho')]
    expect((await pedir()).status).toBe(404)
    db.obras_relatorio = []
    expect((await pedir()).status).toBe(404)
    db.obras_relatorio = [relatorio('validado')]
    for (const [t, r] of [['semanal', '10'], ['fase', '010'], ['mensal', '2026-13'], ['fase', '..%2F']]) expect((await pedir(t, r)).status).toBe(404)
    const spot = obraPeriodo()
    spot.obra = { ...spot.obra, modalidade: 'spot' }
    lerObraGrandeMock.mockResolvedValue({ ok: true, dados: spot })
    expect((await pedir()).status).toBe(404)
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('enviado: PDF inline do congelado (cliente), nome sem numero; fotos só pelos ids, da obra e do período', async () => {
    downloadMock.mockImplementation(async () => ({ data: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0, 0])]), error: null }))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    db.obras_rdo_foto = [
      { id: 'f1', rdo_id: 'd1', path: 'o1/rdo/2026-11-03/a.jpg', legenda: 'congelada', ordem: 1 },
      { id: 'f2', rdo_id: 'd1', path: 'o1/rdo/2026-11-03/nova.jpg', legenda: 'nova', ordem: 2 },
      { id: 'f3', rdo_id: 'd2', path: 'o1/rdo/2026-11-04/c.jpg', legenda: 'rascunho', ordem: 1 },
      { id: 'f4', rdo_id: 'd1', path: 'o1/rdo/2026-11-03/../../outra/x.jpg', legenda: 'caminho torto', ordem: 3 },
      { id: 'f5', rdo_id: 'd3', path: 'o1/rdo/2026-11-20/fora.jpg', legenda: 'fora do período', ordem: 1 },
    ]
    const r = await pedir()
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/pdf')
    expect(r.headers.get('Content-Disposition')).toBe('inline; filename="fase-dp-macae-3-2026-11-06.pdf"')
    expect(r.headers.get('Cache-Control')).toContain('no-store')
    const d = pdfRenderizado()
    expect(d.conteudo.lado).toBe('cliente')
    expect(d.conteudo.highlights).toEqual(['Só o marcado'])
    expect(d.conteudo.observacoes).toBe('Como foi validado.')
    expect(JSON.stringify(d.conteudo)).not.toMatch(/Pedreiro faltou|98765|R\$/)
    // f1 entra; f4 (caminho fora do canônico) é omitida sem download; f3 (rascunho) e f2/f5 (não congeladas / fora) somem.
    expect(d.fotos.map((f) => f.legenda)).toEqual(['congelada'])
    expect(d.fotosOmitidas).toBe(1)
    expect(downloadMock).toHaveBeenCalledTimes(1)
    expect(downloadMock).toHaveBeenCalledWith('o1/rdo/2026-11-03/a.jpg')
  })
})
