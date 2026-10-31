/* eslint-disable @typescript-eslint/no-explicit-any */
type Linha = Record<string, any>
let db: Record<string, Linha[]>
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op = 'select'
  let payload: Linha = {}
  const executar = (unico: boolean) => {
    const linhas = (db[tabela] ??= [])
    if (op === 'insert') {
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

const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t) })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import {
  apagarRestricaoAction,
  criarRestricaoAction,
  editarRestricaoAction,
  moverRestricaoAction,
} from '../_actions'
import { agruparQuadro, vizinha } from '../_tipos'
import type { Restricao } from '../../../_lib/last-planner'

const OBRA = 'o1'
const nova = (over: Record<string, unknown> = {}) => ({
  atividadeNumero: 3,
  tipo: 'material',
  descricao: ' Falta porcelanato ',
  responsavel: 'manfac',
  prazo: '2026-11-05',
  ...over,
})

beforeEach(() => {
  seq = 0
  db = {
    obras_cronograma_versao: [
      { id: 'v1', obra_id: OBRA, numero: 1, salva_em: '2026-10-01' },
      { id: 'v2', obra_id: OBRA, numero: 2, salva_em: '2026-10-10' },
    ],
    obras_atividade: [
      { versao_id: 'v1', numero: 9 },
      { versao_id: 'v2', numero: 3 },
    ],
    obras_restricao: [],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: 'a@b.com' } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
})

describe('criar', () => {
  it('cria sem enviar autoria/datas e com descrição aparada', async () => {
    const r = await criarRestricaoAction(OBRA, nova())
    expect(r.ok).toBe(true)
    const linha = db.obras_restricao[0]
    expect(linha.descricao).toBe('Falta porcelanato')
    expect(linha).not.toHaveProperty('criado_por')
    expect(linha).not.toHaveProperty('criado_em')
  })
  it('recusa atividade que só existe em versão antiga', async () => {
    const r = await criarRestricaoAction(OBRA, nova({ atividadeNumero: 9 }))
    expect(r).toEqual({ ok: false, erro: 'Atividade não encontrada no cronograma vigente' })
    expect(db.obras_restricao).toHaveLength(0)
  })
  it('recusa tipo inválido, responsável inválido e descrição vazia', async () => {
    expect((await criarRestricaoAction(OBRA, nova({ tipo: 'xis' }))).ok).toBe(false)
    expect((await criarRestricaoAction(OBRA, nova({ responsavel: 'clima' }))).ok).toBe(false)
    expect((await criarRestricaoAction(OBRA, nova({ descricao: '  ' }))).ok).toBe(false)
    expect(db.obras_restricao).toHaveLength(0)
  })
  it('sem acesso falha fechado', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await criarRestricaoAction(OBRA, nova())).ok).toBe(false)
    expect(db.obras_restricao).toHaveLength(0)
  })
})

describe('mover e editar', () => {
  beforeEach(() => {
    db.obras_restricao = [{ id: 'r1', obra_id: OBRA, situacao: 'identificada', criado_por: 'x@y.com' }]
  })
  it('move; recusa situação inválida', async () => {
    expect((await moverRestricaoAction('r1', 'em_tratativa')).ok).toBe(true)
    expect(db.obras_restricao[0].situacao).toBe('em_tratativa')
    expect((await moverRestricaoAction('r1', 'feita')).ok).toBe(false)
  })
  it('edita campos e valida tipo', async () => {
    const { atividadeNumero: _a, ...campos } = nova({ tipo: 'acesso' })
    expect((await editarRestricaoAction('r1', campos)).ok).toBe(true)
    expect(db.obras_restricao[0].tipo).toBe('acesso')
    expect((await editarRestricaoAction('r1', { ...campos, tipo: 'zzz' })).ok).toBe(false)
  })
})

describe('apagar', () => {
  beforeEach(() => {
    db.obras_restricao = [{ id: 'r1', obra_id: OBRA, situacao: 'identificada', criado_por: 'Autor@x.com' }]
  })
  it('outro usuário não apaga', async () => {
    expect((await apagarRestricaoAction('r1')).ok).toBe(false)
    expect(db.obras_restricao).toHaveLength(1)
  })
  it('autor apaga', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'autor@x.com' } } })
    expect((await apagarRestricaoAction('r1')).ok).toBe(true)
    expect(db.obras_restricao).toHaveLength(0)
  })
  it('admin apaga', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    expect((await apagarRestricaoAction('r1')).ok).toBe(true)
    expect(db.obras_restricao).toHaveLength(0)
  })
})

describe('agrupamento do quadro', () => {
  const r = (id: string, situacao: Restricao['situacao'], responsavel: Restricao['responsavel'], prazo: string | null) =>
    ({ id, situacao, responsavel, prazo }) as Restricao
  const lista = [
    r('a', 'identificada', 'cliente', '2026-10-01'),
    r('b', 'em_tratativa', 'manfac', null),
    r('c', 'liberada', 'cliente', '2026-09-01'),
    r('d', 'identificada', 'manfac', '2026-12-01'),
  ]
  it('3 colunas, ordenadas por prazo (sem prazo por último)', () => {
    const g = agruparQuadro(lista, { hoje: '2026-10-30' })
    expect(g.identificada.map((x) => x.id)).toEqual(['a', 'd'])
    expect(g.em_tratativa.map((x) => x.id)).toEqual(['b'])
    expect(g.liberada.map((x) => x.id)).toEqual(['c'])
  })
  it('filtro de responsável e de atrasadas (liberada nunca é atrasada)', () => {
    expect(agruparQuadro(lista, { hoje: '2026-10-30', responsavel: 'manfac' }).identificada.map((x) => x.id)).toEqual(['d'])
    const g = agruparQuadro(lista, { hoje: '2026-10-30', atrasadas: true })
    expect(g.identificada.map((x) => x.id)).toEqual(['a'])
    expect(g.liberada).toHaveLength(0)
  })
  it('vizinha avança/volta e para nas pontas', () => {
    expect(vizinha('identificada', 1)).toBe('em_tratativa')
    expect(vizinha('identificada', -1)).toBeNull()
    expect(vizinha('liberada', 1)).toBeNull()
  })
})
