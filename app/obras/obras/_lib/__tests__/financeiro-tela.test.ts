import { brl, montarFinanceiro, pctTexto, type ObraFin } from '../financeiro-tela'

const MAE = 'mae'
const FILHA = 'filha'
const obras: ObraFin[] = [
  { id: MAE, os: '0526-1', loja: 'Macaé 3', paiId: null },
  { id: FILHA, os: '0526-2', loja: 'Macaé 3 aditivo', paiId: MAE },
]
const pedido = (over: Record<string, unknown> = {}) => ({
  obra_id: MAE, obra_os: '0526-1', solicitacao_id: 's1', solicitacao_numero: 42, solicitacao_tipo: 'material',
  solicitacao_etapa: 'concluida', solicitacao_motivo: 'Porcelanato', valor_estimado_centavos: 90000,
  pedido_id: 'p1', pedido_sequencia: 1, fornecedor_razao_social: 'Casa Forte', pedido_situacao: 'emitido',
  total_centavos: 100000, previsao_entrega: '2026-11-05', entrega_situacao: 'pendente', entrega_em: null,
  nf_numero: null, pago_em: null, ...over,
})
const medicao = (over: Record<string, unknown> = {}) => ({
  obra_id: MAE, obra_os: '0526-1', contrato_id: 'c1', contrato_numero: 'CT-1', contrato_status: 'aprovado',
  fornecedor_razao_social: 'Eletro Ltda', valor_mo_reais: 1000.5, valor_mat_reais: 0, aditivos_mo_reais: 0, aditivos_mat_reais: 0,
  medicao_id: 'm1', medicao_numero: '1', medicao_item: 'mo', medicao_valor_reais: 200.25, medicao_status: 'paga', ...over,
})
const nota = (over: Record<string, unknown> = {}) => ({
  obra_id: MAE, obra_os: '0526-1', nota_id: 'n1', parcela_centavos: 300000, nota_valor_total_centavos: 500000,
  nota_situacao: 'autorizada', nfse_numero: '77', tomador_nome: 'DPSP', obras_devolvidas_em: null, ...over,
})

describe('montarFinanceiro', () => {
  it('obra sem nenhum dado: "sem lançamentos", zeros e nenhum NaN (Review Focus 3)', () => {
    const f = montarFinanceiro({ obraId: MAE, obras: [obras[0]], compras: [], fornecedores: [], notas: [] })
    expect(f.semLancamentos).toBe(true)
    expect(f.resumo.ok).toBe(true)
    if (!f.resumo.ok) return
    const t = f.resumo.dados.total
    expect([t.receitaRealizada, t.custoComprometido, t.custoRealizado, t.custoPago, t.margemRealizada]).toEqual([0, 0, 0, 0, 0])
    expect(t.margemPct).toBeNull()
    expect(pctTexto(t.margemPct)).toBe('—')
    expect(brl(t.receitaRealizada)).not.toMatch(/NaN/)
    expect(f.compras).toEqual({ ok: true, dados: [] })
  })

  it('mãe + filha: NF rateada entra uma vez em cada OS e o total soma as parcelas, nunca o total da NF', () => {
    const f = montarFinanceiro({
      obraId: MAE, obras, compras: [], fornecedores: [],
      notas: [nota(), nota({ obra_id: FILHA, obra_os: '0526-2', parcela_centavos: 200000 })],
    })
    if (!f.resumo.ok) throw new Error('resumo')
    expect(f.resumo.dados.porOS.map((l) => [l.papel, l.receitaRealizada])).toEqual([['mae', 300000], ['aditivo', 200000]])
    expect(f.resumo.dados.total.receitaRealizada).toBe(500000)
  })

  it('frn em reais vira centavos; saldo = contrato − medições aprovadas ou além', () => {
    const f = montarFinanceiro({
      obraId: MAE, obras, compras: [], notas: [],
      fornecedores: [medicao(), medicao({ medicao_id: 'm2', medicao_valor_reais: 50, medicao_status: 'solicitada' })],
    })
    if (!f.fornecedores.ok || !f.resumo.ok) throw new Error('blocos')
    const c = f.fornecedores.dados[0]
    expect(c.valorCentavos).toBe(100050)
    expect(c.medidoCentavos).toBe(20025)
    expect(c.saldoCentavos).toBe(80025)
    expect(c.medicoes).toHaveLength(2)
    expect(f.resumo.dados.porOS[0].custoPago).toBe(20025)
  })

  it('compras: link "abrir no Compras" pelo número da solicitação; solicitação cancelada não entra no custo', () => {
    const f = montarFinanceiro({
      obraId: MAE, obras, fornecedores: [], notas: [],
      compras: [pedido(), pedido({ solicitacao_id: 's2', solicitacao_numero: 43, pedido_id: 'p2', solicitacao_etapa: 'cancelada' })],
    })
    if (!f.compras.ok || !f.resumo.ok) throw new Error('blocos')
    expect(f.compras.dados[0].link).toBe('/compras/solicitacoes/42')
    expect(f.compras.dados[1].status).toBe('Cancelada')
    expect(f.resumo.dados.total.custoComprometido).toBe(100000)
  })

  it('dado inconsistente degrada só o bloco: total não numérico derruba Compras e Resumo, Faturamento segue', () => {
    const f = montarFinanceiro({
      obraId: MAE, obras, fornecedores: [], notas: [nota()],
      compras: [pedido({ total_centavos: 'abc' })],
    })
    expect(f.compras).toEqual({ ok: false })
    expect(f.resumo).toEqual({ ok: false })
    expect(f.faturamento.ok).toBe(true)
  })

  it('nota com parcela NULL: fora da receita, listada como não informada, Resumo avisa e não cai', () => {
    const f = montarFinanceiro({
      obraId: MAE, obras, compras: [], fornecedores: [],
      notas: [nota(), nota({ nota_id: 'n2', parcela_centavos: null }), nota({ nota_id: 'n3', parcela_centavos: null, nota_situacao: 'rascunho' })],
    })
    expect(f.resumo.ok).toBe(true)
    if (!f.resumo.ok) return
    expect(f.resumo.dados.total.receitaRealizada).toBe(300000)
    expect(f.resumo.dados.notasSemParcela).toBe(1)
    expect(f.faturamento.ok && f.faturamento.dados.map((n) => [n.parcelaCentavos, n.contaNaReceita])).toEqual([[300000, true], [null, false], [null, false]])
  })

  it('pedido emitido sem total (null) é inconsistente, não vira R$ 0', () => {
    const f = montarFinanceiro({ obraId: MAE, obras, fornecedores: [], notas: [], compras: [pedido({ total_centavos: null })] })
    expect(f.resumo).toEqual({ ok: false })
  })

  it('linha de obra que não é a aberta nem filha é ignorada', () => {
    const f = montarFinanceiro({ obraId: MAE, obras, compras: [], fornecedores: [], notas: [nota({ obra_id: 'outra' })] })
    expect(f.semLancamentos).toBe(true)
  })

  it('brl formata centavos em R$', () => {
    expect(brl(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
  })
})

describe('montarFinanceiro — Fases B/C', () => {
  const obrasBC: ObraFin[] = [
    { ...obras[0], receitaCentavos: 40_000_000 },
    { ...obras[1], receitaCentavos: 10_000_000 },
  ]
  const vinculo = (over: Record<string, unknown> = {}) => ({
    obra_id: MAE, obra_os: '0526-1', vinculo_id: 'v1', origem: 'solicitacao', valor_centavos: 50_000, vinculo_valor_centavos: 50_000,
    solicitacao_etapa: 'lancada', solicitacao_valor_centavos: 50_000, pagamento_situacao: 'pago', pagamento_valor_pago_centavos: 50_000,
    frn_medicao_id: null, de_medicao_fornecedor: false, relatorio_status: null, ...over,
  })

  it('receita esperada, liberado e avanço chegam ao resumo; vínculo de medição de fornecedor não soma', () => {
    const f = montarFinanceiro({
      obraId: MAE, obras: obrasBC, compras: [], notas: [], avanco: 0.5,
      fornecedores: [medicao()],
      vinculos: [vinculo(), vinculo({ vinculo_id: 'v2', de_medicao_fornecedor: true, valor_centavos: 20_025 })],
      medicoesCliente: [{ obra_id: MAE, situacao: 'aprovada', valor_centavos: 10_000_000 }, { obra_id: 'outra', situacao: 'aprovada', valor_centavos: 1 }],
    })
    if (!f.resumo.ok) throw new Error('resumo')
    expect(f.resumo.dados.total.receitaEsperada).toBe(50_000_000)
    expect(f.resumo.dados.total.liberado).toBe(10_000_000)
    expect(f.resumo.dados.porOS[0].avanco).toBe(0.5)
    expect(f.resumo.dados.porOS[1].avanco).toBeNull()
    expect(f.resumo.dados.origens.pagamentos.comprometido).toBe(50_000)
    expect(f.resumo.dados.total.custoComprometido).toBe(50_000 + 20_025)
    expect(f.resumo.dados.vinculosDeMedicaoFornecedor).toBe(1)
    expect(f.semLancamentos).toBe(false)
  })

  it('vínculo com valor não numérico derruba o resumo (falha fechada)', () => {
    const f = montarFinanceiro({ obraId: MAE, obras: obrasBC, compras: [], notas: [], fornecedores: [], vinculos: [vinculo({ valor_centavos: null })] })
    expect(f.resumo).toEqual({ ok: false })
  })

  it('pedido de locação vai para Locações; pendências: sem entrega, medição atrasada, caixinha sem obra, locação vencendo', () => {
    const f = montarFinanceiro({
      obraId: MAE, obras: obrasBC, notas: [], fornecedores: [],
      compras: [
        pedido(),
        pedido({ pedido_id: 'p2', entrega_situacao: 'confirmada' }),
        pedido({ pedido_id: 'p3', solicitacao_tipo: 'locacao', total_centavos: 5_000 }),
        pedido({ pedido_id: 'p4', solicitacao_etapa: 'cancelada' }),
      ],
      medicoesFornecedorAtrasadas: [{ obra_id: MAE, dias_aguardando: 12 }, { obra_id: FILHA, dias_aguardando: 15 }, { obra_id: 'outra', dias_aguardando: 99 }],
      caixinhaSemObra: 3,
      locacoes: [{ item: 'Andaime', fim: '2026-11-05', estado: 'ativa' }, { item: 'Betoneira', fim: null, estado: 'ativa' }],
      hoje: '2026-11-02',
    })
    if (!f.resumo.ok) throw new Error('resumo')
    expect(f.resumo.dados.origens.locacoes.comprometido).toBe(5_000)
    expect(f.resumo.dados.origens.compras.comprometido).toBe(200_000)
    expect(f.pendencias).toEqual({
      comprasSemEntrega: 1,
      medicoesFornecedorAtrasadas: { quantidade: 2, maisDias: 15 },
      caixinhaSemObra: 3,
      locacoes: { quantidade: 1, primeira: 'Andaime vence em 3 dias úteis (05/11)', urgente: false },
    })
  })

  it('leituras de pendência que falharam ficam null (não viram zero)', () => {
    const f = montarFinanceiro({ obraId: MAE, obras: obrasBC, compras: [], notas: [], fornecedores: [], medicoesFornecedorAtrasadas: null, caixinhaSemObra: null, locacoes: null })
    expect(f.pendencias).toEqual({ comprasSemEntrega: 0, medicoesFornecedorAtrasadas: null, caixinhaSemObra: null, locacoes: null })
  })
})
