// Consolidação financeira da obra (pura). Valores em centavos inteiros.
//
// Mapeamento esperado (Task 3) das linhas das funções SQL para estes tipos:
//  - CompraPedido: um pedido por linha (cmp_pedidos). status = situacao do pedido
//    ('emitido' conta; na_fila|gravando|falha|cancelado|cancelada nunca contam);
//    total_centavos = total do pedido; nf = nf_numero; pago_em = pago_em.
//  - MedicaoFornecedor: frn_medicoes (valor_centavos, status da medição).
//  - NotaObra: uma linha por nota x obra (fin_fat_nota_obras.valor_centavos = parcela da obra);
//    status = situação da nota; 'cancelada'|'devolvida' nunca contam.
// Cada item pertence a UMA obra (obraId): mãe e filha são obras distintas, então uma NF
// rateada entre mãe e filha entra uma vez em cada, e o total soma cada parcela uma só vez.

export type CompraPedido = {
  obraId: string
  os: string
  status: string
  total_centavos: number
  nf?: string | null
  pago_em?: string | null
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
  valor_centavos: number
}

export type NotaObra = {
  obraId: string
  valor_centavos: number
  status?: string | null
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

const NOTA_IGNORADA = new Set(['cancelada', 'cancelado', 'devolvida', 'devolvido'])

function num(v: number): number {
  return Number.isFinite(v) ? Math.round(v) : 0
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
    const v = num(x.total_centavos)
    a.c += v
    if (x.nf || x.pago_em) a.re += v
    if (x.pago_em) a.p += v
  }
  for (const m of input.fornecedores) {
    const a = acc.get(m.obraId)
    if (!a) continue
    const v = num(m.valor_centavos)
    if (m.status === 'aprovada' || m.status === 'pagamento_solicitado' || m.status === 'paga') a.c += v
    if (m.status === 'pagamento_solicitado' || m.status === 'paga') a.re += v
    if (m.status === 'paga') a.p += v
  }
  for (const n of input.notas) {
    const a = acc.get(n.obraId)
    if (!a || (n.status && NOTA_IGNORADA.has(n.status.toLowerCase()))) continue
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
