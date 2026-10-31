/* eslint-disable @typescript-eslint/no-explicit-any */
type Linha = Record<string, any>
let db: Record<string, Linha[]>
let erroUpdate: { message: string; code?: string } | null

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op = 'select'
  let payload: Linha = {}
  const executar = (unico: boolean) => {
    if (op === 'update' && erroUpdate) return { data: null, error: erroUpdate }
    const alvo = (db[tabela] ?? []).filter((l) => filtros.every((f) => f(l)))
    if (op === 'update') alvo.forEach((l) => Object.assign(l, payload))
    return { data: unico ? (alvo[0] ?? null) : alvo, error: null }
  }
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    maybeSingle: async () => executar(true),
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

import { isAdmin } from '@/lib/auth/roles'
import { salvarObraMaeAction } from '../_actions'
import { opcoesObraMae, type ObraParaMae } from '../_tipos'

const id = (n: number) => `${String(n).repeat(8)}-0000-4000-8000-000000000000`
const A = id(1) // obra aberta
const MAE = id(2)
const FILHA_DE_OUTRA = id(3)
const SPOT = id(4)

beforeEach(() => {
  erroUpdate = null
  db = {
    obras_obra: [
      { id: A, modalidade: 'obra', obra_pai_id: null },
      { id: MAE, modalidade: 'obra', obra_pai_id: null },
      { id: FILHA_DE_OUTRA, modalidade: 'obra', obra_pai_id: MAE },
      { id: SPOT, modalidade: 'spot', obra_pai_id: null },
    ],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: 'admin@manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockResolvedValue(true)
})

describe('opcoesObraMae', () => {
  const obras: ObraParaMae[] = [
    { id: 'a', os: '3', loja: null, paiId: null },
    { id: 'b', os: '1', loja: null, paiId: null },
    { id: 'c', os: '2', loja: null, paiId: 'b' },
  ]
  it('nem a própria obra nem uma filha; ordenado por OS', () => {
    expect(opcoesObraMae(obras, 'a')).toEqual({ opcoes: [obras[1]], bloqueio: null })
    expect(opcoesObraMae(obras, 'c').opcoes.map((o) => o.id)).toEqual(['b', 'a'])
  })
  it('obra que já tem aditivos não pode virar aditivo (um nível)', () => {
    const r = opcoesObraMae(obras, 'b')
    expect(r.opcoes).toEqual([])
    expect(r.bloqueio).toMatch(/um nível/)
  })
})

describe('salvarObraMaeAction', () => {
  it('admin liga a obra à mãe e desliga com null', async () => {
    expect(await salvarObraMaeAction(A, MAE)).toEqual({ ok: true })
    expect(db.obras_obra[0].obra_pai_id).toBe(MAE)
    expect(await salvarObraMaeAction(A, null)).toEqual({ ok: true })
    expect(db.obras_obra[0].obra_pai_id).toBeNull()
  })
  it('não admin é recusado', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    expect((await salvarObraMaeAction(A, MAE)).ok).toBe(false)
    expect(db.obras_obra[0].obra_pai_id).toBeNull()
  })
  it('recusa: si mesma, mãe que é filha, mãe SPOT, mãe inexistente, obra que tem aditivos', async () => {
    expect((await salvarObraMaeAction(A, A)).ok).toBe(false)
    expect(await salvarObraMaeAction(A, FILHA_DE_OUTRA)).toEqual({ ok: false, erro: 'A obra escolhida já é aditivo de outra (um nível só)' })
    expect((await salvarObraMaeAction(A, SPOT)).ok).toBe(false)
    expect((await salvarObraMaeAction(A, id(9))).ok).toBe(false)
    expect((await salvarObraMaeAction(MAE, A)).ok).toBe(false) // MAE tem a filha FILHA_DE_OUTRA
    expect(db.obras_obra.map((o) => o.obra_pai_id)).toEqual([null, null, MAE, null])
  })
  it('mensagem do trigger OBRAS_OBRA_PAI chega ao usuário', async () => {
    erroUpdate = { message: 'OBRAS_OBRA_PAI: a obra mãe já é aditivo de outra (um nível só)', code: '23514' }
    expect(await salvarObraMaeAction(A, MAE)).toEqual({ ok: false, erro: 'A obra mãe já é aditivo de outra (um nível só)' })
  })
})
