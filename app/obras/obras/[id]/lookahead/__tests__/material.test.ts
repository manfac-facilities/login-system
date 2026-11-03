/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Material antecipado (Task 4): leituras que falham fechadas e as respostas do "Vem aí".
 * O banco é falso; `lerObraGrande` é trocado para dar o início da atividade (o servidor
 * nunca recebe o início do cliente).
 */
type Linha = Record<string, any>
let db: Record<string, Linha[]>
let erros: Record<string, { message: string; code?: string }>
let rpcs: Record<string, { data: unknown; error: { message: string; code?: string } | null }>
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op = 'select'
  let payload: Linha = {}
  const executar = (unico: boolean) => {
    const linhas = (db[tabela] ??= [])
    const erro = erros[`${tabela}:${op}`]
    if (erro) return { data: null, error: erro }
    if (op === 'insert') {
      if (tabela === 'obras_material_resposta' && linhas.some((l) => l.obra_id === payload.obra_id && l.atividade_numero === payload.atividade_numero)) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } }
      }
      const nova = { id: `id${++seq}`, ...payload }
      linhas.push(nova)
      return { data: unico ? nova : [nova], error: null }
    }
    const alvo = linhas.filter((l) => filtros.every((f) => f(l)))
    if (op === 'update') alvo.forEach((l) => Object.assign(l, payload))
    if (op === 'delete') db[tabela] = linhas.filter((l) => !alvo.includes(l))
    return { data: unico ? (alvo[0] ?? null) : alvo, error: null }
  }
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    delete: () => ((op = 'delete'), q),
    maybeSingle: async () => executar(true),
    single: async () => executar(true),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar(false)).then(ok, ko),
  }
  return q
}

const cliente = () => ({
  auth: { getUser: getUserMock },
  from: (t: string) => construtor(t),
  rpc: async (nome: string) => rpcs[nome] ?? { data: [], error: null },
})

const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => cliente()) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../../_lib/leitura', () => ({
  ...jest.requireActual('../../../_lib/leitura'),
  lerObraGrande: jest.fn(),
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { lerComprasDasRestricoes, lerNaoPrecisa, lerObraGrande, lerPrazosCompras } from '../../../_lib/leitura'
import { PRAZOS_PADRAO_COMPRAS } from '../../../_lib/material'
import {
  apagarRestricaoAction,
  desfazerNaoPrecisaAction,
  editarRestricaoAction,
  responderNaoPrecisaAction,
  responderPrecisaAction,
} from '../_actions'

const OBRA = 'o1'
const PRAZOS_PRODUCAO = { data: [{ prazos: { folga_processo_dias: 3, entrega_material_dias: 2 }, expediente: null }], error: null }
const atividade = (numero: number, inicioPrevisto: string, inicioProjetado = '') => ({ numero, inicioPrevisto, inicioProjetado })
const obraCom = (...atividades: ReturnType<typeof atividade>[]) =>
  (lerObraGrande as jest.Mock).mockResolvedValue({ ok: true, dados: { calc: { atividades } } })

beforeEach(() => {
  seq = 0
  erros = {}
  rpcs = {}
  db = {
    obras_cronograma_versao: [{ id: 'v2', obra_id: OBRA, numero: 2, salva_em: '2026-10-10' }],
    obras_atividade: [{ versao_id: 'v2', numero: 3 }],
    obras_restricao: [],
    obras_material_resposta: [],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: 'a@b.com' } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  obraCom(atividade(3, '2026-11-16'))
})

describe('leituras falham fechadas (SQL ainda não aplicado)', () => {
  const sb = () => cliente() as any
  it('prazos: linha vigente vira PrazosCompras; erro ou sem linha → padrão do Compras', async () => {
    rpcs.obras_compras_prazos = PRAZOS_PRODUCAO
    expect(await lerPrazosCompras(sb())).toEqual({ diasExpediente: [1, 2, 3, 4, 5], folga: 3, entregaMaterial: 2 })
    rpcs.obras_compras_prazos = { data: [], error: null }
    expect(await lerPrazosCompras(sb())).toEqual(PRAZOS_PADRAO_COMPRAS)
    rpcs.obras_compras_prazos = { data: null, error: { message: 'function does not exist', code: '42883' } }
    expect(await lerPrazosCompras(sb())).toEqual(PRAZOS_PADRAO_COMPRAS)
  })
  it('compras: linhas agrupadas por restrição; erro → null', async () => {
    rpcs.obras_restricao_compras = {
      data: [{ restricao_id: 'r1', solicitacao_id: 's1', solicitacao_numero: 401, etapa: 'em_cotacao', enviado_em: null, data_minima: '2026-11-10', pedido_id: null }],
      error: null,
    }
    const m = await lerComprasDasRestricoes(sb(), OBRA)
    expect(m?.get('r1')?.[0].solicitacaoNumero).toBe(401)
    rpcs.obras_restricao_compras = { data: null, error: { message: 'x', code: '42883' } }
    expect(await lerComprasDasRestricoes(sb(), OBRA)).toBeNull()
  })
  it('não precisa: só da obra; erro → null (a tela não pergunta de novo o que já foi respondido)', async () => {
    db.obras_material_resposta = [
      { obra_id: OBRA, atividade_numero: 3 },
      { obra_id: 'outra', atividade_numero: 5 },
    ]
    expect(await lerNaoPrecisa(sb(), OBRA)).toEqual(new Set([3]))
    erros['obras_material_resposta:select'] = { message: 'relation does not exist', code: '42P01' }
    expect(await lerNaoPrecisa(sb(), OBRA)).toBeNull()
  })
})

describe('não precisa', () => {
  it('grava sem autoria (o banco força) e duplicado (23505) é sucesso idempotente', async () => {
    expect(await responderNaoPrecisaAction(OBRA, 3)).toEqual({ ok: true })
    expect(db.obras_material_resposta).toEqual([{ id: 'id1', obra_id: OBRA, atividade_numero: 3 }])
    expect(await responderNaoPrecisaAction(OBRA, 3)).toEqual({ ok: true })
    expect(db.obras_material_resposta).toHaveLength(1)
  })
  it('atividade fora da versão vigente → mesma mensagem de hoje', async () => {
    expect(await responderNaoPrecisaAction(OBRA, 9)).toEqual({ ok: false, erro: 'Atividade não encontrada no cronograma vigente' })
    expect(db.obras_material_resposta).toHaveLength(0)
  })
  it('sem acesso falha fechado', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await responderNaoPrecisaAction(OBRA, 3)).ok).toBe(false)
    expect(db.obras_material_resposta).toHaveLength(0)
  })
  it('desfazer apaga só a resposta daquela atividade da obra', async () => {
    db.obras_material_resposta = [
      { obra_id: OBRA, atividade_numero: 3 },
      { obra_id: OBRA, atividade_numero: 4 },
      { obra_id: 'outra', atividade_numero: 3 },
    ]
    expect(await desfazerNaoPrecisaAction(OBRA, 3)).toEqual({ ok: true })
    expect(db.obras_material_resposta).toEqual([
      { obra_id: OBRA, atividade_numero: 4 },
      { obra_id: 'outra', atividade_numero: 3 },
    ])
  })
})

describe('precisa', () => {
  it('material vazio → "Diga qual é o material."', async () => {
    expect(await responderPrecisaAction(OBRA, 3, '   ')).toEqual({ ok: false, erro: 'Diga qual é o material.' })
    expect(db.obras_restricao).toHaveLength(0)
  })
  it('mais de 500 caracteres → recusa', async () => {
    expect(await responderPrecisaAction(OBRA, 3, 'x'.repeat(501))).toEqual({ ok: false, erro: 'Descreva o material em até 500 caracteres.' })
    expect(db.obras_restricao).toHaveLength(0)
    expect((await responderPrecisaAction(OBRA, 3, ` ${'x'.repeat(500)} `)).ok).toBe(true)
  })
  it('atividade fora da versão vigente → mesma mensagem de hoje', async () => {
    expect(await responderPrecisaAction(OBRA, 9, 'Porcelanato')).toEqual({ ok: false, erro: 'Atividade não encontrada no cronograma vigente' })
    expect(db.obras_restricao).toHaveLength(0)
  })
  it('cria restrição de material da Manfac com prazo = pedirAte calculado no servidor (prazos vigentes)', async () => {
    rpcs.obras_compras_prazos = PRAZOS_PRODUCAO
    const r = await responderPrecisaAction(OBRA, 3, ' Porcelanato 60x60 ')
    expect(r).toEqual({ ok: true, id: 'id1' })
    // Início seg 16/11 − 5 dias úteis = seg 09/11.
    expect(db.obras_restricao[0]).toEqual({
      id: 'id1', obra_id: OBRA, atividade_numero: 3, tipo: 'material',
      descricao: 'Porcelanato 60x60', responsavel: 'manfac', prazo: '2026-11-09',
    })
  })
  it('usa o início projetado quando houver; sem leitura de prazos vale o padrão do Compras (9 dias)', async () => {
    obraCom(atividade(3, '2026-11-09', '2026-11-16'))
    rpcs.obras_compras_prazos = { data: null, error: { message: 'x' } }
    await responderPrecisaAction(OBRA, 3, 'Porcelanato')
    // seg 16/11 − 9 dias úteis = ter 03/11.
    expect(db.obras_restricao[0].prazo).toBe('2026-11-03')
  })
  it('sem acesso falha fechado', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await responderPrecisaAction(OBRA, 3, 'Porcelanato')).ok).toBe(false)
    expect(db.obras_restricao).toHaveLength(0)
  })
})

describe('trava do Compras (OBRAS_MATERIAL) chega ao usuário', () => {
  const TRAVA = { message: 'OBRAS_MATERIAL: Esta restrição tem a solicitação #401 no Compras. Cancele lá antes.', code: 'P0001' }
  beforeEach(() => {
    db.obras_restricao = [{ id: 'r1', obra_id: OBRA, tipo: 'material', situacao: 'identificada', criado_por: 'a@b.com' }]
  })
  it('apagar', async () => {
    erros['obras_restricao:delete'] = TRAVA
    expect(await apagarRestricaoAction('r1')).toEqual({ ok: false, erro: 'Esta restrição tem a solicitação #401 no Compras. Cancele lá antes.' })
  })
  it('editar (troca de tipo)', async () => {
    erros['obras_restricao:update'] = TRAVA
    const r = await editarRestricaoAction('r1', { tipo: 'acesso', descricao: 'x', responsavel: 'manfac', prazo: null })
    expect(r).toEqual({ ok: false, erro: 'Esta restrição tem a solicitação #401 no Compras. Cancele lá antes.' })
  })
})
