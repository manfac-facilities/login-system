// Consolidação financeira da obra (pura). Valores em centavos inteiros.
//
// Mapeamento esperado (Task 3) das linhas das funcoes SQL para estes tipos:
//  - CompraPedido: um pedido por linha (cmp_pedidos). status = situacao
//    (na_fila|gravando|emitido|falha; so 'emitido' conta); total_centavos = total do pedido
//    (ja em centavos); nf = nf_numero; pago_em = pago_em.
//  - MedicaoFornecedor: frn_medicoes. ATENCAO: frn_medicoes.valor e numeric em REAIS; a Task 3
//    converte com Math.round(valor * 100) ANTES de chamar e passa em valorCentavos.
//  - NotaObra: uma linha por nota x obra (fin_fat_nota_obras.valor_centavos = parcela da obra);
//    situacao = fin_fat_notas.situacao; devolvidaEm = fin_fat_notas.obras_devolvidas_em.
//    Receita so conta com situacao 'autorizada' ou 'enviada' E devolvidaEm nulo (falha fechada).
// Cada item pertence a UMA obra (obraId): mae e filha sao obras distintas, entao uma NF
// rateada entre mae e filha entra uma vez em cada, e o total soma cada parcela uma so vez.
// ObraRef.paiId e informativo (hierarquia para a tela); a consolidacao nao depende dele.

export type CompraPedido = {
  obraId: string
  status: string
  total_centavos: number
  nf?: string | null
  pago_em?: string | null
  // solicitacao de origem cancelada: so conta se ja tem nf ou pago_em (dinheiro real nunca some)
  cancelada?: boolean
  // solicitacao tipo 'locacao' (Fases B/C): mesma regra de custo, origem "Locacoes" na tela
  locacao?: boolean
  // CPF/CNPJ do fornecedor do pedido (so [0-9A-Z]); casa com o pagamento do Financeiro
  fornecedorDocumento?: string | null
}

export type StatusMedicao =
  | 'solicitada'
  | 'aprovada'
  | 'pagamento_solicitado'
  | 'paga'
  | 'devolvida'

export type MedicaoFornecedor = {
  obraId: string
  status: StatusMedicao
  valorCentavos: number
}

export type NotaObra = {
  obraId: string
  valor_centavos: number
  situacao: string
  devolvidaEm: string | null
}

export type ObraRef = { id: string; os: string; paiId: string | null }

export type Linha = {
  obraId: string | null
  os: string
  receitaRealizada: number
  custoComprometido: number
  custoRealizado: number
  custoPago: number
  margemRealizada: number
  margemPct: number | null
}

const NOTA_CONTA = new Set(['autorizada', 'enviada'])

function num(v: number): number {
  if (!Number.isFinite(v)) throw new Error('financeiro-obra: valor nao numerico')
  return Math.round(v)
}

function linha(obraId: string | null, os: string, r: number, c: number, re: number, p: number): Linha {
  const margemRealizada = r - re
  return {
    obraId,
    os,
    receitaRealizada: r,
    custoComprometido: c,
    custoRealizado: re,
    custoPago: p,
    margemRealizada,
    margemPct: r > 0 ? (margemRealizada / r) * 100 : null,
  }
}

export function consolidarFinanceiro(input: {
  compras: CompraPedido[]
  fornecedores: MedicaoFornecedor[]
  notas: NotaObra[]
  obras: ObraRef[]
}): { porOS: Linha[]; total: Linha } {
  const acc = new Map<string, { r: number; c: number; re: number; p: number }>()
  for (const o of input.obras) acc.set(o.id, { r: 0, c: 0, re: 0, p: 0 })

  for (const x of input.compras) {
    const a = acc.get(x.obraId)
    if (!a || x.status !== 'emitido') continue
    if (x.cancelada && !x.nf && !x.pago_em) continue
    const v = num(x.total_centavos)
    a.c += v
    if (x.nf || x.pago_em) a.re += v
    if (x.pago_em) a.p += v
  }
  for (const m of input.fornecedores) {
    const a = acc.get(m.obraId)
    if (!a) continue
    const v = num(m.valorCentavos)
    if (m.status === 'aprovada' || m.status === 'pagamento_solicitado' || m.status === 'paga') a.c += v
    if (m.status === 'pagamento_solicitado' || m.status === 'paga') a.re += v
    if (m.status === 'paga') a.p += v
  }
  for (const n of input.notas) {
    const a = acc.get(n.obraId)
    if (!a || n.devolvidaEm || !NOTA_CONTA.has(n.situacao)) continue
    a.r += num(n.valor_centavos)
  }

  const porOS = input.obras.map((o) => {
    const a = acc.get(o.id)!
    return linha(o.id, o.os, a.r, a.c, a.re, a.p)
  })
  const s = porOS.reduce(
    (t, l) => ({
      r: t.r + l.receitaRealizada,
      c: t.c + l.custoComprometido,
      re: t.re + l.custoRealizado,
      p: t.p + l.custoPago,
    }),
    { r: 0, c: 0, re: 0, p: 0 },
  )
  return { porOS, total: linha(null, 'Total', s.r, s.c, s.re, s.p) }
}

// ---------------------------------------------------------------------------
// Fases B/C (spec 2026-11-01 §2.3, §3 "Aba Financeiro"): receita esperada, liberado, faturado,
// pendencias, margem projetada e custos por origem. Puro; centavos inteiros; percentuais 0–100.
//
// Sem dupla contagem:
//  - Vinculo (obras_fin_vinculos) com deMedicaoFornecedor = pagamento gerado por medicao de
//    fornecedor, que ja conta em `fornecedores` → fica fora (so contado em vinculosDeMedicaoFornecedor).
//  - Pedido de locacao do Compras (locacao = true) sai da origem Compras e entra em Locacoes;
//    o custo da OS e o mesmo (uma vez so).
//  - Pagamento do Financeiro (vinculo de solicitacao) cujo fornecedorDocumento casa com o de um
//    pedido do Compras (inclusive locacao) da mesma familia = PAGAMENTO do pedido, nao custo a
//    mais: soma no realizado/pago da origem do pedido (e da OS do pedido) ate o valor do pedido;
//    so o excedente fica em "Pagamentos / rateio" (decisao M3 da revisao da Task 7).
//    Pedido JA PAGO no Compras (pago_em) nao absorve: o pagamento vira custo proprio — salvo se
//    for o MESMO pagamento visto dos dois lados (data do pagamento = dia BRT do pago_em), senao
//    todo pedido quitado pelo Financeiro contaria duas vezes depois que o Compras marca pago_em.

export type VinculoCusto = {
  obraId: string
  origem: 'solicitacao' | 'caixinha_despesa'
  /** Custo ATRIBUIDO a esta OS (obras_fin_vinculos.valor_centavos). */
  valorCentavos: number
  deMedicaoFornecedor: boolean
  /** fin_solicitacoes.etapa (solicitacao). */
  etapa: string | null
  /** fin_pagamentos_omie.situacao: pago|parcial|estornado|cancelado|null. */
  pagamentoSituacao: string | null
  valorPagoCentavos: number | null
  solicitacaoValorCentavos: number | null
  /** fin_caixinha_relatorios.status (caixinha). */
  relatorioStatus: string | null
  /** CPF/CNPJ do fornecedor da solicitacao (so [0-9A-Z]); null na caixinha. */
  fornecedorDocumento?: string | null
  /** fin_pagamentos_omie.data_pagamento (AAAA-MM-DD). */
  pagamentoData?: string | null
}

export type MedicaoCliente = { obraId: string; situacao: string; valorCentavos: number }

export type ObraMargem = ObraRef & {
  /** Valor receita da OS (centavos); null = nao informado. */
  receitaCentavos: number | null
  /** OS cancelada: fora da receita esperada. */
  cancelada: boolean
  /** Avanco fisico 0–1 da OS; null = sem cronograma/desconhecido. */
  avanco: number | null
}

export type Custo = { comprometido: number; realizado: number; pago: number }

export type LinhaMargem = Linha & {
  cancelada: boolean
  receitaEsperada: number | null
  liberado: number
  /** max(0, liberado − faturado) da OS; no total, a soma das OS. */
  liberadoNaoFaturado: number
  avanco: number | null
  custoProjetado: number | null
  margemProjetada: number | null
  margemProjetadaPct: number | null
}

export type OrigemCusto = 'compras' | 'fornecedores' | 'pagamentos' | 'caixinha' | 'locacoes'

export type MargemObra = {
  porOS: LinhaMargem[]
  total: LinhaMargem
  origens: Record<OrigemCusto, Custo>
  /** Percentuais 0–100 sobre a receita esperada (avanco: fisico da obra). */
  percentuais: { avanco: number | null; liberado: number | null; faturado: number | null }
  pendencias: { liberadoNaoFaturado: number; avancoAFrente: number | null; avancoAFrentePP: number | null }
  vinculosDeMedicaoFornecedor: number
  /** Vinculos tratados (no todo ou em parte) como pagamento de pedido do Compras. */
  vinculosComoPagamentoDePedido: number
  /** OS nao canceladas sem valor receita. */
  osSemReceita: number
}

const ZERO: Custo = { comprometido: 0, realizado: 0, pago: 0 }
const ETAPA_FORA = new Set(['recusada', 'cancelada'])

/** Dia (AAAA-MM-DD) em Brasilia de um timestamp; null se invalido. */
function diaBrt(ts: string): string | null {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

/** Avanco valido 0–1, ou null (NaN/Infinity/null nunca entram na conta). */
const avancoValido = (x: number | null): number | null =>
  x === null || !Number.isFinite(x) ? null : Math.min(1, Math.max(0, x))

/** Custo de um vinculo (pagamento/rateio ou caixinha) para a OS dele. */
export function custoDoVinculo(v: VinculoCusto): Custo {
  const val = num(v.valorCentavos)
  if (v.origem === 'caixinha_despesa') {
    const s = v.relatorioStatus
    if (s === 'REPROVADO') return { ...ZERO }
    return { comprometido: val, realizado: s === 'APROVADO' || s === 'PAGO' ? val : 0, pago: s === 'PAGO' ? val : 0 }
  }
  let pago = 0
  if (v.pagamentoSituacao === 'pago') pago = val
  else if (v.pagamentoSituacao === 'parcial') {
    const total = v.solicitacaoValorCentavos === null ? 0 : num(v.solicitacaoValorCentavos)
    const pg = v.valorPagoCentavos === null ? 0 : num(v.valorPagoCentavos)
    pago = total > 0 ? Math.min(val, Math.max(0, Math.round((val * pg) / total))) : 0
  }
  if (v.etapa !== null && ETAPA_FORA.has(v.etapa)) return pago > 0 ? { comprometido: pago, realizado: pago, pago } : { ...ZERO }
  return { comprometido: val, realizado: v.etapa === 'lancada' || pago > 0 ? val : 0, pago }
}

const soma = (a: Custo, b: Custo): Custo => ({ comprometido: a.comprometido + b.comprometido, realizado: a.realizado + b.realizado, pago: a.pago + b.pago })
const deLinha = (l: Linha): Custo => ({ comprometido: l.custoComprometido, realizado: l.custoRealizado, pago: l.custoPago })
const pctDe = (parte: number, base: number | null): number | null => (base !== null && base > 0 ? (parte / base) * 100 : null)

function linhaMargem(
  l: Linha, receita: number | null, liberado: number, avanco: number | null, cancelada: boolean,
  liberadoNaoFaturado: number, comprometidoProjecao: number = l.custoComprometido,
): LinhaMargem {
  const custoProjetado = avanco !== null && avanco > 0 ? Math.round(comprometidoProjecao / avanco) : null
  const margemProjetada = receita !== null && custoProjetado !== null ? receita - custoProjetado : null
  return {
    ...l,
    cancelada,
    receitaEsperada: receita,
    liberado,
    liberadoNaoFaturado,
    avanco,
    custoProjetado,
    margemProjetada,
    margemProjetadaPct: margemProjetada !== null ? pctDe(margemProjetada, receita) : null,
  }
}

/**
 * `obras`: a obra aberta e as filhas; `avanco`: avanco fisico (0–1) da obra aberta, usado no
 * total (custo projetado = comprometido ÷ avanco). Itens de OS fora da lista sao ignorados.
 */
export function consolidarMargem(input: {
  compras: CompraPedido[]
  fornecedores: MedicaoFornecedor[]
  notas: NotaObra[]
  vinculos: VinculoCusto[]
  medicoesCliente: MedicaoCliente[]
  obras: ObraMargem[]
  avanco: number | null
}): MargemObra {
  const ids = new Set(input.obras.map((o) => o.id))
  const base = consolidarFinanceiro({ compras: input.compras, fornecedores: input.fornecedores, notas: input.notas, obras: input.obras })
  const so = (p: { compras?: CompraPedido[]; fornecedores?: MedicaoFornecedor[] }) =>
    deLinha(consolidarFinanceiro({ compras: p.compras ?? [], fornecedores: p.fornecedores ?? [], notas: [], obras: input.obras }).total)

  const extra = new Map<string, Custo>()
  const origens: Record<OrigemCusto, Custo> = {
    compras: so({ compras: input.compras.filter((c) => !c.locacao) }),
    fornecedores: so({ fornecedores: input.fornecedores }),
    pagamentos: { ...ZERO },
    caixinha: { ...ZERO },
    locacoes: so({ compras: input.compras.filter((c) => c.locacao) }),
  }
  // Pedidos que contam (mesma regra da Fase A) e têm documento: capacidade para casar pagamentos.
  type Vaga = { obraId: string; origem: 'compras' | 'locacoes'; cap: number; folgaRe: number; folgaP: number; diaPago: string | null }
  const vagasPorDoc = new Map<string, Vaga[]>()
  for (const c of input.compras) {
    if (!ids.has(c.obraId) || c.status !== 'emitido' || !c.fornecedorDocumento) continue
    if (c.cancelada && !c.nf && !c.pago_em) continue
    const t = num(c.total_centavos)
    const vaga: Vaga = {
      obraId: c.obraId, origem: c.locacao ? 'locacoes' : 'compras', cap: t,
      folgaRe: c.nf || c.pago_em ? 0 : t, folgaP: c.pago_em ? 0 : t,
      diaPago: c.pago_em ? (diaBrt(c.pago_em) ?? '?') : null,
    }
    vagasPorDoc.set(c.fornecedorDocumento, [...(vagasPorDoc.get(c.fornecedorDocumento) ?? []), vaga])
  }

  let vinculosDeMedicaoFornecedor = 0
  let vinculosComoPagamentoDePedido = 0
  for (const v of input.vinculos) {
    if (!ids.has(v.obraId)) continue
    if (v.deMedicaoFornecedor) {
      vinculosDeMedicaoFornecedor++
      continue
    }
    const c = custoDoVinculo(v)
    const k = v.origem === 'caixinha_despesa' ? 'caixinha' : 'pagamentos'
    let resto = c
    const dia = v.pagamentoData ? v.pagamentoData.slice(0, 10) : null
    // Pedido em aberto, ou pago no MESMO dia deste pagamento (é ele mesmo).
    const vagas = (v.origem === 'solicitacao' && v.fornecedorDocumento ? (vagasPorDoc.get(v.fornecedorDocumento) ?? []) : [])
      .filter((x) => x.diaPago === null || (dia !== null && x.diaPago === dia))
    if (c.comprometido > 0 && vagas.some((x) => x.cap > 0)) {
      let restC = c.comprometido
      let usadoRe = 0
      let usadoP = 0
      for (const x of vagas) {
        if (restC <= 0) break
        const a = Math.min(restC, x.cap)
        if (a <= 0) continue
        x.cap -= a
        restC -= a
        const f = a / c.comprometido
        const re = Math.min(c.realizado - usadoRe, Math.round(c.realizado * f))
        const pg = Math.min(c.pago - usadoP, Math.round(c.pago * f))
        usadoRe += re
        usadoP += pg
        // O pedido já conta o comprometido; o pagamento só completa realizado/pago, até o valor do pedido.
        const addRe = Math.min(re, x.folgaRe)
        const addP = Math.min(pg, x.folgaP)
        x.folgaRe -= addRe
        x.folgaP -= addP
        const add: Custo = { comprometido: 0, realizado: addRe, pago: addP }
        origens[x.origem] = soma(origens[x.origem], add)
        extra.set(x.obraId, soma(extra.get(x.obraId) ?? ZERO, add))
      }
      vinculosComoPagamentoDePedido++
      const exRe = Math.min(restC, Math.max(0, c.realizado - usadoRe))
      resto = { comprometido: restC, realizado: exRe, pago: Math.min(exRe, Math.max(0, c.pago - usadoP)) }
    }
    origens[k] = soma(origens[k], resto)
    extra.set(v.obraId, soma(extra.get(v.obraId) ?? ZERO, resto))
  }

  // Liberado: só OS não cancelada (a receita dela saiu da conta).
  const canceladas = new Set(input.obras.filter((o) => o.cancelada).map((o) => o.id))
  const liberadoPor = new Map<string, number>()
  for (const m of input.medicoesCliente) {
    if (!ids.has(m.obraId) || canceladas.has(m.obraId) || m.situacao !== 'aprovada') continue
    liberadoPor.set(m.obraId, (liberadoPor.get(m.obraId) ?? 0) + num(m.valorCentavos))
  }

  const porOS = input.obras.map((o, i) => {
    const b = base.porOS[i]
    const c = soma(deLinha(b), extra.get(o.id) ?? ZERO)
    const l = linha(o.id, o.os, b.receitaRealizada, c.comprometido, c.realizado, c.pago)
    const receita = o.cancelada || o.receitaCentavos === null ? null : num(o.receitaCentavos)
    const lib = liberadoPor.get(o.id) ?? 0
    return linhaMargem(l, receita, lib, avancoValido(o.avanco), o.cancelada, o.cancelada ? 0 : Math.max(0, lib - b.receitaRealizada))
  })

  // Margem projetada e percentuais só sobre as OS com valor receita (M1): custo, liberado e
  // faturado de OS sem valor não entram na régua, senão a margem sai subestimada.
  const receitas = porOS.filter((l) => l.receitaEsperada !== null)
  const receitaTotal = receitas.length ? receitas.reduce((s, l) => s + (l.receitaEsperada as number), 0) : null
  const somar = (ls: LinhaMargem[]) => ls.reduce(
    (a, l) => ({
      r: a.r + l.receitaRealizada, c: a.c + l.custoComprometido, re: a.re + l.custoRealizado, p: a.p + l.custoPago,
      lib: a.lib + l.liberado, lnf: a.lnf + l.liberadoNaoFaturado,
    }),
    { r: 0, c: 0, re: 0, p: 0, lib: 0, lnf: 0 },
  )
  const t = somar(porOS)
  const comValor = receitaTotal === null ? t : somar(receitas)
  const avanco = avancoValido(input.avanco)
  const total = linhaMargem(linha(null, 'Total', t.r, t.c, t.re, t.p), receitaTotal, t.lib, avanco, false, t.lnf, comValor.c)

  const pctLiberado = pctDe(comValor.lib, receitaTotal)
  const comReceita = receitaTotal !== null && receitaTotal > 0 && avanco !== null
  return {
    porOS,
    total,
    origens,
    percentuais: { avanco: avanco === null ? null : avanco * 100, liberado: pctLiberado, faturado: pctDe(comValor.r, receitaTotal) },
    pendencias: {
      liberadoNaoFaturado: t.lnf,
      avancoAFrente: comReceita ? Math.max(0, Math.round((avanco as number) * (receitaTotal as number)) - comValor.lib) : null,
      avancoAFrentePP: comReceita ? Math.max(0, (avanco as number) * 100 - (pctLiberado as number)) : null,
    },
    vinculosDeMedicaoFornecedor,
    vinculosComoPagamentoDePedido,
    osSemReceita: input.obras.filter((o) => !o.cancelada && o.receitaCentavos === null).length,
  }
}
