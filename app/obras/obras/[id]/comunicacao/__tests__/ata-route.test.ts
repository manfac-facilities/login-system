/**
 * @jest-environment node
 *
 * GET /obras/obras/<id>/comunicacao/ata/<registro> (Leva 2 §3.1 "Baixar PDF"):
 * 401 sem sessão, 403 sem acesso, 404 para o que não é reunião desta obra.
 */
type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
const getUserMock = jest.fn()
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 ata'))

function consulta(tabela: string) {
  const filtros: [string, unknown][] = []
  const linhas = () => (db[tabela] ?? []).filter((l) => filtros.every(([c, v]) => l[c] === v))
  const q = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push([c, v]), q),
    maybeSingle: async () => ({ data: linhas()[0] ?? null, error: null }),
  }
  return q
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => consulta(t) })),
}))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...a: unknown[]) => renderMock(...(a as [])),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { GET } from '../ata/[registro]/route'

const REG = '11111111-1111-4111-8111-111111111111'
const pedir = (registro = REG, id = 'o1') =>
  GET(new Request(`http://x/obras/obras/${id}/comunicacao/ata/${registro}`), { params: Promise.resolve({ id, registro }) })

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { email: 'Fulano@Manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  db = {
    obras_obra: [{ id: 'o1', modalidade: 'obra', loja: 'DP Macaé 3', os: 'OS-1', cliente: 'DPSP', engenheiro_email: null }],
    obras_registro: [
      {
        id: REG, obra_id: 'o1', tipo: 'reuniao', data: '2026-10-29', participantes: 'Ana', texto: null,
        ata: { pauta: 'p', decisoes: [], pendencias: [] }, criado_por: 'a@manfac.com.br', criado_em: '2026-10-29T18:00:00Z', editado_em: null,
      },
    ],
  }
})

describe('rota do PDF da ata', () => {
  it('401 sem sessão', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect((await pedir()).status).toBe(401)
  })
  it('403 sem acesso obras nem admin', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await pedir()).status).toBe(403)
    expect(renderMock).not.toHaveBeenCalled()
  })
  it('404: id inválido, outra obra, registro que não é reunião, obra SPOT', async () => {
    expect((await pedir('abc')).status).toBe(404)
    expect((await pedir(REG, 'o2')).status).toBe(404)
    db.obras_registro[0].tipo = 'ligacao'
    expect((await pedir()).status).toBe(404)
    db.obras_registro[0].tipo = 'reuniao'
    db.obras_obra[0].modalidade = 'spot'
    expect((await pedir()).status).toBe(404)
    expect(renderMock).not.toHaveBeenCalled()
  })
  it('200: PDF para baixar, sem cache', async () => {
    const r = await pedir()
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/pdf')
    expect(r.headers.get('Content-Disposition')).toBe('attachment; filename="ata-dp-macae-3-2026-10-29.pdf"')
    expect(r.headers.get('Cache-Control')).toBe('private, no-store')
  })
})
