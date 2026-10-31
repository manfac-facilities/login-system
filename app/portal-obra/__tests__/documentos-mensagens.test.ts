/**
 * @jest-environment node
 *
 * Documentos e Mensagens do portal (Leva 5 §3.2, Review Focus 4–5): download só de
 * documento da obra da sessão (outra obra → 404), URL assinada curta com download;
 * mensagem do cliente com autor da sessão, 1..4000, 30/h por e-mail; texto
 * nunca vira HTML (portal, e-mail); CSRF por Origin.
 */
const mockSessao = jest.fn()
const mockEnviar = jest.fn()
let mockAdmin: unknown

jest.mock('@/lib/portal-obra/sessao', () => ({ lerSessao: (...a: unknown[]) => mockSessao(...a) }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdmin }))
jest.mock('@/app/obras/obras/_lib/enviar', () => ({ enviarEmail: (...a: unknown[]) => mockEnviar(...a) }))
jest.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers({ host: 'hub.manfac.com.br' }) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { NextRequest } from 'next/server'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { FakeAdmin } from '@/lib/portal-obra/__tests__/fixtures/fake-admin'
import { gravarMensagemCliente, lerMensagensPortal } from '../(obra)/_lib/mensagens'
import { avisarEquipe, montarEmailMensagemCliente } from '../(obra)/_lib/aviso-mensagem'
import { origemConfere } from '../(obra)/obras/[obraId]/mensagens/_origem'
import { enviarMensagemAction } from '../(obra)/obras/[obraId]/mensagens/_actions'
import { GET } from '../(obra)/obras/[obraId]/documentos/[docId]/route'

const O = '11111111-1111-4111-8111-111111111111'
const OUTRA = '22222222-2222-4222-8222-222222222222'
const DOC = '33333333-3333-4333-8333-333333333333'
const DOC_ALHEIO = '44444444-4444-4444-8444-444444444444'
const UUID_ARQ = '55555555-5555-4555-8555-555555555555'
const ctx = (obraId: string, docId: string) => ({ params: Promise.resolve({ obraId, docId }) })
const req = (obraId: string, docId: string) => new NextRequest(`http://x/portal-obra/obras/${obraId}/documentos/${docId}`)

function comStorage(fake: FakeAdmin) {
  const signed = jest.fn(async (path: string, s: number, o: unknown) => ({ data: { signedUrl: `https://sb/${path}?t=1` }, error: null, args: [s, o] }))
  return Object.assign(fake, { storage: { from: () => ({ createSignedUrl: signed }) } }) as FakeAdmin & { storage: unknown }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSessao.mockResolvedValue({ email: 'cli@x.com', obras: [O] })
})

describe('download de documento', () => {
  const montar = () => {
    const fake = new FakeAdmin({
      obras_obra: [{ id: O, modalidade: 'obra' }],
      obras_documento: [
        { id: DOC, obra_id: O, path: `${O}/${UUID_ARQ}-planta.pdf`, nome: 'Planta.pdf' },
        { id: DOC_ALHEIO, obra_id: OUTRA, path: `${OUTRA}/${UUID_ARQ}-x.pdf`, nome: 'x.pdf' },
      ],
    })
    mockAdmin = comStorage(fake)
    return fake
  }

  it('redireciona para URL assinada de <= 5 min com download', async () => {
    montar()
    const r = await GET(req(O, DOC), ctx(O, DOC))
    expect(r.status).toBe(303)
    expect(r.headers.get('Location')).toContain(`${O}/${UUID_ARQ}-planta.pdf`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const from = (mockAdmin as any).storage.from()
    const [, seg, opts] = from.createSignedUrl.mock.calls[0]
    expect(seg).toBeLessThanOrEqual(300)
    expect(opts).toEqual({ download: 'Planta.pdf' })
  })

  it('documento de outra obra (mesmo com id válido) → 404', async () => {
    montar()
    expect((await GET(req(O, DOC_ALHEIO), ctx(O, DOC_ALHEIO))).status).toBe(404)
  })

  it('obra fora da sessão → 404 sem ler nada; sem sessão → /portal-obra', async () => {
    const fake = montar()
    expect((await GET(req(OUTRA, DOC_ALHEIO), ctx(OUTRA, DOC_ALHEIO))).status).toBe(404)
    expect(fake.chamadas).toHaveLength(0)
    mockSessao.mockResolvedValue(null)
    const r = await GET(req(O, DOC), ctx(O, DOC))
    expect(r.status).toBe(303)
    expect(r.headers.get('Location')).toBe('/portal-obra')
  })

  it('path fora do formato canônico → 404; id mal formado → 404', async () => {
    const fake = montar()
    fake.db.obras_documento[0].path = `${OUTRA}/${UUID_ARQ}-planta.pdf`
    expect((await GET(req(O, DOC), ctx(O, DOC))).status).toBe(404)
    expect((await GET(req(O, 'abc'), ctx(O, 'abc'))).status).toBe(404)
  })
})

describe('gravarMensagemCliente', () => {
  it('grava com autor da sessão, texto aparado', async () => {
    const fake = new FakeAdmin()
    const r = await gravarMensagemCliente(fake as never, { email: ' Cli@X.com ', obraId: O, texto: '  oi  ' })
    expect(r.ok).toBe(true)
    expect(fake.db.obras_mensagem[0]).toMatchObject({ obra_id: O, autor_tipo: 'cliente', autor_email: 'cli@x.com', texto: 'oi' })
  })

  it('rejeita vazio, só espaços e > 4000; aceita exatamente 4000', async () => {
    const fake = new FakeAdmin()
    for (const t of ['', '   \n ', 'a'.repeat(4001), 42]) {
      expect((await gravarMensagemCliente(fake as never, { email: 'c@x.com', obraId: O, texto: t })).ok).toBe(false)
    }
    expect(fake.db.obras_mensagem ?? []).toHaveLength(0)
    expect((await gravarMensagemCliente(fake as never, { email: 'c@x.com', obraId: O, texto: 'a'.repeat(4000) })).ok).toBe(true)
  })

  it('limite de 30 por hora por e-mail (outro e-mail e mensagens antigas não contam)', async () => {
    const agora = new Date('2026-11-01T12:00:00Z')
    const fake = new FakeAdmin({
      obras_mensagem: [
        ...Array.from({ length: 29 }, () => ({ autor_tipo: 'cliente', autor_email: 'c@x.com', criado_em: '2026-11-01T11:30:00Z' })),
        ...Array.from({ length: 10 }, () => ({ autor_tipo: 'cliente', autor_email: 'c@x.com', criado_em: '2026-11-01T09:00:00Z' })),
        ...Array.from({ length: 10 }, () => ({ autor_tipo: 'cliente', autor_email: 'outro@x.com', criado_em: '2026-11-01T11:30:00Z' })),
      ],
    }, () => agora)
    const g = () => gravarMensagemCliente(fake as never, { email: 'c@x.com', obraId: O, texto: 'oi', agora })
    expect((await g()).ok).toBe(true) // 30ª
    const r = await g() // 31ª
    expect(r.ok).toBe(false)
    expect((await gravarMensagemCliente(fake as never, { email: 'outro@x.com', obraId: O, texto: 'oi', agora })).ok).toBe(true)
  })

  it('conversa: mais antiga primeiro, mais nova por último', async () => {
    const fake = new FakeAdmin({
      obras_mensagem: [
        { id: 'a', obra_id: O, autor_tipo: 'cliente', texto: 'velha', criado_em: '2026-11-01T10:00:00Z' },
        { id: 'b', obra_id: O, autor_tipo: 'manfac', texto: 'nova', criado_em: '2026-11-01T11:00:00Z' },
        { id: 'c', obra_id: OUTRA, autor_tipo: 'manfac', texto: 'alheia', criado_em: '2026-11-01T12:00:00Z' },
      ],
    })
    expect((await lerMensagensPortal(fake as never, O)).map((m) => m.texto)).toEqual(['velha', 'nova'])
  })
})

describe('texto como texto puro', () => {
  const xss = '<script>alert(1)</script><img src=x onerror=alert(2)>'

  it('e-mail à equipe escapa o texto e o remetente', () => {
    const m = montarEmailMensagemCliente({ loja: 'Loja <b>', texto: xss, de: 'a"<i>@x.com', link: 'https://hub/obras/obras/1/comunicacao' })
    expect(m.html).not.toContain('<script')
    expect(m.html).not.toContain('<img')
    expect(m.html).not.toContain('<b>')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.html).toContain('https://hub/obras/obras/1/comunicacao')
  })

  it('portal: componente da mensagem renderiza como texto', () => {
    const html = renderToStaticMarkup(createElement('p', null, xss))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script')
  })

  it('hub e portal não usam dangerouslySetInnerHTML para mensagens', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    for (const f of [
      'app/portal-obra/(obra)/obras/[obraId]/mensagens/page.tsx',
      'app/obras/obras/[id]/comunicacao/page.tsx',
      'app/obras/obras/[id]/comunicacao/_linha-do-tempo.tsx',
    ]) {
      expect(fs.readFileSync(f, 'utf8')).not.toContain('dangerouslySetInnerHTML')
    }
  })
})

describe('aviso à equipe', () => {
  it('engenheiro + internos com imediato (sem duplicar, sem clientes nem outros tipos)', async () => {
    mockEnviar.mockResolvedValue({ ok: true })
    const fake = new FakeAdmin({
      obras_obra: [{ id: O, loja: 'DP Macaé', engenheiro_email: 'Eng@manfac.com.br' }],
      obras_destinatario: [
        { obra_id: O, email: 'eng@manfac.com.br', lado: 'interno', tipos: ['imediato'], ativo: true },
        { obra_id: O, email: 'coord@manfac.com.br', lado: 'interno', tipos: ['imediato', 'ata'], ativo: true },
        { obra_id: O, email: 'sem@manfac.com.br', lado: 'interno', tipos: ['ata'], ativo: true },
        { obra_id: O, email: 'cli@x.com', lado: 'cliente', tipos: ['imediato'], ativo: true },
        { obra_id: O, email: 'off@manfac.com.br', lado: 'interno', tipos: ['imediato'], ativo: false },
      ],
    })
    await avisarEquipe(fake as never, { obraId: O, texto: '<b>oi</b>', de: 'cli@x.com' })
    const arg = mockEnviar.mock.calls[0][0]
    expect([...arg.para].sort()).toEqual(['coord@manfac.com.br', 'eng@manfac.com.br'])
    expect(arg.html).not.toContain('<b>oi')
  })

  it('falha de envio não propaga', async () => {
    mockEnviar.mockRejectedValue(new Error('smtp'))
    const fake = new FakeAdmin({ obras_obra: [{ id: O, engenheiro_email: 'e@manfac.com.br' }] })
    await expect(avisarEquipe(fake as never, { obraId: O, texto: 'x', de: 'c@x.com' })).resolves.toBeUndefined()
  })
})

describe('server action', () => {
  const form = (t: string, extra: Record<string, string> = {}) => {
    const f = new FormData()
    f.set('texto', t)
    for (const [k, v] of Object.entries(extra)) f.set(k, v)
    return f
  }

  it('autor vem da sessão, nunca do form; avisa a equipe', async () => {
    mockEnviar.mockResolvedValue({ ok: true })
    const fake = new FakeAdmin({ obras_obra: [{ id: O, engenheiro_email: 'e@manfac.com.br' }] })
    mockAdmin = fake
    const r = await enviarMensagemAction(O, {}, form(' oi ', { autor_email: 'chefe@manfac.com.br', autor_tipo: 'manfac' }))
    expect(r).toEqual({ ok: true })
    expect(fake.db.obras_mensagem[0]).toMatchObject({ autor_tipo: 'cliente', autor_email: 'cli@x.com', texto: 'oi' })
    expect(mockEnviar).toHaveBeenCalled()
  })

  it('obra fora da sessão e sem sessão não gravam', async () => {
    const fake = new FakeAdmin()
    mockAdmin = fake
    expect((await enviarMensagemAction(OUTRA, {}, form('oi'))).erro).toBeTruthy()
    mockSessao.mockResolvedValue(null)
    expect((await enviarMensagemAction(O, {}, form('oi'))).erro).toBeTruthy()
    expect(fake.db.obras_mensagem ?? []).toHaveLength(0)
  })

  it('falha no e-mail não bloqueia a mensagem', async () => {
    mockEnviar.mockRejectedValue(new Error('smtp'))
    const fake = new FakeAdmin({ obras_obra: [{ id: O, engenheiro_email: 'e@manfac.com.br' }] })
    mockAdmin = fake
    expect(await enviarMensagemAction(O, {}, form('oi'))).toEqual({ ok: true })
  })
})

describe('origemConfere (CSRF)', () => {
  const h = (o: Record<string, string>) => new Headers(o)
  it('aceita a própria origem e ausência de Origin; recusa origem alheia', () => {
    expect(origemConfere(h({ host: 'hub.manfac.com.br', origin: 'https://hub.manfac.com.br' }))).toBe(true)
    expect(origemConfere(h({ host: 'interno:3000', 'x-forwarded-host': 'hub.manfac.com.br', origin: 'https://hub.manfac.com.br' }))).toBe(true)
    expect(origemConfere(h({ host: 'hub.manfac.com.br' }))).toBe(true)
    expect(origemConfere(h({ host: 'hub.manfac.com.br', origin: 'https://evil.com' }))).toBe(false)
    expect(origemConfere(h({ host: 'hub.manfac.com.br', origin: 'null' }))).toBe(false)
  })
})
