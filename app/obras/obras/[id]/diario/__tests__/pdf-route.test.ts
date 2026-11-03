/**
 * @jest-environment node
 *
 * GET /obras/obras/<id>/diario/pdf/<data> (Leva 2 §3.3): guarda falha fechada
 * (401 sem sessão, 403 sem acesso), 404 para RDO inexistente/rascunho, e o
 * PDF sai da versão cliente. react-pdf, Supabase e leitura são mockados.
 */
import { obraGrandePdf } from '../../../_pdf/__tests__/fixtures/rdo'

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
const getUserMock = jest.fn()
const lerObraGrandeMock = jest.fn()
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 teste'))
const downloadMock = jest.fn()

function consulta(tabela: string) {
  const filtros: [string, unknown][] = []
  const linhas = () => (db[tabela] ?? []).filter((l) => filtros.every(([c, v]) => l[c] === v))
  const q = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push([c, v]), q),
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
jest.mock('../../../_lib/leitura', () => ({
  ...jest.requireActual('../../../_lib/leitura'),
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
import { GET } from '../pdf/[data]/route'

const pedir = (data = '2026-10-29', id = 'o1') =>
  GET(new Request(`http://x/obras/obras/${id}/diario/pdf/${data}`), { params: Promise.resolve({ id, data }) })

const rdo = (estado: string): Linha => ({
  id: 'r1', obra_id: 'o1', data: '2026-10-29', estado, sem_execucao: false, efetivo: 4, equipe_texto: 'equipe A',
  programacao_amanha: 'seguir', clima_manha: 'sol', clima_tarde: null,
  validado_por: 'eng@manfac.com.br', validado_em: '2026-10-29T21:40:00Z',
})

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { email: 'Fulano@Manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  lerObraGrandeMock.mockResolvedValue({ ok: true, dados: obraGrandePdf() })
  db = {
    obras_rdo: [rdo('enviado')],
    obras_rdo_avanco: [{ rdo_id: 'r1', numero: 1, de: 0.4, para: 1, concluida: true, causa: null }],
    obras_rdo_foto: [],
  }
})

describe('rota do PDF do diário', () => {
  it('401 sem sessão (não lê nada)', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const r = await pedir()
    expect(r.status).toBe(401)
    expect(lerObraGrandeMock).not.toHaveBeenCalled()
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('403 sem acesso obras nem admin', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await pedir()
    expect(r.status).toBe(403)
    expect(hasSystemAccess).toHaveBeenCalledWith(expect.anything(), 'fulano@manfac.com.br', 'obras')
    expect(lerObraGrandeMock).not.toHaveBeenCalled()
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('admin sem acesso obras passa', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    expect((await pedir()).status).toBe(200)
  })

  it('404 com RDO em rascunho', async () => {
    db.obras_rdo = [rdo('rascunho')]
    const r = await pedir()
    expect(r.status).toBe(404)
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('404 sem RDO no dia, com data inválida e para obra SPOT', async () => {
    db.obras_rdo = []
    expect((await pedir()).status).toBe(404)
    expect((await pedir('29-10-2026')).status).toBe(404)
    db.obras_rdo = [rdo('validado')]
    const spot = obraGrandePdf()
    spot.obra = { ...spot.obra, modalidade: 'spot' }
    lerObraGrandeMock.mockResolvedValue({ ok: true, dados: spot })
    expect((await pedir()).status).toBe(404)
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('validado: devolve o PDF inline, sem cache, da versão cliente lida na data do RDO', async () => {
    db.obras_rdo = [rdo('validado')]
    const r = await pedir()
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/pdf')
    expect(r.headers.get('Content-Disposition')).toBe('inline; filename="diario-dp-macae-3-2026-10-29.pdf"')
    expect(r.headers.get('Cache-Control')).toContain('no-store')
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe('%PDF-1.4 teste')
    expect(lerObraGrandeMock).toHaveBeenCalledWith(expect.anything(), 'o1', '2026-10-29')
    const el = (renderMock.mock.calls[0] as unknown[])[0] as { props: { d: { conteudo: { lado: string; travados: { corpo: string }[] }; equipe: unknown } } }
    expect(el.props.d.conteudo.lado).toBe('cliente')
    expect(JSON.stringify(el.props.d.conteudo)).not.toContain('Pedreiro faltou')
    expect(el.props.d.equipe).toEqual({ efetivo: 4, texto: 'equipe A' })
  })

  it('fotos: só caminho canônico do RDO, JPEG até 1,5 MB; o resto conta como omitida', async () => {
    const jpeg = (n: number) => new Blob([new Uint8Array([0xff, 0xd8, 0xff, ...new Array(n).fill(0)])])
    db.obras_rdo_foto = [
      { rdo_id: 'r1', path: 'o1/rdo/2026-10-29/a.jpg', legenda: 'ok', ordem: 1 },
      { rdo_id: 'r1', path: 'o1/rdo/2026-10-29/b.jpg', legenda: 'grande', ordem: 2 },
      { rdo_id: 'r1', path: 'outra/rdo/2026-10-29/c.jpg', legenda: 'fora', ordem: 3 },
      { rdo_id: 'r1', path: 'o1/rdo/2026-10-29/d.jpg', legenda: 'heic', ordem: 4 },
    ]
    downloadMock.mockImplementation(async (p: string) => ({
      data: p.endsWith('b.jpg') ? jpeg(1_600_000) : p.endsWith('d.jpg') ? new Blob([new Uint8Array([0, 0, 0, 0])]) : jpeg(10),
      error: null,
    }))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await pedir()).status).toBe(200)
    expect(downloadMock).toHaveBeenCalledTimes(3) // o caminho de outra obra nem é baixado
    const d = ((renderMock.mock.calls[0] as unknown[])[0] as { props: { d: { fotos: { legenda: string }[]; fotosOmitidas: number } } }).props.d
    expect(d.fotos.map((f) => f.legenda)).toEqual(['ok'])
    expect(d.fotosOmitidas).toBe(3)
  })
})
