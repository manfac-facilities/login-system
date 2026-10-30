/**
 * atualizarStatusAction (Leva 1 Task 6, spec §5 A5). Supabase = banco em
 * memória mínimo (select/eq/order/insert/upsert em lote).
 */

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op: 'select' | 'insert' | 'upsert' = 'select'
  let payload: Linha | Linha[] | null = null
  let unico = false

  const executar = () => {
    const linhas = (db[tabela] ??= [])
    let data: Linha[]
    if (op === 'select') data = linhas.filter((l) => filtros.every((f) => f(l)))
    else if (op === 'insert') {
      data = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({ id: `id${++seq}`, ...p }))
      linhas.push(...data)
    } else {
      data = (Array.isArray(payload) ? payload : [payload!]).map((p) => {
        const e = linhas.find((l) => l.obra_id === p.obra_id && l.numero === p.numero)
        if (e) return Object.assign(e, p)
        linhas.push({ ...p })
        return p
      })
    }
    if (unico) return { data: data[0] ?? null, error: null }
    return { data, error: null }
  }

  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    order: () => q,
    insert: (p: Linha | Linha[]) => ((op = 'insert'), (payload = p), q),
    upsert: (p: Linha | Linha[]) => ((op = 'upsert'), (payload = p), q),
    maybeSingle: async () => ((unico = true), executar()),
    then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, falha),
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
import { atualizarStatusAction } from '../_actions'

const ENG = 'eduardo@manfac.com.br'
const OBRA = 'o1'
const DIA = '2026-10-30'

type LinhaStatus = Parameters<typeof atualizarStatusAction>[2][number]
const lin = (numero: number, over: Partial<LinhaStatus> = {}): LinhaStatus => ({
  numero, percentual: 0, diasRestantes: null, concluir: false, ...over,
})
const execDe = (n: number) => db.obras_atividade_exec.find((e) => e.numero === n)!

beforeEach(() => {
  jest.clearAllMocks()
  seq = 0
  db = {
    obras_obra: [{ id: OBRA, modalidade: 'obra', engenheiro_email: 'Eduardo@Manfac.com.br', atividade_trava: 6, data_base: '2026-10-26' }],
    obras_cronograma_versao: [{ id: 'v1', obra_id: OBRA, numero: 1, salva_em: '2026-10-26T12:00:00Z' }],
    obras_atividade: Array.from({ length: 12 }, (_, i) => ({
      id: `a${i + 1}`, versao_id: 'v1', obra_id: OBRA, numero: i + 1, etapa: 'E', descricao: `Atividade ${i + 1}`,
      pred1: null, pred2: null, duracao: 2, bloqueia_por_trava: i + 1 >= 11, peso_valor: 100,
    })),
    obras_atividade_exec: Array.from({ length: 12 }, (_, i) => ({
      obra_id: OBRA,
      numero: i + 1,
      status: i + 1 === 6 ? 'em_andamento' : 'nao_iniciado',
      percentual: i + 1 === 6 ? 0.5 : 0,
      inicio_real: i + 1 === 6 ? '2026-10-27' : null,
      fim_real: null,
      dias_restantes: null,
    })),
    obras_atividade_status_hist: [],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: ENG } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
})

describe('atualizarStatusAction', () => {
  it('quem não é engenheiro nem admin é recusado, sem gravar', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'outro@manfac.com.br' } } })
    expect(await atualizarStatusAction(OBRA, DIA, [lin(6, { percentual: 0.8 })])).toEqual({
      ok: false,
      erro: 'Só o engenheiro da obra ou um administrador altera o cronograma',
    })
    expect(execDe(6).percentual).toBe(0.5)
    expect(db.obras_atividade_status_hist).toHaveLength(0)
  })

  it('atividade travada não avança (nada é gravado)', async () => {
    const r = await atualizarStatusAction(OBRA, DIA, [lin(6, { percentual: 0.8 }), lin(11, { percentual: 0.2 })])
    expect(r).toEqual({ ok: false, erro: 'Atividade 11: travada até a atividade 6 ser concluída' })
    expect(execDe(6).percentual).toBe(0.5)
    expect(execDe(11).percentual).toBe(0)
    expect(db.obras_atividade_status_hist).toHaveLength(0)
  })

  it('concluir a trava no mesmo lote libera a dependente', async () => {
    const r = await atualizarStatusAction(OBRA, DIA, [lin(6, { concluir: true }), lin(11, { percentual: 0.2 })])
    expect(r).toEqual({ ok: true, aplicadas: 2 })
    expect(execDe(11)).toMatchObject({ status: 'em_andamento', percentual: 0.2 })
  })

  it('% menor que o atual não regride; sem outra mudança não grava histórico', async () => {
    const r = await atualizarStatusAction(OBRA, DIA, [lin(6, { percentual: 0.3 })])
    expect(r).toEqual({ ok: true, aplicadas: 0 })
    expect(execDe(6).percentual).toBe(0.5)
    expect(db.obras_atividade_status_hist).toHaveLength(0)
  })

  it('dias restantes mudando com % menor: grava os dias e mantém o %', async () => {
    const r = await atualizarStatusAction(OBRA, DIA, [lin(6, { percentual: 0.3, diasRestantes: 4 })])
    expect(r).toEqual({ ok: true, aplicadas: 1 })
    expect(execDe(6)).toMatchObject({ percentual: 0.5, dias_restantes: 4, status: 'em_andamento' })
  })

  it('concluir preenche fim_real com a data de status, % = 100%', async () => {
    expect((await atualizarStatusAction(OBRA, DIA, [lin(6, { concluir: true })])).ok).toBe(true)
    expect(execDe(6)).toMatchObject({ status: 'concluido', percentual: 1, inicio_real: '2026-10-27', fim_real: DIA, atualizado_por: ENG })
  })

  it('sair de 0% preenche inicio_real com a data de status; datas reais informadas mandam', async () => {
    await atualizarStatusAction(OBRA, DIA, [lin(7, { percentual: 0.4 }), lin(8, { percentual: 0.1, inicioReal: '2026-10-28' })])
    expect(execDe(7)).toMatchObject({ status: 'em_andamento', percentual: 0.4, inicio_real: DIA, fim_real: null })
    expect(execDe(8)).toMatchObject({ inicio_real: '2026-10-28' })
  })

  it('concluída fica concluída', async () => {
    Object.assign(execDe(5), { status: 'concluido', percentual: 1, inicio_real: '2026-10-26', fim_real: '2026-10-27' })
    const r = await atualizarStatusAction(OBRA, DIA, [lin(5, { percentual: 0.4 })])
    expect(r).toEqual({ ok: true, aplicadas: 0 })
    expect(execDe(5)).toMatchObject({ status: 'concluido', percentual: 1, fim_real: '2026-10-27' })
  })

  it('insere 1 linha de histórico por atividade alterada (origem status, data de status)', async () => {
    const r = await atualizarStatusAction(OBRA, DIA, [
      lin(6, { percentual: 0.7, diasRestantes: 2 }),
      lin(7, { percentual: 0.2 }),
      lin(8, { percentual: 0 }), // sem mudança
    ])
    expect(r).toEqual({ ok: true, aplicadas: 2 })
    expect(db.obras_atividade_status_hist).toEqual([
      expect.objectContaining({ obra_id: OBRA, numero: 6, data_status: DIA, percentual: 0.7, dias_restantes: 2, status: 'em_andamento', origem: 'status' }),
      expect.objectContaining({ obra_id: OBRA, numero: 7, data_status: DIA, percentual: 0.2, dias_restantes: null, status: 'em_andamento', origem: 'status' }),
    ])
  })

  it('entrada inválida é recusada', async () => {
    expect((await atualizarStatusAction(OBRA, '30/10/2026', [lin(6, { percentual: 0.7 })])).ok).toBe(false)
    expect((await atualizarStatusAction(OBRA, DIA, [lin(6, { percentual: 1.2 })])).ok).toBe(false)
    expect((await atualizarStatusAction(OBRA, DIA, [lin(6, { percentual: 0.7, diasRestantes: -1 })])).ok).toBe(false)
    expect((await atualizarStatusAction(OBRA, DIA, [lin(99, { percentual: 0.7 })])).ok).toBe(false)
    expect((await atualizarStatusAction(OBRA, DIA, [lin(6, { concluir: true, fimReal: '2026-10-20' })])).ok).toBe(false)
    expect(execDe(6).percentual).toBe(0.5)
  })
})
