/**
 * @jest-environment node
 */
type Resp = { data: unknown; error: unknown }
const sendMailMock = jest.fn()
const createTransportMock = jest.fn((_o: unknown) => ({ sendMail: sendMailMock }))
let respostas: Record<string, Resp>
const tabelasLidas: string[] = []

function cadeia(r: Resp) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq']) c[m] = jest.fn(() => c)
  c.then = (resolve: (v: Resp) => void) => resolve(r)
  return c
}

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (t: string) => {
      tabelasLidas.push(t)
      return cadeia(respostas[t] ?? { data: [], error: null })
    },
  }),
}))
jest.mock('nodemailer', () => ({ createTransport: (o: unknown) => createTransportMock(o) }))

import { POST } from '../route'

const SEGREDO = 'segredo-falso-de-teste'
const SENHA = 'senha-smtp-falsa-XYZ'
const ENV = {
  SOFIA_ALERTAS_SECRET: SEGREDO,
  SMTP_HOST: 'smtp.exemplo.test',
  SMTP_PORTA: '465',
  SMTP_USUARIO: 'manfac@exemplo.test',
  SMTP_SENHA: SENHA,
  SMTP_REMETENTE: 'manfac@exemplo.test',
}

function req(corpo: unknown = {}, auth: string | null = `Bearer ${SEGREDO}`) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (auth) headers.set('authorization', auth)
  return new Request('http://localhost/api/frotas/alertas-diarios', {
    method: 'POST',
    headers,
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  })
}

let consoleError: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  tabelasLidas.length = 0
  Object.assign(process.env, ENV)
  sendMailMock.mockResolvedValue({ messageId: 'x' })
  respostas = {
    sofia_gestores: { data: [{ user_email: 'Igor@Manfac.com.br' }, { user_email: 'sem-acesso@manfac.com.br' }], error: null },
    hub_system_access: { data: [{ user_email: 'igor@manfac.com.br' }], error: null },
  }
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k]
  const logado = consoleError.mock.calls.flat().map(String).join('\n')
  expect(logado).not.toContain(SEGREDO)
  expect(logado).not.toContain(SENHA)
  consoleError.mockRestore()
})

describe('configuração e autenticação', () => {
  it('sem SOFIA_ALERTAS_SECRET → 503, nada lido', async () => {
    delete process.env.SOFIA_ALERTAS_SECRET
    expect((await POST(req())).status).toBe(503)
    expect(tabelasLidas).toHaveLength(0)
  })

  it.each([null, 'Bearer errado', SEGREDO])('Bearer ausente/errado (%p) → 401, nada lido', async (auth) => {
    expect((await POST(req({}, auth))).status).toBe(401)
    expect(tabelasLidas).toHaveLength(0)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('o segredo do Obras não abre esta rota', async () => {
    process.env.OBRAS_CRON_SECRET = 'outro'
    expect((await POST(req({}, 'Bearer outro'))).status).toBe(401)
    delete process.env.OBRAS_CRON_SECRET
  })

  it.each(['SMTP_HOST', 'SMTP_USUARIO', 'SMTP_SENHA', 'SMTP_REMETENTE'])('sem %s → 503', async (nome) => {
    delete process.env[nome]
    const r = await POST(req())
    expect(r.status).toBe(503)
    expect(await r.json()).toEqual({ error: `${nome} não configurado` })
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('corpo inválido → 400', async () => {
    expect((await POST(req('nao-json'))).status).toBe(400)
    expect((await POST(req({ previa: false }))).status).toBe(400)
  })
})

describe('destinatários', () => {
  it('só gestor com acesso ao slug sofia recebe', async () => {
    const r = await POST(req())
    expect(r.status).toBe(200)
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock.mock.calls[0][0].to).toBe('igor@manfac.com.br')
  })

  it('lista vazia → 500, nada enviado', async () => {
    respostas.sofia_gestores = { data: [], error: null }
    expect((await POST(req())).status).toBe(500)
    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('erro ao ler destinatários → 500, nada enviado', async () => {
    respostas.sofia_gestores = { data: null, error: { message: 'boom' } }
    expect((await POST(req())).status).toBe(500)
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

describe('variantes', () => {
  it('nada pendente → manda o e-mail curto, 200', async () => {
    const r = await POST(req())
    expect(r.status).toBe(200)
    expect((await r.json()).variante).toBe('nada')
    expect(sendMailMock.mock.calls[0][0].subject).toMatch(/nada pendente hoje$/)
  })

  it('com pendências → assunto e links', async () => {
    respostas.multas = { data: [{ veiculo_id: null, motorista_id: null, data: '2026-10-02', valor: 100, status: 'pendente' }], error: null }
    const r = await POST(req())
    expect((await r.json()).variante).toBe('com')
    const m = sendMailMock.mock.calls[0][0]
    expect(m.subject).toContain('1 item pede atenção')
    expect(m.html).toContain('https://hub.manfac.com.br/sofia/multas')
    expect(m.from).toBe('"Manfac" <manfac@exemplo.test>')
  })

  it('falha de montagem → manda o aviso de falha e responde 500', async () => {
    respostas.veiculos = { data: null, error: { message: 'timeout' } }
    const r = await POST(req())
    expect(r.status).toBe(500)
    expect((await r.json()).status).toBe('falha-avisada')
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock.mock.calls[0][0].subject).toContain('não conseguimos montar')
  })

  it('falha do SMTP → 502 sem vazar a mensagem do servidor', async () => {
    sendMailMock.mockRejectedValue(Object.assign(new Error('530 senha-secreta'), { code: 'EAUTH' }))
    const r = await POST(req())
    expect(r.status).toBe(502)
    expect(JSON.stringify(await r.json())).not.toContain('senha-secreta')
  })

  it('previa: devolve o e-mail, não envia e dispensa SMTP', async () => {
    delete process.env.SMTP_HOST
    const r = await POST(req({ previa: true }))
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.assunto).toMatch(/^Frotas · /)
    expect(sendMailMock).not.toHaveBeenCalled()
    expect(createTransportMock).not.toHaveBeenCalled()
  })
})
