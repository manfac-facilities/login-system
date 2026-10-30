import { calcularCronograma, type AtividadePlano } from '../cronograma'
import { curvaPlanejada, curvaRealizada, datasDaCurva, progressoPorPeriodo } from '../curvas'

const F = new Set<string>()
const plano: AtividadePlano[] = [
  { numero: 1, etapa: 'E', descricao: 'a', pred1: null, pred2: null, duracao: 2, bloqueiaPorTrava: false, pesoValor: 30 },
  { numero: 2, etapa: 'E', descricao: 'b', pred1: 1, pred2: null, duracao: 2, bloqueiaPorTrava: false, pesoValor: 70 },
]
const calc = calcularCronograma({
  plano, exec: [], dataBase: '2026-10-05', hoje: '2026-10-05', feriados: F, atividadeTrava: null, impedimentos: [],
})
const ats = calc.atividades

describe('datasDaCurva', () => {
  it('semana: sextas incluindo o fim', () => {
    expect(datasDaCurva('2026-10-26', '2026-11-20', 'semana')).toEqual(['2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20'])
  })
  it('semana: fim fora de sexta entra', () => {
    expect(datasDaCurva('2026-10-26', '2026-11-18', 'semana').pop()).toBe('2026-11-18')
  })
  it('mes: último dia útil do mês + fim', () => {
    expect(datasDaCurva('2026-10-05', '2026-12-10', 'mes')).toEqual(['2026-10-30', '2026-11-30', '2026-12-10'])
  })
})

describe('curvaPlanejada', () => {
  it('começa em 0 e termina em 1', () => {
    const s = curvaPlanejada(ats, ['2026-10-04', '2026-10-06', '2026-10-08', '2026-10-09'], F)
    expect(s[0].valor).toBe(0)
    expect(s[1].valor).toBeCloseTo(0.3 * 1)
    expect(s[3].valor).toBe(1)
  })
})

describe('curvaRealizada', () => {
  const datas = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']
  it('sem histórico: só ponto 0 na data-base', () => {
    expect(curvaRealizada(ats, [], datas)).toEqual([{ data: '2026-10-05', valor: 0 }])
  })
  it('histórico em 2 datas, até a última', () => {
    const hist = [
      { numero: 1, dataStatus: '2026-10-08', percentual: 0.5 },
      { numero: 1, dataStatus: '2026-10-15', percentual: 1 },
      { numero: 2, dataStatus: '2026-10-15', percentual: 0.5 },
    ]
    const s = curvaRealizada(ats, hist, datas)
    expect(s).toHaveLength(3)
    expect(s[0].valor).toBe(0)
    expect(s[1].valor).toBeCloseTo(0.15)
    expect(s[2].data).toBe('2026-10-15')
    expect(s[2].valor).toBeCloseTo(0.3 + 0.35)
  })
})

describe('progressoPorPeriodo', () => {
  it('diferença entre pontos consecutivos em p.p.', () => {
    const b = [{ data: 'a', valor: 0 }, { data: 'b', valor: 0.2 }]
    const p = [{ data: 'a', valor: 0 }, { data: 'b', valor: 0.3 }]
    const r = [{ data: 'a', valor: 0 }]
    const out = progressoPorPeriodo(b, p, r)
    expect(out).toHaveLength(1)
    expect(out[0].periodo).toBe('b')
    expect(out[0].base).toBeCloseTo(20)
    expect(out[0].previsto).toBeCloseTo(30)
    expect(out[0].realizado).toBe(0)
  })
})
