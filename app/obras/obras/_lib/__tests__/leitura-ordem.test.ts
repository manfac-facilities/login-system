/**
 * Leva 1b (itens 1 e 15): a ordem de exibição vem de `etapa_ordem`/`ordem`,
 * nunca de `numero` (que é a identidade ligada à execução). Sem as colunas
 * (linha antiga, SQL ainda não aplicado) cai no `numero`.
 */
import { resumirEtapas, calcularCronograma } from '../cronograma'
import { planoDe } from '../leitura'

const linha = (numero: number, etapa: string | null, etapa_ordem: number | null, ordem: number | null) => ({
  versao_id: 'v1', numero, etapa, etapa_ordem, ordem, descricao: `a${numero}`, pred1: null, pred2: null,
  duracao: 1, bloqueia_por_trava: false, peso_valor: 0,
})

describe('planoDe — ordem de exibição', () => {
  it('ordena por etapa_ordem, depois ordem, depois numero', () => {
    const plano = planoDe(
      [
        linha(1, 'A', 2, 1),
        linha(2, 'A', 2, 2),
        linha(3, 'B', 1, 3),
        linha(4, 'B', 1, 0),
        linha(5, 'A', 2, 1),
      ],
      'v1',
    )
    expect(plano.map((a) => a.numero)).toEqual([4, 3, 1, 5, 2])
  })

  it('sem ordem/etapa_ordem (nulas) cai no numero e agrupa a etapa pela primeira aparição', () => {
    const plano = planoDe([linha(3, 'B', null, null), linha(1, 'A', null, null), linha(2, 'B', null, null)], 'v1')
    expect(plano.map((a) => a.numero)).toEqual([1, 2, 3])
  })

  it('resumirEtapas segue a mesma ordem (etapas e atividades)', () => {
    const plano = planoDe([linha(1, 'A', 2, 1), linha(2, 'B', 1, 2), linha(3, 'A', 2, 0)], 'v1')
    const calc = calcularCronograma({
      plano, exec: [], dataBase: '2026-11-02', hoje: '2026-11-02', feriados: new Set(), atividadeTrava: null, impedimentos: [],
    })
    expect(resumirEtapas(calc.atividades, new Set()).map((e) => [e.etapa, e.numeros])).toEqual([
      ['B', [2]],
      ['A', [3, 1]],
    ])
  })
})
