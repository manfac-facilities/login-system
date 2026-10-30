import {
  avaliarItem, causasNaoCumpridas, dataEnvioSemanal, diasDaSemana, lookahead, ppc, segundaDaSemana,
  type Restricao,
} from '../last-planner'
import type { AtividadeCalculada } from '../cronograma'

const ativ = (numero: number, inicioPrevisto: string, extra: Record<string, unknown> = {}) =>
  ({ numero, descricao: `A${numero}`, status: 'nao_iniciado', inicioPrevisto, inicioProjetado: inicioPrevisto, fimProjetado: inicioPrevisto, fimPrevisto: inicioPrevisto, ...extra }) as unknown as AtividadeCalculada
const rest = (numero: number, situacao: Restricao['situacao']): Restricao => ({
  id: `r${numero}${situacao}`, obraId: 'o', atividadeNumero: numero, tipo: 'acesso', descricao: 'x',
  responsavel: 'cliente', prazo: null, situacao, liberadaEm: null, criadoPor: null, criadoEm: '',
})

describe('semana', () => {
  it('segunda e dias', () => {
    expect(segundaDaSemana('2026-10-30')).toBe('2026-10-26')
    expect(segundaDaSemana('2026-11-01')).toBe('2026-10-26')
    expect(segundaDaSemana('2026-10-26')).toBe('2026-10-26')
    expect(diasDaSemana('2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
  })
  it('envio na sexta, ou último dia útil se feriado', () => {
    expect(dataEnvioSemanal('2026-10-26', new Set())).toBe('2026-10-30')
    expect(dataEnvioSemanal('2026-10-26', new Set(['2026-10-30']))).toBe('2026-10-29')
    expect(dataEnvioSemanal('2026-10-26', new Set(['2026-10-30', '2026-10-29']))).toBe('2026-10-28')
  })
})

describe('lookahead', () => {
  it('respeita janela, ignora concluídas, restrição liberada não conta', () => {
    const r = lookahead(
      [ativ(1, '2026-10-27'), ativ(2, '2026-11-03'), ativ(3, '2026-12-30'), ativ(4, '2026-10-28', { status: 'concluido' }), ativ(5, '2026-11-02', { inicioProjetado: '2026-11-10' })],
      [rest(2, 'identificada'), rest(1, 'liberada')], '2026-10-29', 3, new Map([[1, '2.3']]))
    expect(r.map((s) => s.segunda)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09'])
    expect(r[0].itens.map((i) => i.numero)).toEqual([1])
    expect(r[0].itens[0].pronta).toBe(true)
    expect(r[0].itens[0].codigo).toBe('2.3')
    expect(r[1].itens[0].codigo).toBe('')
    expect(r[1].itens[0].numero).toBe(2)
    expect(r[1].itens[0].pronta).toBe(false)
    expect(r[2].itens.map((i) => i.numero)).toEqual([5])
    expect(r.flatMap((s) => s.itens).some((i) => i.numero === 3)).toBe(false)
  })
})

describe('lookahead atrasadas', () => {
  it('início passado (não iniciada ou em andamento) cai na primeira semana', () => {
    const r = lookahead([ativ(7, '2026-10-05'), ativ(8, '2026-10-06', { status: 'em_andamento' })], [], '2026-10-29', 3, new Map())
    expect(r[0].itens.map((i) => i.numero)).toEqual([7, 8])
  })
})

describe('PPC', () => {
  it('avaliarItem com tolerância', () => {
    expect(avaliarItem(0.5, 0.5)).toBe(true)
    expect(avaliarItem(0.7, 0.69999)).toBe(true)
    expect(avaliarItem(0.7, 0.6)).toBe(false)
  })
  it('vazio é null', () => {
    expect(ppc([])).toBeNull()
    expect(ppc([{ cumprido: null }])).toBeNull()
    expect(ppc([{ cumprido: true }, { cumprido: false }, { cumprido: null }])).toBe(0.5)
  })
  it('causas agrupadas', () => {
    expect(causasNaoCumpridas([
      { cumprido: false, causa: 'material' }, { cumprido: false, causa: 'material' },
      { cumprido: false, causa: 'cliente' }, { cumprido: true, causa: null }, { cumprido: false, causa: null },
    ])).toEqual([
      { causa: 'material', responsavel: 'manfac', n: 2 },
      { causa: 'cliente', responsavel: 'cliente', n: 1 },
    ])
  })
})
