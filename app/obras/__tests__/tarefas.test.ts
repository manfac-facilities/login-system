/**
 * Testes da tela de Tarefas.
 *
 * O QUE PROTEGEM: "vencida" nunca é gravada. A coluna `situacao` só conhece
 * 'aberta' e 'respondida'; vencida é `sitTarefa()` contra a data de hoje. Se
 * alguém um dia gravar 'vencida' no banco, o número da tela congela no dia em
 * que foi escrito — e a lista para de dizer a verdade.
 *
 * Supabase 100% mockado. A migration ainda não foi aplicada em produção.
 */

const getUserMock = jest.fn()
const updateMock = jest.fn()
const eqMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({
      update: updateMock,
      select: jest.fn().mockReturnThis(),
      eq: eqMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import { responderTarefaAction } from '../tarefas/_actions'
import { diasNaMao, diasVencida, ordenarTarefas, porDono } from '../tarefas/_lista'
import { sitTarefa, type TarefaRow } from '../_lib/tipos'
import { hasSystemAccess } from '@/lib/auth/systemAccess'

const HOJE = '2026-09-05'
/** 12:00 em São Paulo. */
const MEIO_DIA = new Date('2026-09-05T15:00:00Z')

function tarefa(over: Partial<TarefaRow>): TarefaRow {
  return {
    id: 't',
    obra_id: 'obra-1',
    item: 'Material',
    dono: 'ROBERTA',
    aberta: HOJE,
    hora_aberta: '12:00',
    prazo: HOJE,
    registrou: 'YURI',
    situacao: 'aberta',
    resposta_em: null,
    resposta_hora: null,
    resumo: null,
    created_at: '2026-09-05T15:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(MEIO_DIA)
  getUserMock.mockResolvedValue({
    data: { user: { id: 'u1', email: 'yuri.nascimento@manfac.com.br' } },
  })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  updateMock.mockReturnValue({ eq: eqMock })
  eqMock.mockResolvedValue({ error: null })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('responderTarefaAction', () => {
  it('recusa quem não tem acesso ao módulo', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await responderTarefaAction('t1', 'comprei a massa')
    expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('exige o resumo — resposta sem o que foi feito não fecha nada', async () => {
    const r = await responderTarefaAction('t1', '   ')
    expect(r).toEqual({ error: 'Escreva em uma linha o que foi resolvido.' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('fecha a tarefa com data, hora e resumo — e NUNCA grava "vencida"', async () => {
    const r = await responderTarefaAction('t1', 'comprei a massa, entrega amanhã')
    expect(r).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        situacao: 'respondida',
        resposta_em: HOJE,
        resumo: 'comprei a massa, entrega amanhã',
      })
    )
    const gravado = updateMock.mock.calls[0][0]
    expect(gravado.situacao).not.toBe('vencida')
    expect(gravado.resposta_hora).toMatch(/^\d{2}:\d{2}$/)
    expect(eqMock).toHaveBeenCalledWith('id', 't1')
  })

  it('devolve mensagem amigável quando o banco recusa, sem lançar', async () => {
    eqMock.mockResolvedValue({ error: { message: 'RLS denied' } })
    const r = await responderTarefaAction('t1', 'resolvido')
    expect(r).toEqual({ error: 'Erro ao marcar a tarefa como respondida' })
  })
})

describe('"vencida" é calculada, nunca armazenada', () => {
  it('tarefa com prazo no passado e situacao "aberta" aparece como vencida', () => {
    const t = tarefa({ prazo: '2026-09-02' })
    expect(t.situacao).toBe('aberta')
    expect(sitTarefa(t, HOJE)).toBe('vencida')
  })

  it('tarefa respondida não vira vencida nem com o prazo estourado', () => {
    const t = tarefa({ prazo: '2026-09-02', situacao: 'respondida' })
    expect(sitTarefa(t, HOJE)).toBe('respondida')
  })

  it('prazo de hoje ainda é aberta — vence só quando o dia vira', () => {
    expect(sitTarefa(tarefa({ prazo: HOJE }), HOJE)).toBe('aberta')
    expect(sitTarefa(tarefa({ prazo: HOJE }), '2026-09-06')).toBe('vencida')
  })
})

describe('agrupamento e ordenação da lista', () => {
  it('agrupa por dono e põe primeiro quem tem mais tarefa', () => {
    const grupos = porDono(
      [
        tarefa({ id: 'a', dono: 'YURI' }),
        tarefa({ id: 'b', dono: 'ROBERTA' }),
        tarefa({ id: 'c', dono: 'ROBERTA' }),
      ],
      HOJE
    )
    expect(grupos.map((g) => g.chave)).toEqual(['ROBERTA', 'YURI'])
    expect(grupos[0].lista).toHaveLength(2)
  })

  it('deixa a respondida fora do agrupamento de quem está com a bola', () => {
    const grupos = porDono(
      [tarefa({ id: 'a', dono: 'YURI', situacao: 'respondida' }), tarefa({ id: 'b', dono: 'YURI' })],
      HOJE
    )
    expect(grupos).toHaveLength(1)
    expect(grupos[0].lista.map((t) => t.id)).toEqual(['b'])
  })

  it('vencida vem primeiro; empatadas, quem está há mais tempo com a bola', () => {
    const ordenada = ordenarTarefas(
      [
        tarefa({ id: 'nova', aberta: HOJE, prazo: HOJE }),
        tarefa({ id: 'antiga', aberta: '2026-09-01', prazo: HOJE }),
        tarefa({ id: 'vencida', aberta: '2026-09-03', prazo: '2026-09-03' }),
      ],
      HOJE
    )
    expect(ordenada.map((t) => t.id)).toEqual(['vencida', 'antiga', 'nova'])
  })

  it('conta os dias na mão e os dias vencida sem devolver negativo', () => {
    expect(diasNaMao(tarefa({ aberta: '2026-09-01' }), HOJE)).toBe(4)
    expect(diasNaMao(tarefa({ aberta: '2026-09-09' }), HOJE)).toBe(0)
    expect(diasVencida(tarefa({ prazo: '2026-09-03' }), HOJE)).toBe(2)
    expect(diasVencida(tarefa({ prazo: HOJE }), HOJE)).toBe(0)
  })
})
