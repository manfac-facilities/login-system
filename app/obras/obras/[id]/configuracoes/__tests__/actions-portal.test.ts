/**
 * @jest-environment node
 *
 * Página do cliente, lado Manfac (Leva 5): acesso só administrador, e-mail da
 * Manfac recusado, documentos para engenheiro/admin, nome saneado, objeto do
 * bucket removido junto com a linha, resposta com autor 'manfac'.
 */
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
let db: Record<string, Linha[]>
let erroInsert: { message: string; code?: string } | null
let erroRemove: { message: string } | null
let removeVazio = false
const emails: { para: string[]; assunto: string; html: string; texto: string }[] = []
let envioFalha = false
const removidos: string[][] = []
const assinadas: [string, number][] = []
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op = 'select'
  let payload: Linha = {}
  const executar = (unico: boolean) => {
    const linhas = (db[tabela] ??= [])
    if (op === 'insert') {
      if (erroInsert) return { data: null, error: erroInsert }
      const nova = { id: `id${++seq}`, ...payload }
      linhas.push(nova)
      return { data: unico ? nova : [nova], error: null }
    }
    const alvo = linhas.filter((l) => filtros.every((f) => f(l)))
    if (op === 'delete') {
      db[tabela] = linhas.filter((l) => !alvo.includes(l))
      return { data: null, error: null }
    }
    if (op === 'update') alvo.forEach((l) => Object.assign(l, payload))
    return { data: unico ? (alvo[0] ?? null) : alvo, error: null }
  }
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
    delete: () => ((op = 'delete'), q),
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    maybeSingle: async () => executar(true),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar(false)).then(ok, ko),
  }
  return q
}

const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: (t: string) => construtor(t),
    storage: {
      from: () => ({
        remove: async (p: string[]) => (removidos.push(p), { data: erroRemove || removeVazio ? [] : p.map((name) => ({ name })), error: erroRemove }),
        createSignedUrl: async (p: string, s: number) => (assinadas.push([p, s]), { data: { signedUrl: `https://x.test/${p}` }, error: null }),
      }),
    },
  })),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (t: string) => construtor(t) }) }))
jest.mock('../../../_lib/enviar', () => ({
  enviarEmail: jest.fn(async (m: { para: string[]; assunto: string; html: string; texto: string }) => {
    if (envioFalha) throw new Error('smtp')
    emails.push(m)
    return { ok: true, aceitos: m.para, falhas: [] }
  }),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import { isAdmin } from '@/lib/auth/roles'
import {
  adicionarAcessoAction,
  alternarAcessoAction,
  apagarDocumentoAction,
  registrarDocumentoAction,
  removerAcessoAction,
  trazerDestinatariosClienteAction,
  urlDocumentoAction,
} from '../_actions-portal'
import { responderMensagemAction } from '../../comunicacao/_mensagens'

const OBRA = '11111111-1111-4111-8111-111111111111'
const UUID = '22222222-2222-4222-8222-222222222222'
const UUID_HEX = 'abcdefab-2222-4222-8222-abcdefabcdef'
const PATH = `${OBRA}/${UUID}-laudo.pdf`
const entrada = (over: Record<string, unknown> = {}) => ({ pasta: 'laudos', nome: 'laudo.pdf', tamanho: 1000, tipo: 'application/pdf', path: PATH, ...over })

function como(email: string | null, admin: boolean) {
  getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } })
  ;(isAdmin as jest.Mock).mockResolvedValue(admin)
}

beforeEach(() => {
  db = { obras_obra: [{ id: OBRA, engenheiro_email: 'eng@manfac.com.br' }] }
  erroInsert = null
  erroRemove = null
  removeVazio = false
  envioFalha = false
  emails.length = 0
  process.env.NEXT_PUBLIC_SITE_URL = 'https://hub.exemplo.test'
  removidos.length = 0
  assinadas.length = 0
  jest.clearAllMocks()
})

describe('acesso à página do cliente', () => {
  it('só administrador (engenheiro e anônimo falham)', async () => {
    como('eng@manfac.com.br', false)
    expect(await adicionarAcessoAction(OBRA, { email: 'ana@cliente.com' })).toMatchObject({ ok: false })
    expect(await alternarAcessoAction(OBRA, 'a', false)).toMatchObject({ ok: false })
    expect(await removerAcessoAction(OBRA, 'a')).toMatchObject({ ok: false })
    expect(await trazerDestinatariosClienteAction(OBRA)).toMatchObject({ ok: false })
    como(null, false)
    expect(await adicionarAcessoAction(OBRA, { email: 'ana@cliente.com' })).toMatchObject({ ok: false })
    expect(db.obras_portal_acesso ?? []).toHaveLength(0)
  })

  it('admin adiciona com e-mail normalizado; ativar/desativar/remover', async () => {
    como('adm@manfac.com.br', true)
    expect(await adicionarAcessoAction(OBRA, { email: '  Ana@Cliente.COM ', nome: ' Ana ' })).toEqual({ ok: true })
    expect(db.obras_portal_acesso[0]).toMatchObject({ obra_id: OBRA, email: 'ana@cliente.com', nome: 'Ana', ativo: true })
    const id = db.obras_portal_acesso[0].id
    expect(await alternarAcessoAction(OBRA, id, false)).toEqual({ ok: true })
    expect(db.obras_portal_acesso[0].ativo).toBe(false)
    expect(await removerAcessoAction(OBRA, id)).toEqual({ ok: true })
    expect(db.obras_portal_acesso).toHaveLength(0)
  })

  it('recusa e-mail da Manfac com mensagem clara (inclui subdomínio e ponto final)', async () => {
    como('adm@manfac.com.br', true)
    for (const e of ['x@manfac.com.br', 'X@MANFAC.COM.BR', 'x@ti.manfac.com.br', 'x@manfac.com.br.']) {
      const r = await adicionarAcessoAction(OBRA, { email: e })
      expect(r).toMatchObject({ ok: false })
      expect((r as { erro: string }).erro).toMatch(/Manfac/)
    }
    expect(await adicionarAcessoAction(OBRA, { email: 'sem-arroba' })).toMatchObject({ ok: false, erro: 'E-mail inválido' })
    expect(db.obras_portal_acesso ?? []).toHaveLength(0)
  })

  it('trazer destinatários do cliente: só ativos do lado cliente, sem Manfac e sem duplicar', async () => {
    como('adm@manfac.com.br', true)
    db.obras_destinatario = [
      { obra_id: OBRA, email: 'a@cli.com', nome: 'A', lado: 'cliente', ativo: true },
      { obra_id: OBRA, email: 'b@cli.com', nome: 'B', lado: 'cliente', ativo: false },
      { obra_id: OBRA, email: 'c@manfac.com.br', nome: 'C', lado: 'cliente', ativo: true },
      { obra_id: OBRA, email: 'd@cli.com', nome: 'D', lado: 'interno', ativo: true },
      { obra_id: OBRA, email: 'e@cli.com', nome: 'E', lado: 'cliente', ativo: true },
    ]
    db.obras_portal_acesso = [{ id: 'x', obra_id: OBRA, email: 'e@cli.com' }]
    expect(await trazerDestinatariosClienteAction(OBRA)).toEqual({ ok: true, adicionados: 1 })
    expect(db.obras_portal_acesso.map((a) => a.email).sort()).toEqual(['a@cli.com', 'e@cli.com'])
  })
})

describe('documentos', () => {
  it('engenheiro da obra e admin registram; outro usuário e anônimo não', async () => {
    como('eng@manfac.com.br', false)
    expect(await registrarDocumentoAction(OBRA, entrada())).toEqual({ ok: true })
    como('adm@manfac.com.br', true)
    expect(await registrarDocumentoAction(OBRA, entrada({ path: `${OBRA}/${UUID.replace('2', '3')}-b.pdf` }))).toEqual({ ok: true })
    como('outro@manfac.com.br', false)
    expect(await registrarDocumentoAction(OBRA, entrada())).toMatchObject({ ok: false })
    como(null, false)
    expect(await registrarDocumentoAction(OBRA, entrada())).toMatchObject({ ok: false })
    expect(db.obras_documento).toHaveLength(2)
  })

  it('nome saneado, pasta e tipo conferidos; recusa remove o objeto já subido', async () => {
    como('eng@manfac.com.br', false)
    await registrarDocumentoAction(OBRA, entrada({ nome: 'Projeto Elétrico (2).pdf' }))
    expect(db.obras_documento[0].nome).toBe('Projeto_Eletrico_2_.pdf')
    const outro = (n: number) => `${OBRA}/${UUID.replace(/2/g, String(n))}-b.pdf`
    expect(await registrarDocumentoAction(OBRA, entrada({ pasta: 'fotos', path: outro(3) }))).toMatchObject({ ok: false })
    expect(await registrarDocumentoAction(OBRA, entrada({ nome: 'x.exe', path: outro(4) }))).toMatchObject({ ok: false })
    expect(await registrarDocumentoAction(OBRA, entrada({ tamanho: 26 * 1024 * 1024, path: outro(5) }))).toMatchObject({ ok: false })
    expect(removidos).toEqual([[outro(3)], [outro(4)], [outro(5)]])
    expect(await registrarDocumentoAction(OBRA, entrada({ path: `outra/${UUID}-a.pdf` }))).toMatchObject({ ok: false })
    expect(db.obras_documento).toHaveLength(1)
  })

  it('falha ao gravar a linha remove o objeto do bucket', async () => {
    como('eng@manfac.com.br', false)
    erroInsert = { message: 'x', code: '42501' }
    expect(await registrarDocumentoAction(OBRA, entrada())).toMatchObject({ ok: false })
    expect(removidos).toEqual([[PATH]])
  })

  it('apagar remove o objeto do storage E a linha; objeto que não sai mantém a linha', async () => {
    como('eng@manfac.com.br', false)
    db.obras_documento = [{ id: 'd1', obra_id: OBRA, path: PATH }]
    erroRemove = { message: 'falhou' }
    expect(await apagarDocumentoAction(OBRA, 'd1')).toMatchObject({ ok: false })
    expect(db.obras_documento).toHaveLength(1)
    erroRemove = null
    expect(await apagarDocumentoAction(OBRA, 'd1')).toEqual({ ok: true })
    expect(removidos.at(-1)).toEqual([PATH])
    expect(db.obras_documento).toHaveLength(0)
    expect(await apagarDocumentoAction(OBRA, 'd1')).toMatchObject({ ok: false })
  })

  it('path repetido (23505) NUNCA apaga o objeto do documento já registrado', async () => {
    como('eng@manfac.com.br', false)
    db.obras_documento = [{ id: 'd0', obra_id: OBRA, path: PATH, nome: 'laudo.pdf' }]
    erroInsert = { message: 'duplicate', code: '23505' }
    expect(await registrarDocumentoAction(OBRA, entrada())).toMatchObject({ ok: false })
    expect(removidos).toHaveLength(0)
    // mesmo recusa por validação, com path já registrado: o objeto fica
    expect(await registrarDocumentoAction(OBRA, entrada({ pasta: 'fotos' }))).toMatchObject({ ok: false })
    expect(removidos).toHaveLength(0)
  })

  it('path em maiúsculas ou com extensão fora da lista no arquivo guardado é recusado', async () => {
    como('eng@manfac.com.br', false)
    expect(await registrarDocumentoAction(OBRA, entrada({ path: `${OBRA}/${UUID_HEX.toUpperCase()}-a.pdf` }))).toMatchObject({ ok: false })
    expect(await registrarDocumentoAction(OBRA, entrada({ path: `${OBRA}/${UUID}-x.html` }))).toMatchObject({ ok: false })
    expect(db.obras_documento ?? []).toHaveLength(0)
  })

  it('remove() que não remove nada é erro explícito e mantém a linha', async () => {
    como('eng@manfac.com.br', false)
    db.obras_documento = [{ id: 'd1', obra_id: OBRA, path: PATH }]
    removeVazio = true
    const r = await apagarDocumentoAction(OBRA, 'd1')
    expect(r).toMatchObject({ ok: false })
    expect((r as { erro: string }).erro).toMatch(/não foi encontrado/)
    expect(db.obras_documento).toHaveLength(1)
  })

  it('apagar é só engenheiro/admin; documento de outra obra não é achado', async () => {
    db.obras_documento = [{ id: 'd1', obra_id: 'outra', path: 'outra/x' }]
    como('outro@manfac.com.br', false)
    expect(await apagarDocumentoAction(OBRA, 'd1')).toMatchObject({ ok: false })
    como('adm@manfac.com.br', true)
    expect(await apagarDocumentoAction(OBRA, 'd1')).toMatchObject({ ok: false, erro: 'Documento não encontrado' })
    expect(removidos).toHaveLength(0)
  })

  it('download: URL assinada curta (60 s)', async () => {
    como('qualquer@manfac.com.br', false)
    db.obras_documento = [{ id: 'd1', obra_id: OBRA, path: PATH, nome: 'laudo.pdf' }]
    const r = await urlDocumentoAction(OBRA, 'd1')
    expect(r).toMatchObject({ ok: true })
    expect(assinadas).toEqual([[PATH, 60]])
  })
})

describe('resposta ao cliente', () => {
  it('grava autor_tipo manfac com o e-mail da sessão; texto como veio (sem interpretar HTML)', async () => {
    como('eng@manfac.com.br', false)
    expect(await responderMensagemAction(OBRA, '  Olá <b>cliente</b>  ')).toEqual({ ok: true })
    expect(db.obras_mensagem[0]).toMatchObject({ obra_id: OBRA, autor_tipo: 'manfac', autor_email: 'eng@manfac.com.br', texto: 'Olá <b>cliente</b>' })
  })
  it('avisa por e-mail só os acessos ATIVOS, sem o texto da mensagem, com o link', async () => {
    como('eng@manfac.com.br', false)
    db.obras_obra = [{ id: OBRA, engenheiro_email: 'eng@manfac.com.br', loja: 'DP Macaé 3' }]
    db.obras_portal_acesso = [
      { obra_id: OBRA, email: 'a@cli.com', ativo: true },
      { obra_id: OBRA, email: 'b@cli.com', ativo: false },
      { obra_id: 'outra', email: 'c@cli.com', ativo: true },
    ]
    expect(await responderMensagemAction(OBRA, 'segredo da resposta')).toEqual({ ok: true })
    expect(emails).toHaveLength(1)
    expect(emails[0].para).toEqual(['a@cli.com'])
    expect(emails[0].assunto).toBe('Nova mensagem da Manfac sobre DP Macaé 3')
    expect(emails[0].html + emails[0].texto).toContain('https://hub.exemplo.test/portal-obra')
    expect(emails[0].html + emails[0].texto).not.toContain('segredo da resposta')
  })

  it('falha no envio (ou sem acesso ativo, ou sem base de URL) não derruba a resposta', async () => {
    como('eng@manfac.com.br', false)
    db.obras_portal_acesso = [{ obra_id: OBRA, email: 'a@cli.com', ativo: true }]
    envioFalha = true
    expect(await responderMensagemAction(OBRA, 'oi')).toEqual({ ok: true })
    envioFalha = false
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(await responderMensagemAction(OBRA, 'oi 2')).toEqual({ ok: true })
    expect(emails).toHaveLength(0)
    expect(db.obras_mensagem).toHaveLength(2)
  })

  it('admin responde; outro usuário, anônimo, vazio e longo demais não', async () => {
    como('adm@manfac.com.br', true)
    expect(await responderMensagemAction(OBRA, 'ok')).toEqual({ ok: true })
    expect(await responderMensagemAction(OBRA, '   ')).toMatchObject({ ok: false })
    expect(await responderMensagemAction(OBRA, 'a'.repeat(4001))).toMatchObject({ ok: false })
    como('outro@manfac.com.br', false)
    expect(await responderMensagemAction(OBRA, 'oi')).toMatchObject({ ok: false })
    como(null, false)
    expect(await responderMensagemAction(OBRA, 'oi')).toMatchObject({ ok: false })
    expect(db.obras_mensagem).toHaveLength(1)
  })
})
