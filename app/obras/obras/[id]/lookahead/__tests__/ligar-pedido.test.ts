/* eslint-disable @typescript-eslint/no-explicit-any */
type Linha = Record<string, any>
let db: Record<string, Linha[]>
let erroUpdate: { message: string; code?: string } | null
const rpcMock = jest.fn()

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
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t), rpc: rpcMock })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async () => true) }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async () => false) }))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { ligarPedidoAction } from '../_actions'

const P_DA_OBRA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const P_OUTRA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

beforeEach(() => {
  erroUpdate = null
  db = {
    obras_restricao: [
      { id: 'r1', obra_id: 'o1', tipo: 'material', cmp_pedido_id: null },
      { id: 'r2', obra_id: 'o1', tipo: 'acesso', cmp_pedido_id: null },
    ],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: 'a@b.com' } } })
  rpcMock.mockReset()
  rpcMock.mockResolvedValue({ data: [{ pedido_id: P_DA_OBRA }], error: null })
})

describe('ligarPedidoAction (restrição ↔ pedido)', () => {
  it('liga pedido da própria obra, conferindo na lista da sessão', async () => {
    expect(await ligarPedidoAction('r1', P_DA_OBRA)).toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledWith('obras_restricao_pedidos', { p_obra: 'o1' })
    expect(db.obras_restricao[0].cmp_pedido_id).toBe(P_DA_OBRA)
  })

  it('pedido de outra obra é recusado sem gravar (Review Focus 4)', async () => {
    expect(await ligarPedidoAction('r1', P_OUTRA)).toEqual({ ok: false, erro: 'Esse pedido não é desta obra' })
    expect(db.obras_restricao[0].cmp_pedido_id).toBeNull()
  })

  it('a recusa do trigger (OBRAS_RESTRICAO_PEDIDO) vira a mesma mensagem', async () => {
    erroUpdate = { message: 'OBRAS_RESTRICAO_PEDIDO: o pedido não existe ou não é desta obra', code: '23514' }
    expect(await ligarPedidoAction('r1', P_DA_OBRA)).toEqual({ ok: false, erro: 'Esse pedido não é desta obra' })
  })

  it('lista do Compras que falha não grava', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect((await ligarPedidoAction('r1', P_DA_OBRA)).ok).toBe(false)
    expect(db.obras_restricao[0].cmp_pedido_id).toBeNull()
  })

  it('só restrição de Material; id inválido; sem acesso ao Obras', async () => {
    expect(await ligarPedidoAction('r2', P_DA_OBRA)).toEqual({ ok: false, erro: 'Só restrição de Material liga a um pedido do Compras' })
    expect(await ligarPedidoAction('r1', 'x; drop')).toEqual({ ok: false, erro: 'Pedido inválido' })
    ;(hasSystemAccess as jest.Mock).mockResolvedValueOnce(false)
    expect((await ligarPedidoAction('r1', P_DA_OBRA)).ok).toBe(false)
  })

  it('desligar (null) não consulta o Compras e limpa o vínculo; nunca mexe na situação', async () => {
    db.obras_restricao[0].cmp_pedido_id = P_DA_OBRA
    db.obras_restricao[0].situacao = 'em_tratativa'
    expect(await ligarPedidoAction('r1', null)).toEqual({ ok: true })
    expect(rpcMock).not.toHaveBeenCalled()
    expect(db.obras_restricao[0]).toMatchObject({ cmp_pedido_id: null, situacao: 'em_tratativa' })
  })
})
