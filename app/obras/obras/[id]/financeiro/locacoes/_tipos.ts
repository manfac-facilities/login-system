/** Locações da obra (Fases B/C §2.9): linhas de `obras_fin_locacoes` → tela. Puro. */

export type Resultado = { ok: true } | { ok: false; erro: string }

export type Locacao = {
  pedidoId: string
  obraId: string
  os: string | null
  item: string
  solicitacaoNumero: number | null
  fornecedor: string | null
  /** Centavos; null para quem não vê valores (a função já devolve NULL). */
  totalCentavos: number | null
  inicio: string | null
  locacaoFim: string | null
  fim: string | null
  semPeriodo: boolean
  estado: 'ativa' | 'renovada' | 'devolvida'
  devolvidaEm: string | null
  renovadaAte: string | null
}

const txt = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))
const numOuNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}
const ESTADOS = new Set(['ativa', 'renovada', 'devolvida'])

export function montarLocacoes(linhas: Record<string, unknown>[]): Locacao[] {
  return linhas.map((r) => {
    const numero = numOuNull(r.solicitacao_numero)
    const estado = String(r.estado ?? 'ativa')
    return {
      pedidoId: String(r.pedido_id),
      obraId: String(r.obra_id),
      os: txt(r.obra_os),
      item: txt(r.solicitacao_motivo) ?? (numero !== null ? `Solicitação nº ${numero}` : 'Locação'),
      solicitacaoNumero: numero,
      fornecedor: txt(r.fornecedor_razao_social),
      totalCentavos: numOuNull(r.total_centavos),
      inicio: txt(r.inicio),
      locacaoFim: txt(r.locacao_fim),
      fim: txt(r.fim),
      semPeriodo: r.sem_periodo === true || !txt(r.fim),
      estado: (ESTADOS.has(estado) ? estado : 'ativa') as Locacao['estado'],
      devolvidaEm: txt(r.devolvida_em),
      renovadaAte: txt(r.renovada_ate),
    }
  })
}

/** O que a faixa de alertas do painel precisa (sem valor). */
export const itensDeLocacao = (linhas: Record<string, unknown>[]) =>
  montarLocacoes(linhas).map((l) => ({ item: l.item, fim: l.fim, estado: l.estado }))
