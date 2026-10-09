/** @jest-environment node */
/**
 * A rota do relatório diário (spec §3, §11.1). Mockados: o cliente admin do
 * Supabase (respostas por tabela), o `nodemailer` e o `ImageResponse` do
 * `next/og` (o render real não roda no jest — ver imagem.test.tsx). O resto é o
 * código de verdade: leitura paginada, `montarPainel`, montagem do e-mail.
 */

type Resposta = { data: unknown[] | null; error: { message: string } | null }

let respostas: Record<string, Resposta>
const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = []
const createAdminClientMock = jest.fn()

function adminFalso() {
  return {
    from(tabela: string) {
      const q: Record<string, unknown> = {}
      for (const metodo of ['select', 'eq', 'order', 'range']) {
        q[metodo] = (...args: unknown[]) => {
          chamadas.push({ tabela, metodo, args })
          return q
        }
      }
      q.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) =>
        Promise.resolve(respostas[tabela] ?? { data: [], error: null }).then(ok, falha)
      return q
    },
  }
}

const sendMailMock = jest.fn()
const createTransportMock = jest.fn((opcoes: unknown) => {
  void opcoes
  return { sendMail: sendMailMock }
})
let imagemFalha: Error | null = null
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClientMock() }))
jest.mock('nodemailer', () => ({ createTransport: (o: unknown) => createTransportMock(o) }))
jest.mock('next/og', () => ({
  ImageResponse: class {
    async arrayBuffer() {
      if (imagemFalha) throw imagemFalha
      return PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength)
    }
  },
}))
jest.mock('@/app/obras/sincronizar/_execucao', () => ({
  prepararExecucao: jest.fn(),
  executarExecucaoPreparada: jest.fn(),
}))

import { POST } from '../route'
import { CID_IMAGEM } from '../_email'

const SEGREDO = 'segredo-falso-de-teste'
const SENHA = 'senha-smtp-falsa-XYZ'
const AUTH = `Bearer ${SEGREDO}`
const ENV = {
  OBRAS_CRON_SECRET: SEGREDO,
  SMTP_HOST: 'smtp.exemplo.test',
  SMTP_PORTA: '465',
  SMTP_USUARIO: 'manfac@exemplo.test',
  SMTP_SENHA: SENHA,
  SMTP_REMETENTE: 'manfac@exemplo.test',
}

function requisicao(corpo: unknown = {}, authorization: string | null = AUTH) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (authorization) headers.set('authorization', authorization)
  return new Request('http://localhost/api/obras/relatorio-diario', {
    method: 'POST',
    headers,
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  })
}

let consoleError: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  chamadas.length = 0
  imagemFalha = null
  Object.assign(process.env, ENV)
  createAdminClientMock.mockImplementation(adminFalso)
  sendMailMock.mockResolvedValue({ messageId: 'x' })
  respostas = {
    hub_system_access: {
      data: [
        { user_email: ' Ana@Manfac.com.br ', has_access: true },
        { user_email: 'bruno@manfac.com.br', has_access: true },
      ],
      error: null,
    },
    hub_user_roles: { data: [{ user_email: 'admin@manfac.com.br' }, { user_email: 'ana@manfac.com.br' }], error: null },
  }
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k]
  // Nada logado pode conter segredo ou senha.
  const logado = consoleError.mock.calls.flat().map(String).join('\n')
  expect(logado).not.toContain(SEGREDO)
  expect(logado).not.toContain(SENHA)
  consoleError.mockRestore()
})

const nadaEnviado = () => {
  expect(sendMailMock).not.toHaveBeenCalled()
}

describe('configuração e autenticação', () => {
  it('sem OBRAS_CRON_SECRET → 503, sem ler nada', async () => {
    delete process.env.OBRAS_CRON_SECRET
    const r = await POST(requisicao())
    expect(r.status).toBe(503)
    expect(createAdminClientMock).not.toHaveBeenCalled()
    nadaEnviado()
  })

  it.each([null, 'Bearer errado', SEGREDO])('Bearer ausente/errado (%p) → 401, sem ler nada', async (auth) => {
    const r = await POST(requisicao({}, auth))
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'Não autorizado' })
    expect(createAdminClientMock).not.toHaveBeenCalled()
    nadaEnviado()
  })

  it.each(['SMTP_HOST', 'SMTP_USUARIO', 'SMTP_SENHA', 'SMTP_REMETENTE'])(
    'sem %s → 503 com o nome da variável, sem ler nem enviar',
    async (nome) => {
      delete process.env[nome]
      const r = await POST(requisicao())
      expect(r.status).toBe(503)
      expect(await r.json()).toEqual({ error: `${nome} não configurado` })
      expect(createAdminClientMock).not.toHaveBeenCalled()
      nadaEnviado()
    }
  )

  it('previa só exige o segredo: sem SMTP devolve o PNG', async () => {
    for (const k of ['SMTP_HOST', 'SMTP_PORTA', 'SMTP_USUARIO', 'SMTP_SENHA', 'SMTP_REMETENTE']) delete process.env[k]
    const r = await POST(requisicao({ previa: true }))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await r.arrayBuffer()).equals(PNG)).toBe(true)
    expect(createTransportMock).not.toHaveBeenCalled()
    nadaEnviado()
  })
})

describe('corpo', () => {
  it.each([
    ['não é JSON', 'isto não é json'],
    ['vazio', ''],
    ['array', []],
    ['null', null],
    ['previa false', { previa: false }],
    ['previa string', { previa: 'true' }],
    ['somentePara número', { somentePara: 5 }],
  ])('%s → 400, nada lido nem enviado', async (_n, corpo) => {
    const r = await POST(requisicao(typeof corpo === 'string' ? corpo : JSON.stringify(corpo)))
    expect(r.status).toBe(400)
    expect(createAdminClientMock).not.toHaveBeenCalled()
    nadaEnviado()
  })

  it('somentePara fora da lista → 400, nada enviado', async () => {
    const r = await POST(requisicao({ somentePara: 'alguem@fora.com' }))
    expect(r.status).toBe(400)
    nadaEnviado()
  })
})

describe('falha fechado — ninguém recebe', () => {
  it('leitura do painel falha → 500 com a tabela no detalhe', async () => {
    respostas.obras_diario = { data: null, error: { message: 'timeout' } }
    const r = await POST(requisicao())
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'leitura', detalhe: 'obras_diario: timeout' })
    nadaEnviado()
  })

  it.each(['hub_system_access', 'hub_user_roles'])('leitura de %s falha → 500', async (tabela) => {
    respostas[tabela] = { data: null, error: { message: 'permissão negada' } }
    const r = await POST(requisicao())
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'leitura', detalhe: `${tabela}: permissão negada` })
    nadaEnviado()
  })

  it('createAdminClient lança → 500', async () => {
    createAdminClientMock.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente')
    })
    const r = await POST(requisicao())
    expect(r.status).toBe(500)
    nadaEnviado()
  })

  it('lista vazia (inclusive has_access diferente de true) → 500', async () => {
    respostas.hub_system_access = { data: [{ user_email: 'x@manfac.com.br', has_access: null }], error: null }
    respostas.hub_user_roles = { data: [{ user_email: '  ' }], error: null }
    const r = await POST(requisicao())
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'sem destinatários' })
    nadaEnviado()
  })

  it('imagem lança → 500, nada enviado', async () => {
    imagemFalha = new Error('resvg quebrou')
    const r = await POST(requisicao())
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'imagem', detalhe: 'resvg quebrou' })
    nadaEnviado()
  })
})

describe('envio', () => {
  it('consulta destinatários com slug obras, has_access = true e nivel administrador', async () => {
    await POST(requisicao())
    const de = (t: string) => chamadas.filter((c) => c.tabela === t && c.metodo === 'eq').map((c) => c.args)
    expect(de('hub_system_access')).toEqual([
      ['system_slug', 'obras'],
      ['has_access', true],
    ])
    expect(de('hub_user_roles')).toEqual([['nivel', 'administrador']])
  })

  it('sucesso: um e-mail por destinatário, um endereço em cada, imagem inline por cid', async () => {
    const r = await POST(requisicao())
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ status: 'enviado', enviados: 3, falhas: [] })

    expect(createTransportMock).toHaveBeenCalledTimes(1)
    expect(createTransportMock.mock.calls[0][0]).toEqual({
      host: 'smtp.exemplo.test',
      port: 465,
      secure: true,
      requireTLS: false,
      auth: { user: 'manfac@exemplo.test', pass: SENHA },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    })

    expect(sendMailMock.mock.calls.map((c) => c[0].to)).toEqual([
      'admin@manfac.com.br',
      'ana@manfac.com.br',
      'bruno@manfac.com.br',
    ])
    const m = sendMailMock.mock.calls[0][0]
    expect(m.cc).toBeUndefined()
    expect(m.bcc).toBeUndefined()
    expect(m.from).toBe('"Manfac" <manfac@exemplo.test>')
    expect(m.subject).toMatch(/^Gestão de Obras — Painel gerencial de \d{2}\/\d{2}\/\d{4}$/)
    expect(m.html).toContain(`cid:${CID_IMAGEM}`)
    expect(m.text).toContain('Carteira: R$')
    expect(m.attachments).toEqual([
      expect.objectContaining({ cid: CID_IMAGEM, contentType: 'image/png', contentDisposition: 'inline', content: PNG }),
    ])
    expect(m.attachments[0].filename).toMatch(/^painel-gerencial-\d{4}-\d{2}-\d{2}\.png$/)
  })

  it('SMTP_PORTA ausente → 465; outra porta → STARTTLS obrigatório', async () => {
    delete process.env.SMTP_PORTA
    await POST(requisicao())
    expect(createTransportMock.mock.calls[0][0]).toMatchObject({ port: 465, secure: true, requireTLS: false })

    process.env.SMTP_PORTA = '587'
    await POST(requisicao())
    expect(createTransportMock.mock.calls[1][0]).toMatchObject({ port: 587, secure: false, requireTLS: true })
  })

  it('somentePara (maiúsculas e espaços) → 1 envio só para ele', async () => {
    const r = await POST(requisicao({ somentePara: '  BRUNO@manfac.com.br ' }))
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ status: 'enviado', enviados: 1, falhas: [] })
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock.mock.calls[0][0].to).toBe('bruno@manfac.com.br')
  })

  it('previa ignora somentePara e não envia', async () => {
    const r = await POST(requisicao({ previa: true, somentePara: 'alguem@fora.com' }))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('image/png')
    nadaEnviado()
  })

  it('falha no meio: os outros saem, 502 só com o código do erro, sem retry', async () => {
    const erroSmtp = Object.assign(new Error(`Invalid login: 535 ${SENHA} mensagem crua do servidor`), {
      code: 'EAUTH',
      responseCode: 535,
    })
    sendMailMock.mockResolvedValueOnce({}).mockRejectedValueOnce(erroSmtp).mockResolvedValueOnce({})
    const r = await POST(requisicao())
    expect(r.status).toBe(502)
    const corpo = await r.json()
    expect(corpo).toEqual({ status: 'parcial', enviados: 2, falhas: [{ para: 'ana@manfac.com.br', erro: 'EAUTH 535' }] })
    expect(sendMailMock).toHaveBeenCalledTimes(3)
    const logado = consoleError.mock.calls.flat().map(String).join('\n')
    expect(logado).toContain('[relatorio-diario]')
    expect(logado).not.toContain('mensagem crua')
  })
})
