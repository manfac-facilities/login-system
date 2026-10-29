type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
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
    return { data: unico ? (alvo[0] ?? null) : alvo, error: null }
  }
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
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
  abrirImpedimentoAction,
  encerrarImpedimentoAction,
  ligarDescumprimentoAction,
  registrarOrientacaoAction,
} from '../_actions'
import { exibirAoClientePadrao, responsavelPadrao, type NovoImpedimento } from '../_tipos'

const OBRA = 'o1'
const novo = (over: Partial<NovoImpedimento> = {}): NovoImpedimento => ({
  tipo: 'Área não liberada',
  responsavel: 'cliente',
  atividadeNumero: 3,
  descricao: 'Loja aberta ao público',
  pessoaCliente: null,
  fotoPath: null,
  travaAtividade: true,
  impactoDias: null,
  abertoEm: '2026-10-20',
  ...over,
})

beforeEach(() => {
  seq = 0
  db = { obras_obra: [{ id: OBRA, modalidade: 'obra' }], obras_impedimento: [] }
  getUserMock.mockResolvedValue({ data: { user: { email: 'a@b.com' } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
})

describe('regras puras', () => {
  it('responsável padrão por tipo', () => {
    expect(responsavelPadrao('Área não liberada')).toBe('cliente')
    expect(responsavelPadrao('Material do cliente')).toBe('cliente')
    expect(responsavelPadrao('Material Manfac')).toBe('manfac')
    expect(responsavelPadrao('Equipe')).toBe('manfac')
    expect(responsavelPadrao('Clima')).toBe('clima')
    expect(responsavelPadrao('Outro')).toBeNull()
  })
  it('exibir ao cliente: cliente/clima sim, manfac/terceiro não', () => {
    expect(exibirAoClientePadrao('cliente')).toBe(true)
    expect(exibirAoClientePadrao('clima')).toBe(true)
    expect(exibirAoClientePadrao('manfac')).toBe(false)
    expect(exibirAoClientePadrao('terceiro')).toBe(false)
  })
})

describe('abrirImpedimentoAction', () => {
  it('sem descrição -> erro', async () => {
    const r = await abrirImpedimentoAction(OBRA, novo({ descricao: '   ' }))
    expect(r).toEqual({ ok: false, erro: 'Descreva o que aconteceu' })
    expect(db.obras_impedimento).toHaveLength(0)
  })
  it('sem responsável -> erro', async () => {
    const r = await abrirImpedimentoAction(OBRA, novo({ responsavel: null }))
    expect(r.ok).toBe(false)
    expect(db.obras_impedimento).toHaveLength(0)
  })
  it('exibir_ao_cliente segue o responsável quando não informado', async () => {
    await abrirImpedimentoAction(OBRA, novo({ responsavel: 'manfac' }))
    await abrirImpedimentoAction(OBRA, novo({ responsavel: 'clima' }))
    await abrirImpedimentoAction(OBRA, novo({ responsavel: 'cliente', exibirAoCliente: false }))
    expect(db.obras_impedimento.map((l) => l.exibir_ao_cliente)).toEqual([false, true, false])
  })
  it('grava categoria, trava e devolve o id', async () => {
    const r = await abrirImpedimentoAction(OBRA, novo())
    expect(r).toEqual({ ok: true, id: 'id1' })
    expect(db.obras_impedimento[0]).toMatchObject({ categoria: 'impedimento', trava_atividade: true, aberto_em: '2026-10-20' })
  })
  it('foto de outra obra -> erro', async () => {
    const r = await abrirImpedimentoAction(OBRA, novo({ fotoPath: 'outra/impedimento/x.jpg' }))
    expect(r.ok).toBe(false)
  })
  it('sem acesso -> falha fechada', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await abrirImpedimentoAction(OBRA, novo())
    expect(r.ok).toBe(false)
    expect(db.obras_impedimento).toHaveLength(0)
  })
})

describe('encerrarImpedimentoAction', () => {
  it('data anterior à abertura -> erro', async () => {
    await abrirImpedimentoAction(OBRA, novo())
    const r = await encerrarImpedimentoAction('id1', '2026-10-19')
    expect(r.ok).toBe(false)
    expect(db.obras_impedimento[0].encerrado_em).toBeUndefined()
  })
  it('encerra com data válida e não encerra duas vezes', async () => {
    await abrirImpedimentoAction(OBRA, novo())
    expect(await encerrarImpedimentoAction('id1', '2026-10-22')).toEqual({ ok: true })
    expect(db.obras_impedimento[0].encerrado_em).toBe('2026-10-22')
    expect((await encerrarImpedimentoAction('id1', '2026-10-23')).ok).toBe(false)
  })
})

describe('orientação e descumprimento', () => {
  it('orientação sem descrição -> erro; válida grava categoria orientacao', async () => {
    expect((await registrarOrientacaoAction(OBRA, { descricao: '', pessoaCliente: null, atividadeNumero: null, fotoPath: null })).ok).toBe(false)
    const r = await registrarOrientacaoAction(OBRA, { descricao: 'Não pisar no piso novo', pessoaCliente: 'Maria', atividadeNumero: null, fotoPath: null })
    expect(r.ok).toBe(true)
    expect(db.obras_impedimento[0]).toMatchObject({ categoria: 'orientacao', responsavel: null, pessoa_cliente: 'Maria' })
  })
  it('liga o impedimento à orientação; recusa se não for orientação', async () => {
    await registrarOrientacaoAction(OBRA, { descricao: 'x', pessoaCliente: null, atividadeNumero: null, fotoPath: null })
    await abrirImpedimentoAction(OBRA, novo({ tipo: 'Orientação descumprida' }))
    expect(await ligarDescumprimentoAction('id2', 'id1')).toEqual({ ok: true })
    expect(db.obras_impedimento[1].orientacao_id).toBe('id1')
    expect((await ligarDescumprimentoAction('id2', 'id2')).ok).toBe(false)
  })
})
