/**
 * @jest-environment node
 */
import { FakeAdmin } from './fixtures/fake-admin'

let mockFake: FakeAdmin
const mockEnviar = jest.fn()
const mockPendentes: Promise<unknown>[] = []

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockFake }))
jest.mock('@/app/obras/obras/_lib/enviar', () => ({ enviarEmail: (...a: unknown[]) => mockEnviar(...a) }))
jest.mock('next/server', () => ({ after: (fn: () => unknown) => { mockPendentes.push(Promise.resolve(fn())) } }))

import { pedirCodigo, verificarCodigo } from '../codigo'
import { lerSessao, encerrarSessao, opcoesCookiePortal, COOKIE_SESSAO } from '../sessao'
import { MENSAGEM_UNIFORME, MENSAGEM_CODIGO_INVALIDO, MENSAGEM_INDISPONIVEL } from '../acesso'
import { ipDoCliente } from '../limites'

const SEGREDO = 'x'.repeat(48)
const MIN = 60_000
const DIA = 24 * 60 * MIN
const T0 = new Date('2026-11-02T12:00:00.000Z')
let agora = T0
const em = (ms: number) => new Date(T0.getTime() + ms)

const ACESSO = [
  { obra_id: 'obra-1', email: 'cliente@dpsp.com.br', nome: 'Cliente', ativo: true },
  { obra_id: 'obra-2', email: 'cliente@dpsp.com.br', nome: 'Cliente', ativo: true },
  { obra_id: 'obra-3', email: 'inativo@dpsp.com.br', nome: 'Inativo', ativo: false },
  { obra_id: 'obra-9', email: 'joao@manfac.com.br', nome: 'Interno', ativo: true },
]

async function enviados() {
  await Promise.all(mockPendentes.splice(0))
  return mockEnviar.mock.calls.map((c) => c[0] as { para: string[]; assunto: string; texto: string; html: string })
}

/** Pede um código e devolve o que chegou no e-mail. */
async function codigoPara(email: string, ip = '10.0.0.1', quando = agora) {
  mockEnviar.mockClear()
  const r = await pedirCodigo(email, ip, quando)
  expect(r).toEqual({ ok: true, mensagem: MENSAGEM_UNIFORME })
  const env = await enviados()
  expect(env).toHaveLength(1)
  return env[0].texto.match(/\b(\d{6})\b/)![1]
}

const errado = (c: string) => String((Number(c) + 1) % 1_000_000).padStart(6, '0')
const cookiesCom = (token?: string) => ({ get: (n: string) => (n === COOKIE_SESSAO && token ? { value: token } : undefined) })

beforeEach(() => {
  process.env.PORTAL_OBRA_SEGREDO = SEGREDO
  agora = T0
  mockFake = new FakeAdmin({ obras_portal_acesso: ACESSO.map((r) => ({ ...r })) }, () => agora)
  mockEnviar.mockReset().mockResolvedValue({ ok: true, aceitos: [], falhas: [] })
  mockPendentes.splice(0)
})

afterEach(() => jest.restoreAllMocks())

describe('pedirCodigo', () => {
  it('e-mail cadastrado: grava só o hash, 10 min, 0 tentativas, IP, e manda e-mail curto sem dado de obra', async () => {
    const codigo = await codigoPara('  Cliente@DPSP.com.br ', '200.1.2.3')
    expect(codigo).toMatch(/^\d{6}$/)
    const linhas = mockFake.db.obras_portal_codigo
    expect(linhas).toHaveLength(1)
    const l = linhas[0]
    expect(l.email).toBe('cliente@dpsp.com.br')
    expect(l.codigo_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(l)).not.toContain(codigo)
    expect(Date.parse(l.expira_em) - T0.getTime()).toBe(10 * MIN)
    expect(l.tentativas).toBe(0)
    expect(l.usado_em ?? null).toBeNull()
    expect(l.ip).toBe('200.1.2.3')
    const [env] = mockEnviar.mock.calls[0]
    expect(env.para).toEqual(['cliente@dpsp.com.br'])
    expect(`${env.assunto}${env.texto}${env.html}`).not.toMatch(/obra-1|obra-2/)
    expect(env.anexos).toEqual([])
  })

  it.each([
    ['não cadastrado', 'ninguem@dpsp.com.br'],
    ['acesso inativo', 'inativo@dpsp.com.br'],
    ['@manfac.com.br (mesmo cadastrado)', 'joao@manfac.com.br'],
    ['subdomínio manfac', 'x@sub.manfac.com.br'],
    ['formato inválido', 'nao-e-email'],
    ['vazio', ''],
    ['não string', 42],
  ])('%s → mesma mensagem, nada gravado, nada enviado', async (_n, email) => {
    const r = await pedirCodigo(email, '10.0.0.1', agora)
    expect(r).toEqual({ ok: true, mensagem: MENSAGEM_UNIFORME })
    expect(mockFake.db.obras_portal_codigo ?? []).toHaveLength(0)
    expect(await enviados()).toHaveLength(0)
  })

  it('Review Focus 1: 6º pedido na hora é recusado com a mesma mensagem, sem gravar nem enviar; libera após 1 h', async () => {
    for (let i = 0; i < 5; i++) await codigoPara('cliente@dpsp.com.br', `10.0.0.${i}`, em(i * MIN))
    mockEnviar.mockClear()
    const sexto = await pedirCodigo('cliente@dpsp.com.br', '10.0.0.99', em(30 * MIN))
    expect(sexto).toEqual({ ok: true, mensagem: MENSAGEM_UNIFORME })
    expect(mockFake.db.obras_portal_codigo).toHaveLength(5)
    expect(await enviados()).toHaveLength(0)
    // Uma hora depois do primeiro, a janela libera um.
    await codigoPara('cliente@dpsp.com.br', '10.0.0.99', em(60 * MIN + 1))
  })

  it('20 códigos por hora por IP; o 21º do mesmo IP é recusado com a mesma mensagem', async () => {
    mockFake.db.obras_portal_acesso = Array.from({ length: 21 }, (_, i) => ({ obra_id: 'o', email: `c${i}@x.com`, nome: '', ativo: true }))
    for (let i = 0; i < 20; i++) await codigoPara(`c${i}@x.com`, '9.9.9.9')
    mockEnviar.mockClear()
    expect(await pedirCodigo('c20@x.com', '9.9.9.9', agora)).toEqual({ ok: true, mensagem: MENSAGEM_UNIFORME })
    expect(await enviados()).toHaveLength(0)
    await codigoPara('c20@x.com', '8.8.8.8')
  })

  it('erro na contagem dos limites → falha fechada (não emite), mesma mensagem', async () => {
    mockFake.falhar.add('obras_portal_codigo:select')
    expect(await pedirCodigo('cliente@dpsp.com.br', '1.1.1.1', agora)).toEqual({ ok: true, mensagem: MENSAGEM_UNIFORME })
    expect(mockFake.db.obras_portal_codigo ?? []).toHaveLength(0)
    expect(await enviados()).toHaveLength(0)
  })

  it.each([['ausente', undefined], ['curto', 'curto']])('segredo %s → recusa (falha fechada) com mensagem genérica', async (_n, s) => {
    if (s === undefined) delete process.env.PORTAL_OBRA_SEGREDO
    else process.env.PORTAL_OBRA_SEGREDO = s
    jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(await pedirCodigo('cliente@dpsp.com.br', '1.1.1.1', agora)).toEqual({ ok: false, mensagem: MENSAGEM_INDISPONIVEL })
    expect(await verificarCodigo('cliente@dpsp.com.br', '123456', agora)).toEqual({ ok: false, mensagem: MENSAGEM_INDISPONIVEL })
    expect(mockFake.chamadas).toHaveLength(0)
    expect(await enviados()).toHaveLength(0)
  })
})

describe('verificarCodigo', () => {
  const INVALIDO = { ok: false, mensagem: MENSAGEM_CODIGO_INVALIDO }

  it('código certo → sessão; banco guarda só o hash do token; código marcado como usado', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    const r = await verificarCodigo(' CLIENTE@dpsp.com.br', c, em(MIN))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/) // 32 bytes base64url
    expect(r.expiraCookie.getTime() - em(MIN).getTime()).toBe(30 * DIA)
    const [s] = mockFake.db.obras_portal_sessao
    expect(s.token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(mockFake.db)).not.toContain(r.token)
    expect(Date.parse(s.expira_em) - em(MIN).getTime()).toBe(7 * DIA)
    expect(s.email).toBe('cliente@dpsp.com.br')
    expect(mockFake.db.obras_portal_codigo[0].usado_em).toBe(em(MIN).toISOString())
  })

  it('uso único: o mesmo código não entra duas vezes', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    expect((await verificarCodigo('cliente@dpsp.com.br', c, agora)).ok).toBe(true)
    expect(await verificarCodigo('cliente@dpsp.com.br', c, agora)).toEqual(INVALIDO)
  })

  it('uso único sob corrida: 6 conferências simultâneas do código certo → exatamente uma sessão', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    const rs = await Promise.all(Array.from({ length: 6 }, () => verificarCodigo('cliente@dpsp.com.br', c, agora)))
    expect(rs.filter((r) => r.ok)).toHaveLength(1)
    expect(mockFake.db.obras_portal_sessao).toHaveLength(1)
    expect(mockFake.db.obras_portal_codigo[0].tentativas).toBeLessThanOrEqual(5)
  })

  it('expiração: vale até 10 min; depois, nem o código certo entra', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    expect(await verificarCodigo('cliente@dpsp.com.br', c, em(10 * MIN))).toEqual(INVALIDO)
    const c2 = await codigoPara('cliente@dpsp.com.br', '10.0.0.1', em(11 * MIN))
    expect((await verificarCodigo('cliente@dpsp.com.br', c2, em(11 * MIN + 10 * MIN - 1))).ok).toBe(true)
  })

  it('Review Focus 1: 5 códigos errados invalidam o código — a 6ª tentativa, mesmo certa, é recusada', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    for (let i = 0; i < 5; i++) expect(await verificarCodigo('cliente@dpsp.com.br', errado(c), agora)).toEqual(INVALIDO)
    expect(mockFake.db.obras_portal_codigo[0].tentativas).toBe(5)
    expect(await verificarCodigo('cliente@dpsp.com.br', c, agora)).toEqual(INVALIDO)
    expect(mockFake.db.obras_portal_sessao ?? []).toHaveLength(0)
  })

  it('4 errados e o certo na 5ª tentativa ainda entra', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    for (let i = 0; i < 4; i++) await verificarCodigo('cliente@dpsp.com.br', errado(c), agora)
    expect((await verificarCodigo('cliente@dpsp.com.br', c, agora)).ok).toBe(true)
  })

  it('tentativas sob corrida: 10 erradas simultâneas não passam de 5 contadas', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    for (let rodada = 0; rodada < 10; rodada++) {
      await Promise.all(Array.from({ length: 10 }, () => verificarCodigo('cliente@dpsp.com.br', errado(c), agora)))
    }
    expect(mockFake.db.obras_portal_codigo[0].tentativas).toBe(5)
    expect(await verificarCodigo('cliente@dpsp.com.br', c, agora)).toEqual(INVALIDO)
  })

  it('pedir um código novo aposenta o anterior', async () => {
    const velho = await codigoPara('cliente@dpsp.com.br')
    const novo = await codigoPara('cliente@dpsp.com.br', '10.0.0.1', em(MIN))
    if (velho !== novo) expect(await verificarCodigo('cliente@dpsp.com.br', velho, em(MIN))).toEqual(INVALIDO)
    expect((await verificarCodigo('cliente@dpsp.com.br', novo, em(MIN))).ok).toBe(true)
  })

  it('código de um e-mail não serve para outro', async () => {
    mockFake.db.obras_portal_acesso.push({ obra_id: 'obra-5', email: 'outro@x.com', nome: '', ativo: true })
    const c = await codigoPara('cliente@dpsp.com.br')
    const c2 = await codigoPara('outro@x.com')
    if (c !== c2) expect(await verificarCodigo('outro@x.com', c, agora)).toEqual(INVALIDO)
    expect((await verificarCodigo('outro@x.com', c2, agora)).ok).toBe(true)
  })

  it('acesso desativado entre o pedido e a conferência → recusado', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    mockFake.db.obras_portal_acesso.forEach((r) => { r.ativo = false })
    expect(await verificarCodigo('cliente@dpsp.com.br', c, agora)).toEqual(INVALIDO)
    expect(mockFake.db.obras_portal_sessao ?? []).toHaveLength(0)
  })

  it('mensagem uniforme em todas as falhas (sem código, formato, e-mail desconhecido, @manfac, errado)', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    const falhas = await Promise.all([
      verificarCodigo('ninguem@dpsp.com.br', c, agora),
      verificarCodigo('joao@manfac.com.br', c, agora),
      verificarCodigo('cliente@dpsp.com.br', '12a456', agora),
      verificarCodigo('cliente@dpsp.com.br', '', agora),
      verificarCodigo('cliente@dpsp.com.br', errado(c), agora),
      verificarCodigo('inativo@dpsp.com.br', c, agora),
    ])
    falhas.forEach((f) => expect(f).toEqual(INVALIDO))
  })

  it('erro no banco ao marcar a tentativa → recusa (falha fechada)', async () => {
    const c = await codigoPara('cliente@dpsp.com.br')
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFake.falhar.add('obras_portal_codigo:update')
    expect(await verificarCodigo('cliente@dpsp.com.br', c, agora)).toEqual(INVALIDO)
  })

  it('nunca loga código, token nem segredo', async () => {
    const logs: string[] = []
    const capturar = (...a: unknown[]) => { logs.push(a.map(String).join(' ')) }
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) jest.spyOn(console, m).mockImplementation(capturar)
    mockEnviar.mockResolvedValue({ ok: false, aceitos: [], falhas: [{ para: 'cliente@dpsp.com.br', erro: '535' }] })
    const c = await codigoPara('cliente@dpsp.com.br')
    const r = await verificarCodigo('cliente@dpsp.com.br', c, agora)
    if (!r.ok) throw new Error('esperava sessão')
    await lerSessao(cookiesCom(r.token), em(10 * MIN))
    await encerrarSessao(cookiesCom(r.token), em(11 * MIN))
    const tudo = logs.join('\n')
    expect(tudo).not.toContain(c)
    expect(tudo).not.toContain(r.token)
    expect(tudo).not.toContain(SEGREDO)
  })
})

describe('lerSessao / encerrarSessao', () => {
  async function entrar(quando = agora) {
    const c = await codigoPara('cliente@dpsp.com.br', '10.0.0.1', quando)
    const r = await verificarCodigo('cliente@dpsp.com.br', c, quando)
    if (!r.ok) throw new Error('esperava sessão')
    return r.token
  }

  it('sessão válida → e-mail e obras com acesso ativo (sem as inativas)', async () => {
    const t = await entrar()
    expect(await lerSessao(cookiesCom(t), em(MIN))).toEqual({ email: 'cliente@dpsp.com.br', obras: ['obra-1', 'obra-2'] })
  })

  it('sem cookie, token malformado ou desconhecido → null', async () => {
    await entrar()
    expect(await lerSessao(cookiesCom(undefined), agora)).toBeNull()
    expect(await lerSessao(cookiesCom('abc'), agora)).toBeNull()
    expect(await lerSessao(cookiesCom('A'.repeat(43)), agora)).toBeNull()
  })

  it('Review Focus 2: acesso desativado derruba a sessão no próximo request (e reativar não ressuscita)', async () => {
    const t = await entrar()
    expect(await lerSessao(cookiesCom(t), em(MIN))).not.toBeNull()
    mockFake.db.obras_portal_acesso.forEach((r) => { if (r.email === 'cliente@dpsp.com.br') r.ativo = false })
    expect(await lerSessao(cookiesCom(t), em(2 * MIN))).toBeNull()
    expect(mockFake.db.obras_portal_sessao[0].revogada_em).toBe(em(2 * MIN).toISOString())
    mockFake.db.obras_portal_acesso.forEach((r) => { r.ativo = true })
    expect(await lerSessao(cookiesCom(t), em(3 * MIN))).toBeNull()
  })

  it('desativar só uma obra tira essa obra da sessão', async () => {
    const t = await entrar()
    mockFake.db.obras_portal_acesso[0].ativo = false
    expect(await lerSessao(cookiesCom(t), em(MIN))).toEqual({ email: 'cliente@dpsp.com.br', obras: ['obra-2'] })
  })

  it('7 dias sem uso → expira', async () => {
    const t = await entrar()
    expect(await lerSessao(cookiesCom(t), em(7 * DIA - 1))).not.toBeNull()
    const t2 = await entrar(em(8 * DIA))
    expect(await lerSessao(cookiesCom(t2), em(8 * DIA + 7 * DIA))).toBeNull()
  })

  it('renova 7 dias no uso, com teto de 30 dias desde a criação', async () => {
    const t = await entrar()
    for (let d = 6; d < 30; d += 6) {
      expect(await lerSessao(cookiesCom(t), em(d * DIA))).not.toBeNull()
      const exp = Date.parse(mockFake.db.obras_portal_sessao[0].expira_em)
      expect(exp).toBe(Math.min(em(d * DIA + 7 * DIA).getTime(), em(30 * DIA).getTime()))
    }
    expect(await lerSessao(cookiesCom(t), em(30 * DIA - 1))).not.toBeNull()
    expect(await lerSessao(cookiesCom(t), em(30 * DIA))).toBeNull()
  })

  it('encerrarSessao revoga; a sessão não volta', async () => {
    const t = await entrar()
    await encerrarSessao(cookiesCom(t), em(MIN))
    expect(mockFake.db.obras_portal_sessao[0].revogada_em).toBe(em(MIN).toISOString())
    expect(await lerSessao(cookiesCom(t), em(2 * MIN))).toBeNull()
  })

  it('erro ao ler acesso → null (falha fechada)', async () => {
    const t = await entrar()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    mockFake.falhar.add('obras_portal_acesso')
    expect(await lerSessao(cookiesCom(t), em(MIN))).toBeNull()
  })

  it('segredo removido depois → null; segredo trocado → null', async () => {
    const t = await entrar()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.PORTAL_OBRA_SEGREDO
    expect(await lerSessao(cookiesCom(t), em(MIN))).toBeNull()
    process.env.PORTAL_OBRA_SEGREDO = 'y'.repeat(48)
    expect(await lerSessao(cookiesCom(t), em(MIN))).toBeNull()
  })
})

describe('cookie e IP', () => {
  it('cookie httpOnly, secure, sameSite=lax, path /portal-obra', () => {
    const exp = new Date('2026-12-01T00:00:00Z')
    expect(opcoesCookiePortal(exp)).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/portal-obra', expires: exp })
  })

  it('IP: primeiro salto do x-forwarded-for; senão x-real-ip; senão "desconhecido"', () => {
    const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null })
    expect(ipDoCliente(h({ 'x-forwarded-for': ' 200.1.1.1 , 10.0.0.2', 'x-real-ip': '10.0.0.2' }))).toBe('200.1.1.1')
    expect(ipDoCliente(h({ 'x-real-ip': '10.0.0.3' }))).toBe('10.0.0.3')
    expect(ipDoCliente(h({}))).toBe('desconhecido')
  })
})
