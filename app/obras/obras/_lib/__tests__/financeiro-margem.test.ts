import { consolidarMargem, custoDoVinculo, type ObraMargem, type VinculoCusto } from '../financeiro-obra'

const obras: ObraMargem[] = [
  { id: 'm', os: '100', paiId: null, receitaCentavos: 40_000_000, cancelada: false, avanco: 0.5 },
  { id: 'f', os: '100-A', paiId: 'm', receitaCentavos: 10_000_000, cancelada: false, avanco: null },
]
const vazio = { compras: [], fornecedores: [], notas: [], vinculos: [], medicoesCliente: [] }
const vin = (over: Partial<VinculoCusto> = {}): VinculoCusto => ({
  obraId: 'm', origem: 'solicitacao', valorCentavos: 100_000, deMedicaoFornecedor: false, etapa: 'lancada',
  pagamentoSituacao: null, valorPagoCentavos: null, solicitacaoValorCentavos: 100_000, relatorioStatus: null, ...over,
})

/** Nenhum número do resultado pode ser NaN/Infinity (Review Focus 5). */
function semNaN(x: unknown): void {
  if (typeof x === 'number') expect(Number.isFinite(x)).toBe(true)
  else if (x && typeof x === 'object') Object.values(x).forEach(semNaN)
}

describe('consolidarMargem — Review Focus 5', () => {
  it('sem valor receita: receita/margem projetada/percentuais null, sem NaN', () => {
    const r = consolidarMargem({
      ...vazio, avanco: 0.4,
      obras: obras.map((o) => ({ ...o, receitaCentavos: null })),
      compras: [{ obraId: 'm', status: 'emitido', total_centavos: 50_000 }],
    })
    expect(r.total.receitaEsperada).toBeNull()
    expect(r.total.margemProjetada).toBeNull()
    expect(r.total.margemProjetadaPct).toBeNull()
    expect(r.total.custoProjetado).toBe(125_000)
    expect(r.percentuais).toEqual({ avanco: 40, liberado: null, faturado: null })
    expect(r.pendencias.avancoAFrente).toBeNull()
    expect(r.pendencias.avancoAFrentePP).toBeNull()
    expect(r.osSemReceita).toBe(2)
    semNaN(r)
  })

  it('avanço 0 ou null: custo projetado e margem projetada null', () => {
    for (const avanco of [0, null, NaN, Infinity]) {
      const r = consolidarMargem({
        ...vazio, avanco,
        obras: obras.map((o) => ({ ...o, avanco })),
        compras: [{ obraId: 'm', status: 'emitido', total_centavos: 50_000 }],
      })
      expect(r.total.custoProjetado).toBeNull()
      expect(r.total.margemProjetada).toBeNull()
      expect(r.porOS[0].custoProjetado).toBeNull()
      semNaN(r)
    }
  })

  it('sem lançamentos: zeros, margem realizada 0 e pct null', () => {
    const r = consolidarMargem({ ...vazio, obras, avanco: 0.5 })
    expect(r.total).toMatchObject({ liberado: 0, receitaRealizada: 0, custoComprometido: 0, custoProjetado: 0, margemRealizada: 0, margemPct: null })
    expect(r.total.receitaEsperada).toBe(50_000_000)
    expect(r.total.margemProjetada).toBe(50_000_000)
    expect(r.total.margemProjetadaPct).toBe(100)
    expect(r.pendencias).toEqual({ liberadoNaoFaturado: 0, avancoAFrente: 25_000_000, avancoAFrentePP: 50 })
    semNaN(r)
  })

  it('obra sem nenhuma OS: tudo zero/null sem NaN', () => {
    const r = consolidarMargem({ ...vazio, obras: [], avanco: null })
    expect(r.total.receitaEsperada).toBeNull()
    semNaN(r)
  })
})

describe('consolidarMargem — receita, liberado, faturado e pendências', () => {
  it('liberado = medições aprovadas; faturado = receita realizada; percentuais sobre a receita esperada', () => {
    const r = consolidarMargem({
      ...vazio, obras, avanco: 0.52,
      medicoesCliente: [
        { obraId: 'm', situacao: 'aprovada', valorCentavos: 15_000_000 },
        { obraId: 'f', situacao: 'aprovada', valorCentavos: 5_000_000 },
        { obraId: 'm', situacao: 'enviada', valorCentavos: 9_999_999 },
        { obraId: 'm', situacao: 'recusada', valorCentavos: 9_999_999 },
        { obraId: 'x', situacao: 'aprovada', valorCentavos: 9_999_999 },
      ],
      notas: [{ obraId: 'm', valor_centavos: 15_000_000, situacao: 'autorizada', devolvidaEm: null }],
    })
    expect(r.porOS.map((l) => l.liberado)).toEqual([15_000_000, 5_000_000])
    expect(r.total.liberado).toBe(20_000_000)
    expect(r.total.receitaRealizada).toBe(15_000_000)
    expect(r.percentuais).toEqual({ avanco: 52, liberado: 40, faturado: 30 })
    expect(r.pendencias.liberadoNaoFaturado).toBe(5_000_000)
    expect(r.pendencias.avancoAFrente).toBe(6_000_000)
    expect(r.pendencias.avancoAFrentePP).toBeCloseTo(12, 6)
  })

  it('faturado à frente do liberado e liberado à frente do avanço: pendências nunca negativas', () => {
    const r = consolidarMargem({
      ...vazio, obras, avanco: 0.1,
      medicoesCliente: [{ obraId: 'm', situacao: 'aprovada', valorCentavos: 20_000_000 }],
      notas: [{ obraId: 'm', valor_centavos: 30_000_000, situacao: 'autorizada', devolvidaEm: null }],
    })
    expect(r.pendencias).toEqual({ liberadoNaoFaturado: 0, avancoAFrente: 0, avancoAFrentePP: 0 })
  })

  it('OS cancelada sai da receita esperada; OS sem valor conta em osSemReceita', () => {
    const r = consolidarMargem({
      ...vazio, avanco: 0.5,
      obras: [obras[0], { ...obras[1], cancelada: true }, { id: 'g', os: '100-B', paiId: 'm', receitaCentavos: null, cancelada: false, avanco: null }],
    })
    expect(r.total.receitaEsperada).toBe(40_000_000)
    expect(r.porOS[1].receitaEsperada).toBeNull()
    expect(r.porOS[1].cancelada).toBe(true)
    expect(r.osSemReceita).toBe(1)
  })
})

describe('consolidarMargem — custos e margem', () => {
  it('custo projetado = comprometido ÷ avanço; margem projetada e realizada (mockup)', () => {
    const r = consolidarMargem({
      ...vazio, avanco: 0.52,
      obras: [{ ...obras[0], receitaCentavos: 47_627_241, avanco: 0.52 }],
      compras: [{ obraId: 'm', status: 'emitido', total_centavos: 19_840_000, nf: '1' }],
      notas: [{ obraId: 'm', valor_centavos: 14_288_172, situacao: 'autorizada', devolvidaEm: null }],
    })
    expect(r.total.custoProjetado).toBe(38_153_846)
    expect(r.total.margemProjetada).toBe(47_627_241 - 38_153_846)
    expect(r.total.margemProjetadaPct).toBeCloseTo(19.89, 2)
    expect(r.total.margemRealizada).toBe(14_288_172 - 19_840_000)
  })

  it('aditivo sem avanço: margem projetada da OS null; total usa o avanço da obra', () => {
    const r = consolidarMargem({
      ...vazio, obras, avanco: 0.5,
      compras: [{ obraId: 'f', status: 'emitido', total_centavos: 1_000_000 }],
    })
    expect(r.porOS[1].custoProjetado).toBeNull()
    expect(r.porOS[1].margemProjetada).toBeNull()
    expect(r.total.custoProjetado).toBe(2_000_000)
  })

  it('vínculos somam no custo e nas origens; vínculo de medição de fornecedor não soma (já está em Fornecedores)', () => {
    const r = consolidarMargem({
      ...vazio, obras, avanco: 0.5,
      fornecedores: [{ obraId: 'm', status: 'paga', valorCentavos: 300_000 }],
      vinculos: [
        vin({ pagamentoSituacao: 'pago' }),
        vin({ deMedicaoFornecedor: true, valorCentavos: 300_000, pagamentoSituacao: 'pago' }),
        vin({ origem: 'caixinha_despesa', valorCentavos: 5_000, relatorioStatus: 'PAGO', etapa: null, solicitacaoValorCentavos: null }),
        vin({ obraId: 'f', origem: 'caixinha_despesa', valorCentavos: 7_000, relatorioStatus: 'ENVIADO', etapa: null }),
        vin({ obraId: 'outra', valorCentavos: 9_999_999 }),
      ],
    })
    expect(r.origens.fornecedores).toEqual({ comprometido: 300_000, realizado: 300_000, pago: 300_000 })
    expect(r.origens.pagamentos).toEqual({ comprometido: 100_000, realizado: 100_000, pago: 100_000 })
    expect(r.origens.caixinha).toEqual({ comprometido: 12_000, realizado: 5_000, pago: 5_000 })
    expect(r.total.custoComprometido).toBe(412_000)
    expect(r.porOS[0].custoComprometido).toBe(405_000)
    expect(r.porOS[1].custoComprometido).toBe(7_000)
    expect(r.vinculosDeMedicaoFornecedor).toBe(1)
  })

  it('compras de locação vão para a origem Locações, sem contar duas vezes', () => {
    const r = consolidarMargem({
      ...vazio, obras, avanco: 0.5,
      compras: [
        { obraId: 'm', status: 'emitido', total_centavos: 10_000, nf: '1' },
        { obraId: 'm', status: 'emitido', total_centavos: 5_000, locacao: true },
      ],
    })
    expect(r.origens.compras).toEqual({ comprometido: 10_000, realizado: 10_000, pago: 0 })
    expect(r.origens.locacoes).toEqual({ comprometido: 5_000, realizado: 0, pago: 0 })
    expect(r.total.custoComprometido).toBe(15_000)
  })

  it('soma das origens = total', () => {
    const r = consolidarMargem({
      ...vazio, obras, avanco: 0.5,
      compras: [{ obraId: 'm', status: 'emitido', total_centavos: 10_000, pago_em: '2026-10-01' }, { obraId: 'f', status: 'emitido', total_centavos: 2_000, locacao: true }],
      fornecedores: [{ obraId: 'f', status: 'aprovada', valorCentavos: 3_000 }],
      vinculos: [vin({ valorCentavos: 4_000 }), vin({ origem: 'caixinha_despesa', valorCentavos: 500, relatorioStatus: 'APROVADO', etapa: null })],
    })
    const o = Object.values(r.origens)
    expect(o.reduce((s, x) => s + x.comprometido, 0)).toBe(r.total.custoComprometido)
    expect(o.reduce((s, x) => s + x.realizado, 0)).toBe(r.total.custoRealizado)
    expect(o.reduce((s, x) => s + x.pago, 0)).toBe(r.total.custoPago)
  })

  it('valor não numérico no vínculo lança (o bloco cai inteiro, nunca vira 0)', () => {
    expect(() => consolidarMargem({ ...vazio, obras, avanco: 0.5, vinculos: [vin({ valorCentavos: NaN })] })).toThrow()
  })
})

describe('custoDoVinculo', () => {
  it('solicitação: aguardando = só comprometido; lançada = realizado; pago/parcial proporcional', () => {
    expect(custoDoVinculo(vin({ etapa: 'aguardando_diretor' }))).toEqual({ comprometido: 100_000, realizado: 0, pago: 0 })
    expect(custoDoVinculo(vin({ etapa: 'lancada' }))).toEqual({ comprometido: 100_000, realizado: 100_000, pago: 0 })
    expect(custoDoVinculo(vin({ pagamentoSituacao: 'pago' }))).toEqual({ comprometido: 100_000, realizado: 100_000, pago: 100_000 })
    expect(custoDoVinculo(vin({ valorCentavos: 50_000, pagamentoSituacao: 'parcial', valorPagoCentavos: 40_000, solicitacaoValorCentavos: 100_000 })))
      .toEqual({ comprometido: 50_000, realizado: 50_000, pago: 20_000 })
    expect(custoDoVinculo(vin({ pagamentoSituacao: 'parcial', valorPagoCentavos: 500_000 })).pago).toBe(100_000)
    expect(custoDoVinculo(vin({ pagamentoSituacao: 'parcial', valorPagoCentavos: 10, solicitacaoValorCentavos: 0 })).pago).toBe(0)
    expect(custoDoVinculo(vin({ pagamentoSituacao: 'estornado' })).pago).toBe(0)
  })
  it('recusada/cancelada não conta, salvo se já foi paga (dinheiro real nunca some)', () => {
    expect(custoDoVinculo(vin({ etapa: 'recusada' }))).toEqual({ comprometido: 0, realizado: 0, pago: 0 })
    expect(custoDoVinculo(vin({ etapa: 'cancelada', pagamentoSituacao: 'pago' }))).toEqual({ comprometido: 100_000, realizado: 100_000, pago: 100_000 })
  })
  it('caixinha: reprovado não conta; aprovado = realizado; pago = pago', () => {
    const cx = (s: string | null) => custoDoVinculo(vin({ origem: 'caixinha_despesa', relatorioStatus: s, etapa: null }))
    expect(cx('REPROVADO')).toEqual({ comprometido: 0, realizado: 0, pago: 0 })
    expect(cx('ENVIADO')).toEqual({ comprometido: 100_000, realizado: 0, pago: 0 })
    expect(cx(null)).toEqual({ comprometido: 100_000, realizado: 0, pago: 0 })
    expect(cx('APROVADO')).toEqual({ comprometido: 100_000, realizado: 100_000, pago: 0 })
    expect(cx('PAGO')).toEqual({ comprometido: 100_000, realizado: 100_000, pago: 100_000 })
  })
})
