/**
 * @jest-environment node
 *
 * Actions do analista (Leva 5 §7, Task 6): só engenheiro/admin (falha
 * fechada); a pergunta gravada é a recalculada no servidor; ponto de dado
 * oculto grava como interno; publicar valida estritamente e grava uma linha
 * nova (versão nova); montar sem chave → rascunho simples sem resposta interna.
 */
import { imp, obraGrandePdf } from '../../_pdf/__tests__/fixtures/rdo'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
let db: Record<string, Linha[]>
const escritas: { tabela: string; op: string; payload: Linha; opcoes?: unknown }[] = []

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  const exec = () => ({ data: (db[tabela] ?? []).filter((l) => filtros.every((f) => f(l))), error: null })
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    order: () => q,
    maybeSingle: async () => ({ data: exec().data[0] ?? null, error: null }),
    upsert: async (p: Linha, opcoes: unknown) => (escritas.push({ tabela, op: 'upsert', payload: p, opcoes }), { error: null }),
    insert: async (p: Linha) => (escritas.push({ tabela, op: 'insert', payload: p }), { error: null }),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(exec()).then(ok, ko),
  }
  return q
}

const getUserMock = jest.fn()
const lerObraGrandeMock = jest.fn()
const createMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t) })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async () => true) }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async () => false) }))
jest.mock('../../_lib/leitura', () => ({
  ...jest.requireActual('../../_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a),
}))
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ responses: { create: (...a: unknown[]) => createMock(...a) } })),
}))

import { montarSituacaoAction, publicarSituacaoAction, responderPerguntaAction } from '../_analista-actions'

const OBRA = '00000000-0000-4000-8000-0000000000a1'
const ORIGINAL = process.env.OPENAI_API_KEY

function obra() {
  const og = obraGrandePdf()
  og.obra = { ...og.obra, id: OBRA }
  og.calc = { ...og.calc!, desvioPP: -6, realizado: 0.52, previsto: 0.58 }
  og.impedimentos = [imp({ id: 'oc', responsavel: 'manfac', descricao: 'Pedreiro faltou', exibirAoCliente: false, abertoEm: '2020-01-02', travaAtividade: false })]
  return og
}

beforeEach(() => {
  escritas.length = 0
  createMock.mockReset()
  delete process.env.OPENAI_API_KEY
  getUserMock.mockResolvedValue({ data: { user: { email: 'eng@manfac.com.br' } } })
  lerObraGrandeMock.mockResolvedValue({ ok: true, dados: obra() })
  db = {
    obras_obra: [{ id: OBRA, modalidade: 'obra', engenheiro_email: 'eng@manfac.com.br' }],
    obras_restricao: [],
    obras_plano_semana: [],
    obras_situacao_pergunta: [],
    obras_situacao_cliente: [],
  }
})
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = ORIGINAL
})

describe('responderPerguntaAction', () => {
  it('quem não é engenheiro da obra nem admin: recusado, nada gravado', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'outro@manfac.com.br' } } })
    const r = await responderPerguntaAction(OBRA, 'desvio:obra', 'x', false)
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/engenheiro responsável/) })
    expect(escritas).toEqual([])
  })

  it('grava a pergunta recalculada no servidor, com a impressão no contexto', async () => {
    const r = await responderPerguntaAction(OBRA, 'desvio:obra', '  Reforçamos a equipe.  ', false)
    expect(r).toEqual({ ok: true })
    expect(escritas).toEqual([
      {
        tabela: 'obras_situacao_pergunta',
        op: 'upsert',
        opcoes: { onConflict: 'obra_id,chave' },
        payload: expect.objectContaining({
          obra_id: OBRA, chave: 'desvio:obra', resposta: 'Reforçamos a equipe.', interno: false, aberta: false,
          pergunta: expect.stringContaining('52%'), contexto: expect.objectContaining({ impressao: '-6' }),
        }),
      },
    ])
  })

  it('ponto de dado oculto ao cliente grava sempre como interno', async () => {
    await responderPerguntaAction(OBRA, 'impedimento:oc', 'Conversado com a equipe', false)
    expect(escritas[0].payload).toMatchObject({ chave: 'impedimento:oc', interno: true })
  })

  it('chave que não é ponto atual: recusada', async () => {
    const r = await responderPerguntaAction(OBRA, 'execucao:999', 'x', false)
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/não está mais aberta/) })
    expect(escritas).toEqual([])
  })
})

describe('montarSituacaoAction', () => {
  it('sem chave: rascunho simples só com as respostas não internas', async () => {
    db.obras_situacao_pergunta = [
      { obra_id: OBRA, chave: 'desvio:obra', resposta: 'Reforçamos a equipe.', interno: false, aberta: false, contexto: { impressao: '-6' } },
      { obra_id: OBRA, chave: 'impedimento:oc', resposta: 'Pedreiro faltou de novo', interno: true, aberta: false, contexto: { impressao: '2020-01-02' } },
    ]
    const r = await montarSituacaoAction(OBRA)
    expect(r).toMatchObject({ ok: true, origem: 'simples' })
    if (r.ok) {
      expect(r.situacao.explicacao).toContain('Reforçamos a equipe.')
      expect(r.situacao.explicacao).not.toContain('Pedreiro')
    }
    expect(createMock).not.toHaveBeenCalled()
    expect(escritas).toEqual([])
  })

  it('com chave: o prompt não leva resposta interna', async () => {
    process.env.OPENAI_API_KEY = 'sk-teste'
    db.obras_situacao_pergunta = [
      { obra_id: OBRA, chave: 'desvio:obra', resposta: 'Segredo do setor de compras', interno: true, aberta: false, contexto: { impressao: '-6' } },
    ]
    createMock.mockResolvedValue({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"explicacao":"Texto.","acoes":[]}' }] }] })
    await montarSituacaoAction(OBRA)
    expect(createMock.mock.calls[0][0].input).not.toContain('setor de compras')
  })
})

describe('publicarSituacaoAction', () => {
  it('valida e grava uma versão nova com o retrato dos números; linha vazia de ação some', async () => {
    db.obras_situacao_cliente = [
      { obra_id: OBRA, versao: 2, explicacao: 'Antiga.', acoes: [], numeros: {}, publicada_por: 'eng@manfac.com.br', publicada_em: '2026-11-01T12:00:00Z' },
    ]
    const r = await publicarSituacaoAction(OBRA, {
      explicacao: ' O atraso é de responsabilidade da Manfac. ',
      acoes: [{ oque: 'Segunda equipe', quando: 'desde 23/11', efeito: '' }, { oque: '', quando: '', efeito: '' }],
    })
    expect(r).toEqual({ ok: true })
    expect(escritas).toEqual([
      {
        tabela: 'obras_situacao_cliente',
        op: 'insert',
        payload: {
          obra_id: OBRA, versao: 3, explicacao: 'O atraso é de responsabilidade da Manfac.',
          acoes: [{ oque: 'Segunda equipe', quando: 'desde 23/11', efeito: '' }],
          numeros: { atraso: { cliente: 0, manfac: 0, terceiro: 0, clima: 0 }, desvioPP: -6, terminoProjetado: '2027-02-12' },
        },
      },
    ])
  })

  it('autoria e versão do navegador não vão para o banco (o trigger força)', async () => {
    await publicarSituacaoAction(OBRA, { explicacao: 'Texto.', acoes: [], publicada_por: 'forjado@x', versao: 99 })
    expect(escritas[0].payload).not.toHaveProperty('publicada_por')
    expect(escritas[0].payload.versao).toBe(1)
  })

  it.each([
    ['R$', { explicacao: 'Custou R$ 2 mil.', acoes: [] }],
    ['6 ações', { explicacao: 'x', acoes: Array.from({ length: 6 }, () => ({ oque: 'a', quando: '', efeito: '' })) }],
    ['ação com campo extra', { explicacao: 'x', acoes: [{ oque: 'a', quando: '', efeito: '', area: 'compras' }] }],
    ['não objeto', 'texto'],
  ])('recusa entrada inválida (%s) sem gravar', async (_n, entrada) => {
    const r = await publicarSituacaoAction(OBRA, entrada)
    expect(r.ok).toBe(false)
    expect(escritas).toEqual([])
  })
})
