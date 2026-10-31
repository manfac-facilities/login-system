import { consolidarFinanceiro } from '../financeiro-obra'

const obras = [
  { id: 'm', os: '100', paiId: null },
  { id: 'f', os: '100-A', paiId: 'm' },
]

describe('consolidarFinanceiro', () => {
  it('vazio: zeros e margemPct null, sem NaN', () => {
    const r = consolidarFinanceiro({ compras: [], fornecedores: [], notas: [], obras })
    expect(r.total).toMatchObject({ receitaRealizada: 0, custoComprometido: 0, custoRealizado: 0, custoPago: 0, margemRealizada: 0, margemPct: null })
    expect(r.porOS).toHaveLength(2)
    const r2 = consolidarFinanceiro({ compras: [], fornecedores: [], notas: [], obras: [] })
    expect(r2.total.margemPct).toBeNull()
  })

  it('compras: comprometido/realizado/pago; só emitido conta', () => {
    const r = consolidarFinanceiro({
      obras,
      fornecedores: [],
      notas: [],
      compras: [
        { obraId: 'm', status: 'emitido', total_centavos: 1000 },
        { obraId: 'm', status: 'emitido', total_centavos: 2000, nf: '5' },
        { obraId: 'm', status: 'emitido', total_centavos: 4000, nf: '6', pago_em: '2026-10-01' },
        { obraId: 'm', status: 'falha', total_centavos: 9999 },
        { obraId: 'm', status: 'cancelado', total_centavos: 9999 },
      ],
    })
    expect(r.porOS[0]).toMatchObject({ custoComprometido: 7000, custoRealizado: 6000, custoPago: 4000 })
  })

  it('medições: devolvida nunca conta; progressão aprovada -> paga', () => {
    const s = (status: any, v: number) => ({ obraId: 'f', status, valorCentavos: v })
    const r = consolidarFinanceiro({
      obras, compras: [], notas: [],
      fornecedores: [s('solicitada', 1), s('aprovada', 10), s('pagamento_solicitado', 100), s('paga', 1000), s('devolvida', 99999)],
    })
    expect(r.porOS[1]).toMatchObject({ custoComprometido: 1110, custoRealizado: 1100, custoPago: 1000 })
  })

  const nota = (obraId: string, v: number, situacao: string, devolvidaEm: string | null = null) =>
    ({ obraId, valor_centavos: v, situacao, devolvidaEm })

  it('NF rateada mae/filha: cada parcela uma vez; total = soma; margem', () => {
    const r = consolidarFinanceiro({
      obras, compras: [
        { obraId: 'f', status: 'emitido', total_centavos: 3000, nf: '1' },
      ], fornecedores: [],
      notas: [nota('m', 6000, 'autorizada'), nota('f', 4000, 'enviada')],
    })
    expect(r.porOS[0].receitaRealizada).toBe(6000)
    expect(r.porOS[1].receitaRealizada).toBe(4000)
    expect(r.total.receitaRealizada).toBe(10000)
    expect(r.total.margemRealizada).toBe(7000)
    expect(r.total.margemPct).toBeCloseTo(70)
  })

  it('so autorizada/enviada nao devolvida conta como receita', () => {
    const ruins = ['rascunho', 'aprovada', 'os_criada', 'faturando', 'rejeitada', 'falha_conferir', 'cancelada', 'xyz', '']
    const r = consolidarFinanceiro({
      obras, compras: [], fornecedores: [],
      notas: [...ruins.map((s) => nota('m', 100, s)), nota('m', 50, 'autorizada', '2026-10-01')],
    })
    expect(r.total.receitaRealizada).toBe(0)
    expect(r.total.margemPct).toBeNull()
  })

  it('linha da mae nao inclui valores da filha', () => {
    const r = consolidarFinanceiro({
      obras, compras: [], fornecedores: [{ obraId: 'f', status: 'paga', valorCentavos: 900 }],
      notas: [nota('f', 1000, 'autorizada')],
    })
    expect(r.porOS[0]).toMatchObject({ receitaRealizada: 0, custoPago: 0 })
    expect(r.total).toMatchObject({ receitaRealizada: 1000, custoPago: 900 })
  })

  it('valor nao finito lanca erro', () => {
    expect(() => consolidarFinanceiro({ obras, compras: [], fornecedores: [], notas: [nota('m', NaN, 'autorizada')] })).toThrow()
  })

  it('ignora itens de obra desconhecida; receita zero com custo gera margem negativa e pct null', () => {
    const r = consolidarFinanceiro({
      obras, fornecedores: [], notas: [nota('x', 5, 'autorizada')],
      compras: [{ obraId: 'm', status: 'emitido', total_centavos: 500, nf: '1' }],
    })
    expect(r.total.receitaRealizada).toBe(0)
    expect(r.total.margemRealizada).toBe(-500)
    expect(r.total.margemPct).toBeNull()
  })
})
