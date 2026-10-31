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
    lte: (c: string, v: string) => (filtros.push((l) => String(l[c]) <= v), q),
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
import { atividadesDaSemana, dadosPpc, segundaValida, semanaAlvo, semanaFechavel } from '../_plano-tipos'
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
    obras_obra: [{ id: OBRA, engenheiro_email: 'eng@m.com', modalidade: 'obra' }],
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

  it('mede pelo histórico na sexta, não pelo exec de hoje; sem histórico até a sexta, o exec', async () => {
    hojeMock.mockReturnValue('2026-11-10') // terça da semana seguinte
    db.obras_atividade_status_hist = [
      { obra_id: OBRA, numero: 4, data_status: '2026-11-04', percentual: 0.2, registrado_em: '2026-11-04T10:00:00Z' },
      { obra_id: OBRA, numero: 4, data_status: '2026-11-06', percentual: 0.3, registrado_em: '2026-11-06T10:00:00Z' },
      { obra_id: OBRA, numero: 4, data_status: '2026-11-09', percentual: 0.9, registrado_em: '2026-11-09T10:00:00Z' },
      { obra_id: OBRA, numero: 3, data_status: '2026-11-09', percentual: 1, registrado_em: '2026-11-09T10:00:00Z' },
    ]
    // Exec de hoje: 4 em 50% (cumpriria a meta de 50%), mas na sexta estava em 30%.
    const sem = await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 4, causa: null }])
    expect(sem).toEqual({ ok: false, erro: expect.stringContaining('causa') })
    const ok = await avaliarPlanoAction(OBRA, SEMANA, [
      { numero: 3, causa: 'clima' },
      { numero: 4, causa: 'material' },
    ])
    expect(ok).toEqual({ ok: true })
    expect(db.obras_plano_item[1]).toMatchObject({ percentual_final: 0.3, cumprido: false, causa: 'material' })
    // 3 só tem histórico depois da sexta: vale o exec (40%).
    expect(db.obras_plano_item[0]).toMatchObject({ percentual_final: 0.4, cumprido: false, causa: 'clima' })
  })

  it('semana ainda em curso: mede em hoje', async () => {
    hojeMock.mockReturnValue('2026-11-06')
    db.obras_atividade_status_hist = [
      { obra_id: OBRA, numero: 4, data_status: '2026-11-05', percentual: 0.6, registrado_em: '2026-11-05T10:00:00Z' },
      { obra_id: OBRA, numero: 4, data_status: '2026-11-05', percentual: 0.7, registrado_em: '2026-11-05T18:00:00Z' },
    ]
    expect(await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 4, causa: null }])).toEqual({ ok: true })
    expect(db.obras_plano_item[1]).toMatchObject({ percentual_final: 0.7, cumprido: true })
  })

  it('obra SPOT: recusada como não encontrada', async () => {
    db.obras_obra[0].modalidade = 'spot'
    expect(await avaliarPlanoAction(OBRA, SEMANA, [{ numero: 4, causa: null }])).toEqual({ ok: false, erro: 'Obra não encontrada' })
    expect(await fecharPlanoAction(OBRA, SEMANA, [{ numero: 3, meta: 1 }])).toEqual({ ok: false, erro: 'Obra não encontrada' })
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

describe('fechamento só da semana atual ou próxima', () => {
  it('rejeita semana passada e distante; aceita atual e próxima', async () => {
    const itens = [{ numero: 3, meta: 1 }]
    expect((await fecharPlanoAction(OBRA, '2026-10-26', itens)).ok).toBe(false)
    expect((await fecharPlanoAction(OBRA, '2026-11-16', itens)).ok).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
    expect((await fecharPlanoAction(OBRA, '2026-11-09', itens)).ok).toBe(true)
    expect(semanaFechavel('2026-11-02', '2026-11-06')).toBe(true)
  })
})

describe('candidatos da semana', () => {
  const at = (numero: number, status: string, ini: string, fim: string) => ({
    numero, status, inicioProjetado: ini, inicioPrevisto: ini, fimProjetado: fim, fimPrevisto: fim,
  })
  it('inclui a que começou antes e segue; exclui concluída, futura distante e já encerrada', () => {
    const r = atividadesDaSemana(
      [
        at(1, 'em_andamento', '2026-11-02', '2026-11-12'), // começou na semana anterior à 09/11
        at(2, 'concluido', '2026-11-02', '2026-11-12'),
        at(3, 'nao_iniciado', '2026-11-16', '2026-11-20'),
        at(4, 'em_andamento', '2026-10-26', '2026-11-06'),
        at(5, 'nao_iniciado', '2026-11-13', '2026-11-13'),
      ],
      '2026-11-09',
    )
    expect(r.map((a) => a.numero)).toEqual([1, 5])
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
