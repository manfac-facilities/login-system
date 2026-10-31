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
