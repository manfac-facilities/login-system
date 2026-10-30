/* eslint-disable @typescript-eslint/no-explicit-any */
type Linha = Record<string, any>
let db: Record<string, Linha[]>
const rpcMock = jest.fn()
let planoLido: Linha | null

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op = 'select'
  let payload: Linha = {}
  const executar = (unico: boolean) => {
    const linhas = (db[tabela] ??= [])
    const alvo = linhas.filter((l) => filtros.every((f) => f(l)))
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
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: (t: string) => construtor(t),
    rpc: rpcMock,
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
const hojeMock = jest.fn()
jest.mock('../../../../_lib/tipos', () => ({ hojeISO: () => hojeMock() }))
jest.mock('../../../_lib/leitura', () => ({
  feriadosDaObra: jest.fn(async () => ({ ok: true, feriados: new Set<string>() })),
  lerPlano: jest.fn(async () => ({ ok: true, plano: planoLido })),
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { avaliarPlanoAction, fecharPlanoAction } from '../_plano-actions'
import { dadosPpc, segundaValida, semanaAlvo } from '../_plano-tipos'
import type { PlanoSemana } from '../../../_lib/last-planner'

const OBRA = 'o1'
const SEMANA = '2026-11-02' // segunda
const plano = (over: Partial<Linha> = {}): Linha => ({
  id: 'p1',
  obraId: OBRA,
  semanaInicio: SEMANA,
  fechadoEm: 'x',
  fechadoPor: 'e@m.com',
  itens: [
    { id: 'i1', planoId: 'p1', numero: 3, metaPercentual: 1, percentualFinal: null, cumprido: null, causa: null, avaliadoEm: null },
    { id: 'i2', planoId: 'p1', numero: 4, metaPercentual: 0.5, percentualFinal: null, cumprido: null, causa: null, avaliadoEm: null },
  ],
  ...over,
})

beforeEach(() => {
  rpcMock.mockReset().mockResolvedValue({ data: 'novo', error: null })
  planoLido = null
  hojeMock.mockReturnValue('2026-11-06')
  db = {
    obras_obra: [{ id: OBRA, engenheiro_email: 'eng@m.com' }],
    obras_cronograma_versao: [{ id: 'v1', obra_id: OBRA, numero: 1, salva_em: '2026-10-01' }],
    obras_atividade: [
      { versao_id: 'v1', numero: 3 },
      { versao_id: 'v1', numero: 4 },
    ],
    obras_atividade_exec: [
      { obra_id: OBRA, numero: 3, status: 'em_andamento', percentual: 0.4 },
      { obra_id: OBRA, numero: 4, status: 'em_andamento', percentual: 0.5 },
    ],
    obras_plano_item: [
      { plano_id: 'p1', numero: 3 },
      { plano_id: 'p1', numero: 4 },
    ],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: 'eng@m.com' } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
})

describe('fecharPlanoAction', () => {
  const itens = [{ numero: 3, meta: 1 }]

  it('engenheiro da obra fecha via RPC', async () => {
    const r = await fecharPlanoAction(OBRA, SEMANA, itens)
    expect(r).toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledWith('obras_fechar_plano', {
      p_obra: OBRA,
      p_semana: SEMANA,
      p_itens: [{ numero: 3, meta_percentual: 1 }],
    })
  })

  it('admin fecha mesmo sem ser o engenheiro', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'adm@m.com' } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    expect((await fecharPlanoAction(OBRA, SEMANA, itens)).ok).toBe(true)
  })

  it('outro usuário com acesso a obras não fecha', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'outro@m.com' } } })
    const r = await fecharPlanoAction(OBRA, SEMANA, itens)
    expect(r.ok).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('sem sessão e sem acesso falham fechados', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect((await fecharPlanoAction(OBRA, SEMANA, itens)).ok).toBe(false)
    getUserMock.mockResolvedValue({ data: { user: { email: 'eng@m.com' } } })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect((await fecharPlanoAction(OBRA, SEMANA, itens)).ok).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('segundo fechamento da mesma semana dá erro limpo', async () => {
    planoLido = plano()
    const r = await fecharPlanoAction(OBRA, SEMANA, itens)
    expect(r).toEqual({ ok: false, erro: expect.stringContaining('Já existe plano') })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('corrida: unique violation do banco vira erro limpo', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
    const r = await fecharPlanoAction(OBRA, SEMANA, itens)
    expect(r).toEqual({ ok: false, erro: expect.stringContaining('Já existe plano') })
  })

  it('valida semana, itens, meta e atividade da versão vigente', async () => {
    expect((await fecharPlanoAction(OBRA, '2026-11-03', itens)).ok).toBe(false)
    expect((await fecharPlanoAction(OBRA, SEMANA, [])).ok).toBe(false)
    expect((await fecharPlanoAction(OBRA, SEMANA, [{ numero: 3, meta: 0 }])).ok).toBe(false)
    expect((await fecharPlanoAction(OBRA, SEMANA, [{ numero: 3, meta: 1.5 }])).ok).toBe(false)
    expect((await fecharPlanoAction(OBRA, SEMANA, [{ numero: 99, meta: 1 }])).ok).toBe(false)
    expect((await fecharPlanoAction(OBRA, SEMANA, [{ numero: 3, meta: 1 }, { numero: 3, meta: 1 }])).ok).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('avaliarPlanoAction', () => {
  beforeEach(() => {
    planoLido = plano()
  })

  it('calcula cumprido pelo exec; não cumprido exige causa', async () => {
    const sem = await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 3, causa: null }])
    expect(sem).toEqual({ ok: false, erro: expect.stringContaining('causa') })
    expect(db.obras_plano_item[0].cumprido).toBeUndefined()

    const invalida = await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 3, causa: 'inventada' }])
    expect(invalida.ok).toBe(false)

    const ok = await avaliarPlanoAction(OBRA, SEMANA, [
      { numero: 3, causa: 'material' },
      { numero: 4, causa: null },
    ])
    expect(ok).toEqual({ ok: true })
    expect(db.obras_plano_item[0]).toMatchObject({ percentual_final: 0.4, cumprido: false, causa: 'material' })
    expect(db.obras_plano_item[1]).toMatchObject({ percentual_final: 0.5, cumprido: true, causa: null })
  })

  it('antes da data de envio do semanal é recusada', async () => {
    hojeMock.mockReturnValue('2026-11-05')
    const r = await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 4, causa: null }])
    expect(r.ok).toBe(false)
    expect(db.obras_plano_item[1].cumprido).toBeUndefined()
  })

  it('só engenheiro/admin avalia; item já avaliado só o admin reavalia', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'outro@m.com' } } })
    expect((await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 4, causa: null }])).ok).toBe(false)

    getUserMock.mockResolvedValue({ data: { user: { email: 'eng@m.com' } } })
    planoLido = plano({ itens: [{ ...plano().itens[1], avaliadoEm: 'ontem' }] })
    expect((await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 4, causa: null }])).ok).toBe(false)
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    expect((await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 4, causa: null }])).ok).toBe(true)
  })

  it('atividade fora do plano e plano inexistente são recusados', async () => {
    expect((await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 77, causa: 'outro' }])).ok).toBe(false)
    planoLido = null
    expect((await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 3, causa: 'outro' }])).ok).toBe(false)
  })
})

describe('dados do PPC e semana alvo', () => {
  const p = (semana: string, cumpridos: (boolean | null)[]): PlanoSemana => ({
    id: semana,
    obraId: OBRA,
    semanaInicio: semana,
    fechadoEm: null,
    fechadoPor: null,
    itens: cumpridos.map((c, i) => ({
      id: `${semana}${i}`, planoId: semana, numero: i, metaPercentual: 1,
      percentualFinal: null, cumprido: c, causa: null, avaliadoEm: null,
    })),
  })

  it('sem planos ou sem avaliação: vazio (painel mostra —)', () => {
    expect(dadosPpc([])).toEqual([])
    expect(dadosPpc([p('2026-11-02', [null, null]), p('2026-10-26', [])])).toEqual([])
  })

  it('pega as últimas 8 avaliadas em ordem cronológica', () => {
    const planos = Array.from({ length: 10 }, (_, i) => p(`2026-0${i < 9 ? i + 1 : 9}-07`.replace('-07', '-07'), [true, false]))
    const r = dadosPpc(planos.map((x, i) => ({ ...x, semanaInicio: `2026-${String(i + 1).padStart(2, '0')}-02` })))
    expect(r).toHaveLength(8)
    expect(r[0].semana < r[7].semana).toBe(true)
    expect(r[0].ppc).toBe(0.5)
    expect(r[0].avaliados).toBe(2)
  })

  it('semana alvo e segunda válida', () => {
    expect(semanaAlvo('2026-11-04', new Set())).toBe('2026-11-02')
    expect(semanaAlvo('2026-11-04', new Set(['2026-11-02']))).toBe('2026-11-09')
    expect(segundaValida('2026-11-02')).toBe('2026-11-02')
    expect(segundaValida('2026-11-03')).toBeNull()
    expect(segundaValida('lixo')).toBeNull()
  })
})
