/**
 * Restrição de Material ligada a um pedido do Compras (Financeiro da obra, Fase A, spec §3).
 * Puro. Os dados vêm de `obras_restricao_pedidos(p_obra)` — SEM valores — chamada sempre com o
 * cliente da SESSÃO (com o admin a função devolve vazio).
 *
 * Entregue = o Compras confirmou a entrega (`entrega_situacao` confirmada/resolvida com data).
 * Divergência não conta. Entregue NÃO libera a restrição: só mostra o selo "Pronta para liberar"
 * e o engenheiro confirma (recomendação 9).
 */
import type { Restricao } from './last-planner'

export type PedidoDaRestricao = {
  pedidoId: string
  solicitacaoNumero: number | null
  pedidoSequencia: number | null
  fornecedor: string | null
  situacao: string | null
  previsaoEntrega: string | null
  entregaSituacao: string | null
  entregaEm: string | null
}

type Linha = Record<string, unknown>
const s = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))
const n = (v: unknown) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))

export function pedidoDeLinha(l: Linha): PedidoDaRestricao {
  return {
    pedidoId: String(l.pedido_id),
    solicitacaoNumero: n(l.solicitacao_numero),
    pedidoSequencia: n(l.pedido_sequencia),
    fornecedor: s(l.fornecedor_razao_social),
    situacao: s(l.pedido_situacao),
    previsaoEntrega: s(l.previsao_entrega),
    entregaSituacao: s(l.entrega_situacao),
    entregaEm: s(l.entrega_em),
  }
}

export const pedidoEntregue = (p: PedidoDaRestricao | null | undefined): boolean =>
  !!p && !!p.entregaEm && (p.entregaSituacao === 'confirmada' || p.entregaSituacao === 'resolvida')

/** Selo "Pronta para liberar": pedido ligado e entregue, restrição ainda não liberada. */
export const prontaParaLiberar = (r: Restricao): boolean => r.situacao !== 'liberada' && pedidoEntregue(r.pedido)

const fmtDia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
/** `YYYY-MM-DD` ou timestamp → dd/mm/aaaa (Brasília). */
export function diaBr(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`
  return fmtDia.format(new Date(v))
}

/** Dia (YYYY-MM-DD) de Brasília de um timestamp; data pura passa direto. */
export function diaIso(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(v))
}

/** "previsto 05/11/2026 · entregue 04/11/2026" (ou "entrega pendente"). */
export function textoDatasPedido(p: PedidoDaRestricao): string {
  const previsto = p.previsaoEntrega ? `previsto ${diaBr(p.previsaoEntrega)}` : 'sem previsão'
  const entrega = pedidoEntregue(p) ? `entregue ${diaBr(p.entregaEm!)}` : p.entregaSituacao === 'divergencia' ? 'entrega com divergência' : 'entrega pendente'
  return `${previsto} · ${entrega}`
}

export function rotuloPedido(p: PedidoDaRestricao): string {
  const num = p.solicitacaoNumero !== null ? `Solicitação ${p.solicitacaoNumero}${p.pedidoSequencia !== null && p.pedidoSequencia > 1 ? `-${p.pedidoSequencia}` : ''}` : 'Pedido'
  return [num, p.fornecedor, p.previsaoEntrega ? `previsto ${diaBr(p.previsaoEntrega)}` : null].filter(Boolean).join(' · ')
}

/**
 * Para os textos de portal/semanal/analista: com pedido ligado, o prazo vira a previsão de entrega
 * do pedido e o "liberada em" vira a data de entrega (quando entregue). A situação NÃO muda.
 */
export function comDatasDoPedido(rs: Restricao[]): Restricao[] {
  return rs.map((r) => {
    if (!r.pedido) return r
    return {
      ...r,
      prazo: r.pedido.previsaoEntrega ?? r.prazo,
      liberadaEm: pedidoEntregue(r.pedido) ? diaIso(r.pedido.entregaEm!) : r.liberadaEm,
    }
  })
}
