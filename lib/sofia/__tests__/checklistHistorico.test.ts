import {
  avariasAbertasEm,
  baseDoVeiculo,
  diffChecklists,
  escolhaPadrao,
  ordenarAntesDepois,
  type AvariaHist,
  type ChecklistHist,
} from '../checklistHistorico'

const C1: ChecklistHist = { id: 'c1', data: '2026-08-12T10:00:00Z', lataria_ok: true, pneus_ok: true, vidros_ok: null }
const C2: ChecklistHist = { id: 'c2', data: '2026-09-05T10:00:00Z', lataria_ok: false, pneus_ok: true, vidros_ok: true }
const C3: ChecklistHist = { id: 'c3', data: '2026-10-02T10:00:00Z', lataria_ok: true, pneus_ok: false, vidros_ok: true }

const A1: AvariaHist = { id: 'a1', peca: 'Para-choque dianteiro', descricao: 'Arranhão pequeno', registrada_em: C2.data, reparada_em: null }
const A2: AvariaHist = { id: 'a2', peca: 'Porta direita', descricao: null, registrada_em: C2.data, reparada_em: '2026-09-20T12:00:00Z' }
const A3: AvariaHist = { id: 'a3', peca: 'Retrovisor', descricao: 'Carcaça quebrada', registrada_em: C3.data, reparada_em: null }

describe('itens', () => {
  it('OK→problema piora, problema→OK melhora, null não conta', () => {
    const d = diffChecklists(C1, C2, [])
    expect(d).toEqual([
      { tipo: 'item_piorou', texto: 'Lataria: OK passou para problema' },
    ])
    expect(diffChecklists(C2, C3, [])).toEqual([
      { tipo: 'item_melhorou', texto: 'Lataria: problema passou para OK' },
      { tipo: 'item_piorou', texto: 'Pneus: OK passou para problema' },
    ])
  })
})

describe('avarias pela regra de data', () => {
  it('nova / resolvida / continua', () => {
    const d = diffChecklists(C2, C3, [A1, A2, A3])
    expect(d).toEqual(
      expect.arrayContaining([
        { tipo: 'avaria_nova', texto: 'Avaria nova: Retrovisor, carcaça quebrada' },
        { tipo: 'avaria_resolvida', texto: 'Avaria resolvida: Porta direita' },
        { tipo: 'avaria_continua', texto: 'Avaria continua: Para-choque dianteiro' },
      ])
    )
    expect(d.filter((x) => x.tipo.startsWith('avaria'))).toHaveLength(3)
  })

  it('reparada DEPOIS da data de B continua aberta em B', () => {
    const tardia = { ...A2, reparada_em: '2026-12-01T00:00:00Z' }
    expect(diffChecklists(C2, C3, [tardia])).toEqual([
      { tipo: 'item_melhorou', texto: 'Lataria: problema passou para OK' },
      { tipo: 'item_piorou', texto: 'Pneus: OK passou para problema' },
      { tipo: 'avaria_continua', texto: 'Avaria continua: Porta direita' },
    ])
  })

  it('avariasAbertasEm: registrada depois não conta; reparada antes não conta', () => {
    expect(avariasAbertasEm([A1, A2, A3], C1.data)).toEqual([])
    expect(avariasAbertasEm([A1, A2, A3], C2.data).map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(avariasAbertasEm([A1, A2, A3], C3.data).map((a) => a.id)).toEqual(['a1', 'a3'])
  })
})

describe('escolha e ordem', () => {
  it('antes/depois reordenados quando a ordem vem trocada', () => {
    expect(ordenarAntesDepois(C3, C1)).toEqual({ antes: C1, depois: C3, reordenado: true })
    expect(ordenarAntesDepois(C1, C3)).toEqual({ antes: C1, depois: C3, reordenado: false })
  })
  it('padrão = anterior × mais recente, independente da ordem de entrada', () => {
    expect(escolhaPadrao([C2, C3, C1])).toEqual({ a: C2, b: C3 })
    expect(escolhaPadrao([C1])).toBeNull()
  })
  it('base = mais antigo', () => {
    expect(baseDoVeiculo([C3, C1, C2])).toBe(C1)
    expect(baseDoVeiculo([])).toBeNull()
  })
})
