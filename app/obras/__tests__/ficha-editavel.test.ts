/**
 * Testes das Server Actions da ficha editável — spec §7.2 de
 * docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ficha-editavel-2026-09-18.md
 *
 * Padrão do módulo (`app/obras/__tests__/ficha.test.ts`): Supabase,
 * `next/cache` e `lib/auth/systemAccess` mockados. **Nunca banco real** — as
 * duas migrations de que estas actions dependem (`sdd-sql-obras-historico.sql`
 * e `sdd-sql-obras-motivos-remarcacao.sql`) ainda não foram aplicadas.
 *
 * `app/obras/_lib/historico.ts` NÃO é mockado de propósito: `gravarComHistorico`
 * tem uma trava que lança quando `p_campos` traz uma coluna rastreada sem a
 * linha de histórico correspondente. Deixá-la rodar de verdade é o que prova
 * que cada action monta `campos` e `linhas` coerentes entre si.
 */

const getUserMock = jest.fn()
const rpcMock = jest.fn()
const updateMock = jest.fn()
const eqUpdateMock = jest.fn()
const lerMotivosMock = jest.fn()
const insertMotivoMock = jest.fn()

let obraAtual: Record<string, unknown> | null = null
let erroLeituraObra: unknown = null

const fromMock = jest.fn((tabela: string) => {
  if (tabela === 'obras_obra') {
    const alvo: Record<string, unknown> = {}
    alvo.select = jest.fn(() => alvo)
    alvo.eq = jest.fn(() => alvo)
    alvo.maybeSingle = jest.fn(async () => ({ data: obraAtual, error: erroLeituraObra }))
    alvo.update = updateMock
    return alvo
  }
  if (tabela === 'obras_motivo_remarcacao') {
    const alvo: Record<string, unknown> = {}
    alvo.select = jest.fn(() => alvo)
    alvo.eq = jest.fn(() => alvo)
    alvo.order = jest.fn(() => alvo)
    alvo.then = (r: (v: unknown) => unknown) => lerMotivosMock().then(r)
    alvo.insert = insertMotivoMock
    return alvo
  }
  throw new Error(`tabela inesperada no mock: ${tabela}`)
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))

import { revalidatePath } from 'next/cache'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { hojeISO } from '../_lib/tipos'
import {
  salvarAutorizacaoAction,
  salvarIdentificacaoAction,
  salvarCronogramaAction,
  salvarDadosTriagemAction,
  cadastrarMotivoRemarcacaoAction,
  liberarObraAction,
} from '../obra/[id]/_actions'

const HOJE = hojeISO()
const EMAIL = 'yuri@manfac.com.br'

/** Obra "em branco": tudo que a ficha grava nasce `null`, então tudo muda. */
function obra(over: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    os: 'OS-900',
    loja: 'Loja 12',
    descricao: 'Troca de piso',
    origem: null,
    liberado_por: null,
    liberado_em: null,
    aprovacao: null,
    os_aprovada: false,
    marco_os_aprov: null,
    tipo: null,
    valor: null,
    analista_cliente: null,
    mau_uso: false,
    pcm: null,
    equipe: null,
    prioridade: null,
    inicio_plan: null,
    duracao: null,
    etapa: 'levantamento',
    ...over,
  }
}

const AUT_VAZIA = { origem: '', libPor: '', libEm: '', aprovadaEm: '' }
const IDENT_VAZIA = { tipo: '', valor: '', analista: '', mauUso: false }
const CRONO_VAZIO = { resp: '', equipe: '', prioridade: '', inicio: '', duracao: '' }
const TRIAGEM_VAZIA = { ...AUT_VAZIA, tipo: '', valor: '', analista: '' }

/** O que foi para `p_campos` da última chamada de RPC. */
function campos(): Record<string, unknown> {
  const chamada = rpcMock.mock.calls.at(-1)
  return (chamada?.[1] as { p_campos: Record<string, unknown> }).p_campos
}

function argumentos(): Record<string, unknown> {
  return rpcMock.mock.calls.at(-1)?.[1] as Record<string, unknown>
}

function nomeDaRpc(): string {
  return rpcMock.mock.calls.at(-1)?.[0] as string
}

/** `update(...).eq(...).eq(...).select(...)` de `liberarObraAction`. */
function encadearUpdate(resultado: { error: unknown; data?: unknown } = { error: null }) {
  const final = { ...resultado, data: 'data' in resultado ? resultado.data : [{ id: 'o1' }] }
  const alvo: Record<string, unknown> = { ...final }
  alvo.eq = eqUpdateMock.mockReturnValue(alvo)
  alvo.select = jest.fn(() => alvo)
  alvo.then = (r: (v: unknown) => unknown) => Promise.resolve(final).then(r)
  updateMock.mockReturnValue(alvo)
}

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: EMAIL } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  obraAtual = obra()
  erroLeituraObra = null
  rpcMock.mockResolvedValue({ data: obra(), error: null })
  lerMotivosMock.mockResolvedValue({ data: [], error: null })
  insertMotivoMock.mockReturnValue({
    select: jest.fn(() => ({
      single: jest.fn(async () => ({ data: { id: 'm-novo', nome: 'Greve' }, error: null })),
    })),
  })
  encadearUpdate()
})

// ============================================================
// R1 — a autorização é do servidor, e falha FECHADO
// ============================================================

const TODAS = [
  ['salvarAutorizacaoAction', () => salvarAutorizacaoAction('o1', AUT_VAZIA)],
  ['salvarIdentificacaoAction', () => salvarIdentificacaoAction('o1', IDENT_VAZIA)],
  ['salvarCronogramaAction', () => salvarCronogramaAction('o1', CRONO_VAZIO)],
  ['salvarDadosTriagemAction', () => salvarDadosTriagemAction('o1', TRIAGEM_VAZIA)],
  ['cadastrarMotivoRemarcacaoAction', () => cadastrarMotivoRemarcacaoAction('Greve')],
] as const

describe('R1 — toda action confere acesso no servidor antes de escrever', () => {
  it.each(TODAS)('%s recusa quem não tem acesso, sem tocar no banco', async (_nome, chamar) => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await chamar()
    expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it.each(TODAS)('%s recusa usuário sem e-mail', async (_nome, chamar) => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: null } } })
    const r = await chamar()
    expect(r).toEqual({ error: 'Não autenticado' })
    expect(rpcMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  // A armadilha do AGENTS.md, na versão JavaScript. Em PL/pgSQL `if not f()`
  // não dispara com NULL; em JS `!x` é falsy-based e fecha com null/undefined —
  // MAS abre para qualquer valor truthy que não seja `true`. Uma resposta
  // {has_access:false} vinda de uma refatoração de `hasSystemAccess` passaria
  // por `!x` e liberaria a escrita. `!== true` é o que nega tudo que não é
  // exatamente a permissão.
  const AMBIGUOS: [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['o objeto truthy { has_access: false }', { has_access: false }],
    ['a string "false"', 'false'],
  ]

  for (const [rotulo, resposta] of AMBIGUOS) {
    it.each(TODAS)(
      `%s falha FECHADO quando hasSystemAccess devolve ${rotulo}`,
      async (_nome, chamar) => {
        ;(hasSystemAccess as jest.Mock).mockResolvedValue(resposta)
        const r = await chamar()
        expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
        expect(rpcMock).not.toHaveBeenCalled()
        expect(fromMock).not.toHaveBeenCalled()
        expect(updateMock).not.toHaveBeenCalled()
      }
    )
  }
})

describe('R2 — erro do banco vira mensagem, nunca exceção', () => {
  it('salvarAutorizacaoAction devolve erro em português quando a RPC falha', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'RLS' } })
    await expect(salvarAutorizacaoAction('o1', { ...AUT_VAZIA, libPor: 'LEANDRO' })).resolves.toEqual(
      { error: 'Erro ao salvar a autorização' }
    )
  })

  it('salvarIdentificacaoAction devolve erro em português quando a RPC falha', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'RLS' } })
    await expect(salvarIdentificacaoAction('o1', { ...IDENT_VAZIA, tipo: 'CIVIL' })).resolves.toEqual(
      { error: 'Erro ao salvar a identificação' }
    )
  })

  it('salvarCronogramaAction devolve erro em português quando a RPC falha', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'RLS' } })
    await expect(
      salvarCronogramaAction('o1', { ...CRONO_VAZIO, prioridade: 'Urgente' })
    ).resolves.toEqual({ error: 'Erro ao salvar o cronograma' })
  })

  it('salvarDadosTriagemAction devolve erro em português quando a RPC falha', async () => {
    obraAtual = obra({ etapa: 'definir' })
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'RLS' } })
    await expect(
      salvarDadosTriagemAction('o1', { ...TRIAGEM_VAZIA, tipo: 'CIVIL' })
    ).resolves.toEqual({ error: 'Erro ao salvar os dados da obra' })
  })

  it('cadastrarMotivoRemarcacaoAction devolve erro em português quando o insert falha', async () => {
    insertMotivoMock.mockReturnValue({
      select: jest.fn(() => ({
        single: jest.fn(async () => ({ data: null, error: { code: '42501', message: 'RLS' } })),
      })),
    })
    await expect(cadastrarMotivoRemarcacaoAction('Greve')).resolves.toEqual({
      error: 'Erro ao cadastrar o motivo',
    })
  })

  it('a obra que não existe não vira exceção', async () => {
    obraAtual = null
    await expect(salvarAutorizacaoAction('o1', AUT_VAZIA)).resolves.toEqual({
      error: 'Obra não encontrada',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

// ============================================================
// 4.1 — salvarAutorizacaoAction
// ============================================================

describe('salvarAutorizacaoAction', () => {
  it('grava origem, liberado_por e liberado_em — e NUNCA os, loja ou descricao (R19)', async () => {
    const r = await salvarAutorizacaoAction('o1', {
      origem: 'WhatsApp',
      libPor: 'LEANDRO',
      libEm: '2026-09-01',
      aprovadaEm: '',
    })
    expect(r).toEqual({ success: true })
    expect(nomeDaRpc()).toBe('obras_aplicar_alteracao')
    expect(campos()).toMatchObject({
      origem: 'WhatsApp',
      liberado_por: 'LEANDRO',
      liberado_em: '2026-09-01',
      atualizacao: HOJE,
    })
    expect(campos()).not.toHaveProperty('os')
    expect(campos()).not.toHaveProperty('loja')
    expect(campos()).not.toHaveProperty('descricao')
  })

  it('R5 — campo limpo vira null, nunca string vazia', async () => {
    obraAtual = obra({ origem: 'Telefone', liberado_por: 'LEANDRO', liberado_em: '2026-08-01' })
    await salvarAutorizacaoAction('o1', AUT_VAZIA)
    expect(campos()).toMatchObject({ origem: null, liberado_por: null, liberado_em: null })
    for (const v of Object.values(campos())) expect(v).not.toBe('')
  })

  it('R8 — data de liberação sem nome é recusada, sem escrever', async () => {
    const r = await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, libEm: '2026-09-01' })
    expect(r).toEqual({
      error: 'Tem data da liberação sem nome. Escolha quem liberou ou apague a data.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('R8 — nome sem data grava hoje (primeira liberação, sem data anterior)', async () => {
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, libPor: 'LEANDRO' })
    expect(campos()).toMatchObject({ liberado_por: 'LEANDRO', liberado_em: HOJE })
  })

  it('item 3 — apagar a data mantendo o nome grava null, nunca hoje', async () => {
    // Antes deste fix: limpar a data com o nome preservado gravava hoje por
    // cima, perdendo o que a pessoa quis apagar e reiniciando o contador de
    // "esperando a OS há N dias" sem como desfazer pela tela.
    obraAtual = obra({ liberado_por: 'LEANDRO', liberado_em: '2026-08-20' })
    const r = await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, libPor: 'LEANDRO', libEm: '' })
    expect(r).toEqual({ success: true })
    // `liberado_por` não muda (continua 'LEANDRO'), então nem entra em
    // `campos` — só o que muda de verdade vira linha de histórico e coluna.
    expect(campos()).toMatchObject({ liberado_em: null })
    expect(campos()).not.toHaveProperty('liberado_por')
  })

  it('bloqueante 21/09 — depois que a data já foi limpa, salvar só a aprovação NÃO re-carimba hoje', async () => {
    // Regressão do item 3: a condição de "primeira liberação" olhava
    // `obra.liberado_em`, não `obra.liberado_por`. Depois que alguém limpa a
    // data (liberado_em fica null, liberado_por continua), o PRÓXIMO
    // salvamento do bloco — aqui, preenchendo só `aprovadaEm` — reavaliava
    // `obra.liberado_em` (null) como "nunca houve liberação" e voltava a
    // gravar hoje por cima, desfazendo a limpeza que a pessoa tinha acabado
    // de fazer.
    obraAtual = obra({ liberado_por: 'LEANDRO', liberado_em: null })
    const r = await salvarAutorizacaoAction('o1', {
      ...AUT_VAZIA,
      libPor: 'LEANDRO',
      libEm: '',
      aprovadaEm: '2026-09-10',
    })
    expect(r).toEqual({ success: true })
    // `liberado_por` e `liberado_em` não mudam — nem entram em `campos`.
    expect(campos()).not.toHaveProperty('liberado_em')
    expect(campos()).not.toHaveProperty('liberado_por')
    expect(campos()).toMatchObject({ aprovacao: '2026-09-10' })
  })

  it('recusa data de liberação no futuro', async () => {
    const r = await salvarAutorizacaoAction('o1', {
      ...AUT_VAZIA,
      libPor: 'LEANDRO',
      libEm: '2099-01-01',
    })
    expect(r).toEqual({ error: 'A data da liberação não pode ser depois de hoje.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('recusa origem fora de ORIGENS, mas PRESERVA o valor antigo fora da lista', async () => {
    expect(await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, origem: 'Pombo-correio' })).toEqual({
      error: 'Origem inválida',
    })
    expect(rpcMock).not.toHaveBeenCalled()

    obraAtual = obra({ origem: 'Pombo-correio' })
    const r = await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, origem: 'Pombo-correio' })
    expect(r).toEqual({ success: true })
  })

  it('R7 — a data de aprovação grava as TRÊS colunas no mesmo objeto', async () => {
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(campos()).toMatchObject({
      aprovacao: '2026-09-10',
      os_aprovada: true,
      marco_os_aprov: '2026-09-10',
    })
  })

  it('R7 — limpar a aprovação grava as três como vazio/false', async () => {
    obraAtual = obra({ aprovacao: '2026-09-10', os_aprovada: true, marco_os_aprov: '2026-09-10' })
    await salvarAutorizacaoAction('o1', AUT_VAZIA)
    expect(campos()).toMatchObject({
      aprovacao: null,
      os_aprovada: false,
      marco_os_aprov: null,
    })
  })

  it('R16 — obra em aprovarOS com aprovação nova avança para fecharOS', async () => {
    obraAtual = obra({ etapa: 'aprovarOS' })
    const r = await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(r).toEqual({ success: true, avancou: true })
    expect(campos()).toMatchObject({
      etapa: 'fecharOS',
      desde_etapa: HOJE,
      etapa_por: EMAIL,
    })
    expect(campos().etapa_em).toEqual(expect.any(String))
    // A mudança de etapa também vira linha de histórico.
    const linhas = argumentos().p_linhas as { campo: string; para: string }[]
    expect(linhas.find((l) => l.campo === 'etapa')).toBeTruthy()
  })

  it('R17 — em qualquer outra etapa, a aprovação NÃO move a obra', async () => {
    obraAtual = obra({ etapa: 'andamento' })
    const r = await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(r).toEqual({ success: true })
    expect(campos()).not.toHaveProperty('etapa')
    expect(campos()).not.toHaveProperty('etapa_por')
  })

  it('R16 — obra em aprovarOS que JÁ TINHA aprovação não avança', async () => {
    obraAtual = obra({ etapa: 'aprovarOS', aprovacao: '2026-09-01', os_aprovada: true, marco_os_aprov: '2026-09-01' })
    const r = await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(r).toEqual({ success: true })
    expect(campos()).not.toHaveProperty('etapa')
  })
})

// ============================================================
// B5 — o auto-avanço da Autorização carimba os marcos da esteira
// (spec-dividas-ficha-2026-09-23 §3)
// ============================================================

describe('salvarAutorizacaoAction — B5: avanço automático carimba os marcos', () => {
  const MARCOS_VAZIOS = {
    marco_exec_fim: null,
    marco_relatorio: null,
    marco_fechou_os: null,
    marco_liberou_fat: null,
    marco_faturou: null,
  }
  type Linha = { bloco: string; campo: string; de: string | null; para: string | null }
  const linhas = () => argumentos().p_linhas as Linha[]

  it('aprovarOS sem marcos: uma RPC com etapa, trio e marcos anteriores; linhas Autorização e depois Esteira', async () => {
    obraAtual = obra({ etapa: 'aprovarOS', ...MARCOS_VAZIOS })
    const r = await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(r).toEqual({ success: true, avancou: true })
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(campos()).toMatchObject({
      etapa: 'fecharOS',
      marco_exec_fim: HOJE,
      marco_relatorio: HOJE,
      aprovacao: '2026-09-10',
      os_aprovada: true,
      marco_os_aprov: '2026-09-10',
    })
    expect(linhas().map((l) => [l.bloco, l.campo])).toEqual([
      ['Autorização', 'os_aprovada_em'],
      ['Autorização', 'etapa'],
      ['Esteira', 'marco_exec_fim'],
      ['Esteira', 'marco_relatorio'],
    ])
  })

  it('marcos já preenchidos nunca são sobrescritos: nenhum marco em p_campos, nenhuma linha Esteira', async () => {
    obraAtual = obra({
      etapa: 'aprovarOS',
      ...MARCOS_VAZIOS,
      marco_exec_fim: '2026-09-01',
      marco_relatorio: '2026-09-05',
    })
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    const marcos = Object.keys(campos()).filter((k) => k.startsWith('marco_') && k !== 'marco_os_aprov')
    expect(marcos).toEqual([])
    expect(linhas().filter((l) => l.bloco === 'Esteira')).toEqual([])
  })

  it('estado incoerente (marco_fechou_os preenchido em aprovarOS) vira null com linha Esteira', async () => {
    obraAtual = obra({
      etapa: 'aprovarOS',
      ...MARCOS_VAZIOS,
      marco_exec_fim: '2026-09-01',
      marco_relatorio: '2026-09-05',
      marco_fechou_os: '2026-09-06',
    })
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(campos()).toMatchObject({ marco_fechou_os: null })
    expect(linhas()).toContainEqual(
      expect.objectContaining({ bloco: 'Esteira', campo: 'marco_fechou_os', de: '06/09/2026', para: null })
    )
  })

  it('sem avanço (obra já aprovada, ou em outra etapa): nenhum marco, nenhuma linha Esteira', async () => {
    obraAtual = obra({
      etapa: 'aprovarOS',
      ...MARCOS_VAZIOS,
      aprovacao: '2026-09-01',
      os_aprovada: true,
      marco_os_aprov: '2026-09-01',
    })
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-02' })
    expect(Object.keys(campos()).filter((k) => k.startsWith('marco_') && k !== 'marco_os_aprov')).toEqual([])
    expect(linhas().filter((l) => l.bloco === 'Esteira')).toEqual([])

    obraAtual = obra({ etapa: 'andamento', ...MARCOS_VAZIOS })
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(Object.keys(campos()).filter((k) => k.startsWith('marco_') && k !== 'marco_os_aprov')).toEqual([])
    expect(linhas().filter((l) => l.bloco === 'Esteira')).toEqual([])
  })

  it('marco_os_aprov continua vindo só pelo trio — nunca como linha própria', async () => {
    obraAtual = obra({ etapa: 'aprovarOS', ...MARCOS_VAZIOS })
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(linhas().find((l) => l.campo === 'marco_os_aprov')).toBeUndefined()
  })
})

// ============================================================
// 4.2 — salvarIdentificacaoAction
// ============================================================

describe('salvarIdentificacaoAction', () => {
  it('converte o valor pt-BR para número', async () => {
    const r = await salvarIdentificacaoAction('o1', {
      tipo: 'CIVIL',
      valor: '18.450,00',
      analista: 'AMANDA',
      mauUso: true,
    })
    expect(r).toEqual({ success: true })
    expect(campos()).toMatchObject({
      tipo: 'CIVIL',
      valor: 18450,
      analista_cliente: 'AMANDA',
      mau_uso: true,
      atualizacao: HOJE,
    })
  })

  it('recusa valor que não é número, sem escrever', async () => {
    const r = await salvarIdentificacaoAction('o1', { ...IDENT_VAZIA, valor: 'uns dezoito mil' })
    expect(r).toEqual({ error: 'Valor precisa ser um número em reais, como 18.450,00.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('recusa tipo fora de TIPOS_OBRA, mas preserva o tipo antigo já gravado', async () => {
    expect(await salvarIdentificacaoAction('o1', { ...IDENT_VAZIA, tipo: 'MARCENARIA' })).toEqual({
      error: 'Tipo inválido',
    })
    obraAtual = obra({ tipo: 'MARCENARIA' })
    expect(await salvarIdentificacaoAction('o1', { ...IDENT_VAZIA, tipo: 'MARCENARIA' })).toEqual({
      success: true,
    })
  })

  it('nunca grava os, loja ou descricao (R19)', async () => {
    await salvarIdentificacaoAction('o1', { ...IDENT_VAZIA, tipo: 'CIVIL' })
    expect(campos()).not.toHaveProperty('os')
    expect(campos()).not.toHaveProperty('loja')
    expect(campos()).not.toHaveProperty('descricao')
  })
})

// ============================================================
// 4.3 — salvarCronogramaAction
// ============================================================

describe('salvarCronogramaAction', () => {
  it('R12 — início igual ao atual grava pela RPC comum, não pela de remarcação', async () => {
    obraAtual = obra({ inicio_plan: '2026-09-08', duracao: 7 })
    const r = await salvarCronogramaAction('o1', {
      resp: 'YURI',
      equipe: 'MANFAC-7',
      prioridade: 'Urgente',
      inicio: '2026-09-08',
      duracao: '10',
    })
    expect(r).toEqual({ success: true })
    expect(nomeDaRpc()).toBe('obras_aplicar_alteracao')
    expect(campos()).toMatchObject({ pcm: 'YURI', equipe: 'MANFAC-7', prioridade: 'Urgente', duracao: 10 })
    expect(campos()).not.toHaveProperty('inicio_plan')
  })

  it('R9 — início preenchido pela PRIMEIRA vez não é remarcação', async () => {
    const r = await salvarCronogramaAction('o1', { ...CRONO_VAZIO, inicio: '2026-09-20' })
    expect(r).toEqual({ success: true })
    expect(nomeDaRpc()).toBe('obras_aplicar_alteracao')
    expect(campos()).toMatchObject({ inicio_plan: '2026-09-20' })
  })

  it('R9/R10 — início novo SEM motivo é recusado, sem chamar RPC nenhuma', async () => {
    obraAtual = obra({ inicio_plan: '2026-09-08' })
    const r = await salvarCronogramaAction('o1', { ...CRONO_VAZIO, inicio: '2026-09-20' })
    expect(r).toEqual({ error: 'Escolha um motivo para remarcar.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('R11 — início novo com motivo chama obras_remarcar_inicio com de, para, motivo e detalhe', async () => {
    obraAtual = obra({ inicio_plan: '2026-09-08' })
    lerMotivosMock.mockResolvedValue({ data: [{ nome: 'Falta de material' }], error: null })
    const r = await salvarCronogramaAction('o1', {
      ...CRONO_VAZIO,
      inicio: '2026-09-20',
      motivo: 'Falta de material',
    })
    expect(r).toEqual({ success: true })
    expect(nomeDaRpc()).toBe('obras_remarcar_inicio')
    expect(argumentos()).toMatchObject({
      p_obra_id: 'o1',
      p_de: '2026-09-08',
      p_para: '2026-09-20',
      p_motivo: 'Falta de material',
      p_detalhe: null,
    })
    // O contrato da RPC: p_campos.inicio_plan TEM que ser igual a p_para.
    expect(campos().inicio_plan).toBe('2026-09-20')
    const linhas = argumentos().p_linhas as { campo: string; motivo: string | null }[]
    expect(linhas.find((l) => l.campo === 'inicio_plan')?.motivo).toBe('Falta de material')
  })

  it('manda o nome CANÔNICO da lista, não o que o usuário digitou sem acento', async () => {
    obraAtual = obra({ inicio_plan: '2026-09-08' })
    lerMotivosMock.mockResolvedValue({ data: [{ nome: 'Contratação de prestador' }], error: null })
    await salvarCronogramaAction('o1', {
      ...CRONO_VAZIO,
      inicio: '2026-09-20',
      motivo: 'contratacao de prestador',
    })
    expect(argumentos().p_motivo).toBe('Contratação de prestador')
  })

  it('R10 — motivo ausente da tabela é recusado, sem escrever', async () => {
    obraAtual = obra({ inicio_plan: '2026-09-08' })
    lerMotivosMock.mockResolvedValue({ data: [{ nome: 'Clima' }], error: null })
    const r = await salvarCronogramaAction('o1', {
      ...CRONO_VAZIO,
      inicio: '2026-09-20',
      motivo: 'Chuva de granizo',
    })
    expect(r).toEqual({ error: 'Motivo de remarcação desconhecido. Recarregue a página.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('R10 — "Outro" com descrição de 2 letras é recusado', async () => {
    obraAtual = obra({ inicio_plan: '2026-09-08' })
    lerMotivosMock.mockResolvedValue({ data: [{ nome: 'Outro' }], error: null })
    const r = await salvarCronogramaAction('o1', {
      ...CRONO_VAZIO,
      inicio: '2026-09-20',
      motivo: 'Outro',
      detalhe: 'ab',
    })
    expect(r).toEqual({ error: 'Descreva o outro motivo (pelo menos 3 letras).' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('R10 — "Outro" com descrição válida manda o detalhe para a RPC', async () => {
    obraAtual = obra({ inicio_plan: '2026-09-08' })
    lerMotivosMock.mockResolvedValue({ data: [{ nome: 'Outro' }], error: null })
    await salvarCronogramaAction('o1', {
      ...CRONO_VAZIO,
      inicio: '2026-09-20',
      motivo: 'Outro',
      detalhe: 'Loja em reforma de fachada',
    })
    expect(argumentos()).toMatchObject({
      p_motivo: 'Outro',
      p_detalhe: 'Loja em reforma de fachada',
    })
  })

  it('descarta o detalhe quando o motivo não é "Outro"', async () => {
    obraAtual = obra({ inicio_plan: '2026-09-08' })
    lerMotivosMock.mockResolvedValue({ data: [{ nome: 'Clima' }], error: null })
    await salvarCronogramaAction('o1', {
      ...CRONO_VAZIO,
      inicio: '2026-09-20',
      motivo: 'Clima',
      detalhe: 'sobra da digitação anterior',
    })
    expect(argumentos().p_detalhe).toBeNull()
  })

  it('APAGAR um início que existia é remarcação, e vai para a RPC com data nula', async () => {
    // A data combinada deixou de valer, e é isso que a remarcação registra.
    // A RPC aceita p_para nulo desde a correção do bloqueador B1 (18/09) e exige
    // a chave inicio_plan presente em p_campos — é o que se confere aqui.
    obraAtual = obra({ inicio_plan: '2026-09-08' })
    lerMotivosMock.mockResolvedValue({ data: [{ nome: 'Clima' }], error: null })
    const r = await salvarCronogramaAction('o1', { ...CRONO_VAZIO, inicio: '', motivo: 'Clima' })
    expect(r.error).toBeUndefined()
    expect(rpcMock).toHaveBeenCalled()
    const args = argumentos()
    expect(args.p_para).toBeNull()
    expect(args.p_de).toBe('2026-09-08')
    expect(args.p_motivo).toBe('Clima')
    const campos = args.p_campos as Record<string, unknown>
    expect('inicio_plan' in campos).toBe(true)
    expect(campos.inicio_plan).toBeNull()
  })

  it('recusa duração fora de 1–180, sem escrever', async () => {
    const r = await salvarCronogramaAction('o1', { ...CRONO_VAZIO, duracao: '200' })
    expect(r).toEqual({ error: 'A duração precisa ficar entre 1 e 180 dias' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('recusa prioridade fora do enum', async () => {
    const r = await salvarCronogramaAction('o1', { ...CRONO_VAZIO, prioridade: 'Altíssima' })
    expect(r).toEqual({ error: 'Prioridade inválida' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('§4.3 — NÃO toca pend_resp mesmo mudando o responsável', async () => {
    await salvarCronogramaAction('o1', { ...CRONO_VAZIO, resp: 'YURI' })
    expect(campos()).toMatchObject({ pcm: 'YURI' })
    expect(campos()).not.toHaveProperty('pend_resp')
  })
})

// ============================================================
// 4.4 — salvarDadosTriagemAction
// ============================================================

describe('salvarDadosTriagemAction', () => {
  it('grava os dados sem mexer na etapa', async () => {
    obraAtual = obra({ etapa: 'definir' })
    const r = await salvarDadosTriagemAction('o1', {
      ...TRIAGEM_VAZIA,
      tipo: 'ELÉTRICA',
      valor: '4.380,50',
      analista: 'AMANDA',
      origem: 'Sistema do cliente',
    })
    expect(r).toEqual({ success: true })
    expect(campos()).toMatchObject({
      tipo: 'ELÉTRICA',
      valor: 4380.5,
      analista_cliente: 'AMANDA',
      origem: 'Sistema do cliente',
    })
    expect(campos()).not.toHaveProperty('etapa')
    expect(campos()).not.toHaveProperty('desde_etapa')
  })

  it('devolve o erro de corrida quando a obra já saiu da triagem', async () => {
    obraAtual = obra({ etapa: 'levantamento' })
    const r = await salvarDadosTriagemAction('o1', { ...TRIAGEM_VAZIA, tipo: 'CIVIL' })
    expect(r).toEqual({ error: 'Esta obra já foi liberada por outra pessoa. Recarregue a página.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('aplica a mesma validação da autorização e da identificação', async () => {
    obraAtual = obra({ etapa: 'definir' })
    expect(await salvarDadosTriagemAction('o1', { ...TRIAGEM_VAZIA, libEm: '2026-09-01' })).toEqual({
      error: 'Tem data da liberação sem nome. Escolha quem liberou ou apague a data.',
    })
    expect(await salvarDadosTriagemAction('o1', { ...TRIAGEM_VAZIA, valor: 'abc' })).toEqual({
      error: 'Valor precisa ser um número em reais, como 18.450,00.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('R7 vale também na triagem: as três colunas da aprovação andam juntas', async () => {
    obraAtual = obra({ etapa: 'definir' })
    await salvarDadosTriagemAction('o1', { ...TRIAGEM_VAZIA, aprovadaEm: '2026-09-10' })
    expect(campos()).toMatchObject({
      aprovacao: '2026-09-10',
      os_aprovada: true,
      marco_os_aprov: '2026-09-10',
    })
  })
})

// ============================================================
// 4.5 — cadastrarMotivoRemarcacaoAction
// ============================================================

describe('cadastrarMotivoRemarcacaoAction', () => {
  it('R15 — "clima" quando "Clima" já existe devolve jaExistia, sem inserir', async () => {
    lerMotivosMock.mockResolvedValue({ data: [{ id: 'm1', nome: 'Clima' }], error: null })
    const r = await cadastrarMotivoRemarcacaoAction('  clima ')
    expect(r).toEqual({ motivo: { id: 'm1', nome: 'Clima' }, jaExistia: true })
    expect(insertMotivoMock).not.toHaveBeenCalled()
  })

  it('item 5a — motivo já existente mas DESATIVADO não é oferecido como escolhido', async () => {
    // Antes: virava `jaExistia: true` igual a um motivo ativo, a janela
    // selecionava e fechava, e `salvarCronogramaAction` recusava salvar
    // depois (`motivoCanonico` só aceita `ativo = true`) — sem saída na tela.
    lerMotivosMock.mockResolvedValue({
      data: [{ id: 'm7', nome: 'Chuva forte', ativo: false }],
      error: null,
    })
    const r = await cadastrarMotivoRemarcacaoAction('chuva forte')
    expect(r.motivo).toBeUndefined()
    expect(r.jaExistia).toBeUndefined()
    expect(r.error).toContain('Chuva forte')
    expect(insertMotivoMock).not.toHaveBeenCalled()
  })

  it('R15 — compara sem acento: "contratacao de prestador" acha "Contratação de prestador"', async () => {
    lerMotivosMock.mockResolvedValue({
      data: [{ id: 'm4', nome: 'Contratação de prestador' }],
      error: null,
    })
    const r = await cadastrarMotivoRemarcacaoAction('contratacao  de prestador')
    expect(r).toEqual({ motivo: { id: 'm4', nome: 'Contratação de prestador' }, jaExistia: true })
  })

  it('insere o motivo novo com criado_por = e-mail do usuário (a RLS exige)', async () => {
    const r = await cadastrarMotivoRemarcacaoAction('greve')
    expect(insertMotivoMock).toHaveBeenCalledWith({ nome: 'Greve', criado_por: EMAIL })
    expect(r).toEqual({ motivo: { id: 'm-novo', nome: 'Greve' }, jaExistia: false })
  })

  it('R15 — violação do índice único por corrida vira jaExistia, não erro', async () => {
    lerMotivosMock
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ id: 'm9', nome: 'Greve' }], error: null })
    insertMotivoMock.mockReturnValue({
      select: jest.fn(() => ({
        single: jest.fn(async () => ({
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        })),
      })),
    })
    const r = await cadastrarMotivoRemarcacaoAction('Greve')
    expect(r).toEqual({ motivo: { id: 'm9', nome: 'Greve' }, jaExistia: true })
  })

  it('§4.5 — recusa nome com 2 caracteres e com 61', async () => {
    expect(await cadastrarMotivoRemarcacaoAction('ab')).toEqual({
      error: 'O motivo precisa ter entre 3 e 60 caracteres.',
    })
    expect(await cadastrarMotivoRemarcacaoAction('x'.repeat(61))).toEqual({
      error: 'O motivo precisa ter entre 3 e 60 caracteres.',
    })
    expect(insertMotivoMock).not.toHaveBeenCalled()
  })
})

// ============================================================
// §4 — revalidação
// ============================================================

describe('revalidatePath', () => {
  it('toda action de sucesso revalida a ficha e a base', async () => {
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, libPor: 'LEANDRO' })
    expect(revalidatePath).toHaveBeenCalledWith('/obras/obra/o1')
    expect(revalidatePath).toHaveBeenCalledWith('/obras/base')
  })

  it('identificação não mexe na fila de ninguém: não revalida o diário', async () => {
    await salvarIdentificacaoAction('o1', { ...IDENT_VAZIA, tipo: 'CIVIL' })
    expect(revalidatePath).not.toHaveBeenCalledWith('/obras/diario')
  })

  it('cronograma que muda o responsável revalida também o diário', async () => {
    await salvarCronogramaAction('o1', { ...CRONO_VAZIO, resp: 'YURI' })
    expect(revalidatePath).toHaveBeenCalledWith('/obras/diario')
  })

  it('autorização que avança a etapa revalida também o diário', async () => {
    obraAtual = obra({ etapa: 'aprovarOS' })
    await salvarAutorizacaoAction('o1', { ...AUT_VAZIA, aprovadaEm: '2026-09-10' })
    expect(revalidatePath).toHaveBeenCalledWith('/obras/diario')
  })
})

// ============================================================
// 4.6 — liberarObraAction passa a gravar os dados da obra e a origem
// ============================================================

describe('liberarObraAction — os campos novos de §4.6', () => {
  const BASE = {
    resp: 'YURI',
    equipe: 'MANFAC-7',
    prioridade: 'Normal',
    inicio: '2026-09-08',
    duracao: '7',
  }

  it('grava origem, tipo, valor, analista e o trio da aprovação junto da liberação', async () => {
    const r = await liberarObraAction('o1', {
      ...BASE,
      libPor: 'LEANDRO',
      origem: 'WhatsApp',
      tipo: 'CIVIL',
      valor: '18.450,00',
      analista: 'AMANDA',
      aprovadaEm: '2026-09-10',
    })
    expect(r).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origem: 'WhatsApp',
        tipo: 'CIVIL',
        valor: 18450,
        analista_cliente: 'AMANDA',
        aprovacao: '2026-09-10',
        os_aprovada: true,
        marco_os_aprov: '2026-09-10',
      })
    )
  })

  it('quem não manda os campos novos não tem dado apagado', async () => {
    await liberarObraAction('o1', BASE)
    const gravado = updateMock.mock.calls.at(-1)?.[0] as Record<string, unknown>
    for (const coluna of ['origem', 'tipo', 'valor', 'analista_cliente', 'aprovacao', 'os_aprovada', 'marco_os_aprov']) {
      expect(gravado).not.toHaveProperty(coluna)
    }
  })

  it('recusa valor não numérico antes de liberar', async () => {
    const r = await liberarObraAction('o1', { ...BASE, valor: 'uns dezoito mil' })
    expect(r).toEqual({ error: 'Valor precisa ser um número em reais, como 18.450,00.' })
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('obra cancelada é só leitura no servidor (spec do cancelamento §5.3)', () => {
  beforeEach(() => {
    obraAtual = obra({
      etapa: 'cancelado',
      cancelado_por: 'cliente',
      cancelado_em: '2026-09-23T13:42:00Z',
      cancelado_quem: EMAIL,
      cancelado_etapa_anterior: 'andamento',
    })
  })

  it.each([
    ['salvarAutorizacaoAction', () => salvarAutorizacaoAction('o1', { ...AUT_VAZIA, libPor: 'LEANDRO' })],
    ['salvarIdentificacaoAction', () => salvarIdentificacaoAction('o1', { ...IDENT_VAZIA, tipo: 'CIVIL' })],
    ['salvarCronogramaAction', () => salvarCronogramaAction('o1', { ...CRONO_VAZIO, duracao: '10' })],
  ])('%s recusa obra cancelada, sem chamar a RPC', async (_n, chamar) => {
    expect(await chamar()).toEqual({ error: 'Obra cancelada é só leitura. Desfaça o cancelamento para editar.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
