import {
  avancoDoAmbiente, faixaDeCor, rondaDoDia, fotosDoPonto, comparacaoPadrao,
  type FotoMapa, type PontoMapa, type VinculoAmbienteAtividade,
} from '../mapa'
import type { AtividadeCalculada } from '../cronograma'

const at = (numero: number, peso: number, percentual: number, duracao = 5) =>
  ({ numero, peso, percentual, duracao }) as unknown as AtividadeCalculada
const v = (ambienteId: string, n: number): VinculoAmbienteAtividade => ({ ambienteId, atividadeNumero: n })

describe('avancoDoAmbiente', () => {
  const atividades = [at(1, 0.5, 1), at(2, 0.25, 0), at(3, 0.25, 0.4)]
  it('média ponderada só das atividades ligadas', () => {
    expect(avancoDoAmbiente('A', [v('A', 1), v('A', 2), v('B', 3)], atividades)).toBeCloseTo((0.5 * 1 + 0.25 * 0) / 0.75)
  })
  it('sem vínculo → null (sem NaN)', () => {
    expect(avancoDoAmbiente('A', [v('B', 1)], atividades)).toBeNull()
    expect(avancoDoAmbiente('A', [], atividades)).toBeNull()
  })
  it('atividade fora da versão vigente → ignorada; todas fora → null', () => {
    expect(avancoDoAmbiente('A', [v('A', 99)], atividades)).toBeNull()
    expect(avancoDoAmbiente('A', [v('A', 99), v('A', 1)], atividades)).toBe(1)
  })
  it('sem atividades calculadas → null', () => {
    expect(avancoDoAmbiente('A', [v('A', 1)], [])).toBeNull()
  })
  it('pesos somando 0 → ponderado pela duração (mín. 1), nunca NaN', () => {
    const r = avancoDoAmbiente('A', [v('A', 1), v('A', 2)], [at(1, 0, 1, 3), at(2, 0, 0, 1)])
    expect(r).toBeCloseTo(0.75)
    expect(avancoDoAmbiente('A', [v('A', 1)], [at(1, 0, 0.5, 0)])).toBe(0.5)
  })
  it('vínculo duplicado não conta duas vezes', () => {
    expect(avancoDoAmbiente('A', [v('A', 1), v('A', 1), v('A', 2)], atividades)).toBeCloseTo(0.5 / 0.75)
  })
})

describe('faixaDeCor', () => {
  it.each([
    [null, null], [0, 0], [0.004, 0], [0.005, 1], [0.01, 1], [0.25, 1], [0.255, 2], [0.26, 2], [0.5, 2], [0.51, 3], [0.75, 3],
    [0.76, 4], [1, 4], [1.2, 4], [-0.1, 0], [NaN, null],
  ])('%p → %p', (pct, faixa) => expect(faixaDeCor(pct as number | null)).toBe(faixa))
})

const p = (id: string, numero: number, ativo = true): PontoMapa =>
  ({ id, numero, nome: `P${numero}`, ambienteId: 'A', x: null, y: null, ativo })
const f = (id: string, pontoId: string | null, data: string, ordem = 0, estado = 'rascunho'): FotoMapa => ({
  id, rdoId: 'r' + data, path: `o/${id}.jpg`, legenda: null, ordem, data, estado, ambienteId: 'A', pontoId, atividadeNumero: null,
})

describe('rondaDoDia', () => {
  it('conta pontos ativos com foto e lista os que faltam', () => {
    const r = rondaDoDia([p('1', 1), p('2', 2), p('3', 3, false)], [f('a', '1', 'd'), f('b', '1', 'd'), f('c', null, 'd'), f('d', '3', 'd')])
    expect(r.feitos).toBe(1)
    expect(r.total).toBe(2)
    expect(r.faltando.map((x) => x.id)).toEqual(['2'])
  })
  it('sem pontos → 0 de 0', () => {
    expect(rondaDoDia([], [f('a', '1', 'd')])).toEqual({ feitos: 0, total: 0, faltando: [] })
  })
  it('faltando em ordem de número', () => {
    expect(rondaDoDia([p('2', 2), p('1', 1)], []).faltando.map((x) => x.numero)).toEqual([1, 2])
  })
})

describe('fotosDoPonto', () => {
  it('filtra o ponto e ordena por data, depois ordem', () => {
    const r = fotosDoPonto('1', [f('c', '1', '2026-10-02', 0), f('b', '1', '2026-10-01', 2), f('a', '1', '2026-10-01', 1), f('x', '2', '2026-09-01')])
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('comparacaoPadrao', () => {
  const fs = [f('a', '1', '2026-10-01'), f('b', '1', '2026-10-05'), f('c', '1', '2026-10-06')]
  it('inicio: primeira × última', () => {
    const r = comparacaoPadrao(fs, 'inicio', '2026-10-06')!
    expect([r.antes.id, r.depois.id]).toEqual(['a', 'c'])
  })
  it('ontem: última de hoje × última anterior a hoje', () => {
    const r = comparacaoPadrao(fs, 'ontem', '2026-10-06')!
    expect([r.antes.id, r.depois.id]).toEqual(['b', 'c'])
  })
  it('ontem sem foto hoje → null; sem anterior → null', () => {
    expect(comparacaoPadrao(fs, 'ontem', '2026-10-07')).toBeNull()
    expect(comparacaoPadrao([f('a', '1', '2026-10-06')], 'ontem', '2026-10-06')).toBeNull()
  })
  it('menos de duas fotos → null', () => {
    expect(comparacaoPadrao([], 'inicio', 'x')).toBeNull()
    expect(comparacaoPadrao([fs[0]], 'inicio', 'x')).toBeNull()
  })
  it('aceita entrada fora de ordem', () => {
    const r = comparacaoPadrao([fs[2], fs[0]], 'inicio', 'x')!
    expect([r.antes.id, r.depois.id]).toEqual(['a', 'c'])
  })
})
