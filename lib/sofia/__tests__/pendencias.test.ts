import { mapAutomaticPendencias } from '../pendencias'

describe('mapAutomaticPendencias', () => {
  it('flags a multa pendente without signed authorization', () => {
    const result = mapAutomaticPendencias({
      multas: [{ id: '1', status: 'pendente', autorizacao_assinada: false, data: '2026-06-01', descricao: 'Excesso de velocidade' }],
      sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ origem: 'multa', descricao: expect.stringContaining('Excesso de velocidade') })
  })

  it('returns nothing when there is nothing pending', () => {
    const result = mapAutomaticPendencias({
      multas: [], sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toEqual([])
  })
})
