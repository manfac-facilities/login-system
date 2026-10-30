import { calcularCronograma, criterioEfetivo, resumirEtapas, type AtividadePlano } from '../cronograma'
import { curvaPlanejada } from '../curvas'

const ativ = (numero: number, duracao: number, pesoValor: number, etapa = 'E'): AtividadePlano => ({
  numero, etapa, descricao: `a${numero}`, pred1: numero > 1 ? numero - 1 : null, pred2: null,
  duracao, bloqueiaPorTrava: false, pesoValor,
})

// Seg 05/10/2026.
const calc = (plano: AtividadePlano[], criterioPeso?: 'valor' | 'duracao', hoje = '2026-10-05') =>
  calcularCronograma({
    plano, exec: [], dataBase: '2026-10-05', hoje, feriados: new Set(), atividadeTrava: null, impedimentos: [],
    criterioPeso,
  })

describe('peso por duração (Leva 2 §3.4)', () => {
  it('Σ valor = 0 por duração: pesos somam 1 e a curva planejada chega a 100%', () => {
    const plano = [ativ(1, 2, 0), ativ(2, 3, 0), ativ(3, 0, 0)]
    const r = calc(plano, 'duracao')
    // duração 0 conta como 1: 2 / 3 / 1 de 6.
    expect(r.atividades.map((a) => a.peso)).toEqual([2 / 6, 3 / 6, 1 / 6])
    const curva = curvaPlanejada(r.atividades, ['2026-10-05', r.terminoPrevisto], new Set())
    expect(curva[curva.length - 1].valor).toBeCloseTo(1)
    // Por valor com Σ = 0, a curva fica em 0 (regra antiga).
    const rv = calc(plano, 'valor')
    expect(curvaPlanejada(rv.atividades, [rv.terminoPrevisto], new Set())[0].valor).toBe(0)
  })

  it('trocar o critério muda os pesos e o previsto', () => {
    const plano = [ativ(1, 1, 90), ativ(2, 9, 10)]
    const v = calc(plano, 'valor', '2026-10-05')
    const d = calc(plano, 'duracao', '2026-10-05')
    expect(v.atividades.map((a) => a.peso)).toEqual([0.9, 0.1])
    expect(d.atividades.map((a) => a.peso)).toEqual([0.1, 0.9])
    // Hoje = fim da atividade 1: previsto 90% por valor, 10% por duração.
    expect(v.previsto).toBeCloseTo(0.9)
    expect(d.previsto).toBeCloseTo(0.1)
  })

  it('padrão continua sendo por valor', () => {
    expect(calc([ativ(1, 1, 90), ativ(2, 9, 10)]).atividades.map((a) => a.peso)).toEqual([0.9, 0.1])
  })

  it('resumirEtapas pondera pelo mesmo critério', () => {
    const plano = [ativ(1, 1, 90, 'A'), ativ(2, 9, 10, 'A')]
    const exec = [{ numero: 1, status: 'concluido' as const, percentual: 1, inicioReal: null, fimReal: null }]
    const r = (c: 'valor' | 'duracao') =>
      resumirEtapas(calcularCronograma({
        plano, exec, dataBase: '2026-10-05', hoje: '2026-10-05', feriados: new Set(),
        atividadeTrava: null, impedimentos: [], criterioPeso: c,
      }).atividades, new Set())[0].percentual
    expect(r('valor')).toBeCloseTo(0.9)
    expect(r('duracao')).toBeCloseTo(0.1)
  })
})

describe('criterioEfetivo', () => {
  it('explícito na obra manda', () => {
    expect(criterioEfetivo('duracao', [ativ(1, 1, 50)])).toBe('duracao')
    expect(criterioEfetivo('valor', [ativ(1, 1, 0)])).toBe('valor')
  })
  it('nulo/ausente: valor se Σ peso_valor > 0, senão duração', () => {
    expect(criterioEfetivo(null, [ativ(1, 1, 0), ativ(2, 1, 5)])).toBe('valor')
    expect(criterioEfetivo(undefined, [ativ(1, 1, 0)])).toBe('duracao')
    expect(criterioEfetivo(null, [])).toBe('duracao')
  })
})
