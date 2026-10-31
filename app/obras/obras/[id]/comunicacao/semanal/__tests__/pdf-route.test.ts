/**
 * @jest-environment node
 *
 * GET /obras/obras/<id>/comunicacao/semanal/pdf/<segunda> (Leva 3 §2.3): guarda
 * falha fechada (401/403), 404 para rascunho/semana inválida/SPOT, PDF da versão
 * cliente, fotos só do caminho canônico da obra. react-pdf e Supabase mockados.
 */
import { obraGrandePdf } from '../../../../_pdf/__tests__/fixtures/rdo'

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
const getUserMock = jest.fn()
const lerObraGrandeMock = jest.fn()
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 semanal'))
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
jest.mock('../../../../_lib/leitura', () => ({
  ...jest.requireActual('../../../../_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a),
}))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...a: unknown[]) => renderMock(...(a as [])),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { GET } from '../pdf/[segunda]/route'

const pedir = (segunda = '2026-10-26', id = 'o1') =>
  GET(new Request(`http://x/obras/obras/${id}/comunicacao/semanal/pdf/${segunda}`), { params: Promise.resolve({ id, segunda }) })

const semanal = (estado: string): Linha => ({
  id: 's1', obra_id: 'o1', semana_inicio: '2026-10-26', estado, observacoes: 'Semana boa.',
  validado_por: 'eng@manfac.com.br', validado_em: '2026-10-30T20:00:00Z',
})

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { email: 'Fulano@Manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  lerObraGrandeMock.mockResolvedValue({ ok: true, dados: obraGrandePdf() })
  db = {
    obras_semanal: [semanal('enviado')],
    obras_plano_semana: [],
    obras_restricao: [
      { id: 'r1', obra_id: 'o1', atividade_numero: 3, tipo: 'decisao_cliente', descricao: 'Aprovar layout', responsavel: 'cliente', prazo: null, situacao: 'identificada', criado_em: 'x' },
      { id: 'r2', obra_id: 'o1', atividade_numero: 3, tipo: 'decisao_cliente', descricao: 'Já liberada', responsavel: 'cliente', prazo: null, situacao: 'liberada', criado_em: 'x' },
    ],
    obras_rdo: [
      { id: 'd1', obra_id: 'o1', data: '2026-10-27', estado: 'enviado' },
      { id: 'd2', obra_id: 'o1', data: '2026-10-28', estado: 'rascunho' },
    ],
    obras_rdo_foto: [],
  }
})

describe('rota do PDF do semanal', () => {
  it('401 sem sessão e 403 sem acesso, sem ler nada', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    expect((await pedir()).status).toBe(401)
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await pedir()).status).toBe(403)
    expect(lerObraGrandeMock).not.toHaveBeenCalled()
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('404: rascunho, sem semanal, semana que não é segunda, obra SPOT', async () => {
    db.obras_semanal = [semanal('rascunho')]
    expect((await pedir()).status).toBe(404)
    db.obras_semanal = []
    expect((await pedir()).status).toBe(404)
    db.obras_semanal = [semanal('validado')]
    expect((await pedir('2026-10-27')).status).toBe(404)
    const spot = obraGrandePdf()
    spot.obra = { ...spot.obra, modalidade: 'spot' }
    lerObraGrandeMock.mockResolvedValue({ ok: true, dados: spot })
    expect((await pedir()).status).toBe(404)
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('enviado: PDF inline da versão cliente, lido na sexta; restrição liberada some', async () => {
    const r = await pedir()
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/pdf')
    expect(r.headers.get('Content-Disposition')).toBe('inline; filename="semanal-dp-macae-3-2026-10-26.pdf"')
    expect(r.headers.get('Cache-Control')).toContain('no-store')
    expect(lerObraGrandeMock).toHaveBeenCalledWith(expect.anything(), 'o1', '2026-10-30')
    const d = ((renderMock.mock.calls[0] as unknown[])[0] as { props: { d: { conteudo: Record<string, unknown> } } }).props.d
    expect(d.conteudo.lado).toBe('cliente')
    const json = JSON.stringify(d.conteudo)
    expect(json).not.toContain('Pedreiro faltou')
    expect(json).not.toContain('Já liberada')
    expect(json).toContain('Aprovar layout')
    expect(d.conteudo.observacoes).toBe('Semana boa.')
  })

  it('fotos: só de diários validados da semana e do caminho canônico desta obra', async () => {
    const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0, 0])])
    db.obras_rdo_foto = [
      { rdo_id: 'd1', path: 'o1/rdo/2026-10-27/a.jpg', legenda: 'ok', ordem: 1 },
      { rdo_id: 'd1', path: 'outra/rdo/2026-10-27/b.jpg', legenda: 'fora', ordem: 2 },
      { rdo_id: 'd2', path: 'o1/rdo/2026-10-28/c.jpg', legenda: 'rascunho', ordem: 1 },
    ]
    downloadMock.mockImplementation(async () => ({ data: jpeg(), error: null }))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await pedir()).status).toBe(200)
    expect(downloadMock).toHaveBeenCalledTimes(1)
    const d = ((renderMock.mock.calls[0] as unknown[])[0] as { props: { d: { fotos: { legenda: string; data: string }[]; fotosOmitidas: number } } }).props.d
    expect(d.fotos.map((f) => [f.legenda, f.data])).toEqual([['ok', '2026-10-27']])
    expect(d.fotosOmitidas).toBe(1)
  })
})
