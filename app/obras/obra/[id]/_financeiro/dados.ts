import type { SupabaseClient } from '@supabase/supabase-js'
import { montarFinanceiro, type Financeiro, type ObraFin } from '../../../obras/_lib/financeiro-tela'
import { receitaEmCentavos } from '../../../obras/_lib/medicao'
import { itensDeLocacao, montarLocacoes, type Locacao } from '../../../obras/[id]/financeiro/locacoes/_tipos'
import { resumoSpot, type NotaExterna, type ResumoSpot } from './resumo-spot'

export type FinanceiroSpot =
  | { ok: true; lidoEm: string; fin: Financeiro; resumo: ResumoSpot; locacoes: Locacao[]; externas: NotaExterna[] }
  | { ok: false; motivo: 'sem-permissao' | 'leitura' }

const leitura = { ok: false as const, motivo: 'leitura' as const }

/** Financeiro da OS SPOT. Cliente da SESSÃO (com o admin as RPCs devolvem vazio, sem erro). */
export async function lerFinanceiroSpot(
  supabase: SupabaseClient,
  obra: { id: string; valor: number | null; etapa: string; fat_nfse: string | null },
  hoje: string,
): Promise<FinanceiroSpot> {
  const id = obra.id
  // Falha fechada: erro, null ou qualquer coisa diferente de true → sem valores.
  const { data: pode, error: ePode } = await supabase.rpc('obras_pode_ver_valores', { p_obra: id })
  if (ePode || pode !== true) return { ok: false, motivo: 'sem-permissao' }

  const [cR, fR, nR, vR, cxR, lR, atR, exR] = await Promise.all([
    supabase.rpc('obras_fin_compras', { p_obra: id }),
    supabase.rpc('obras_fin_fornecedores', { p_obra: id }),
    supabase.rpc('obras_fin_notas', { p_obra: id }),
    supabase.rpc('obras_fin_vinculos', { p_obra: id }),
    supabase.rpc('obras_fin_caixinha_sem_obra', { p_obra: id }),
    supabase.rpc('obras_fin_locacoes', { p_obra: id }),
    supabase.rpc('obras_fin_medicoes_fornecedor_atrasadas', { p_obra: id }),
    supabase.from('obras_nota_externa').select('nfse, emitida_em, valor_centavos').eq('obra_id', id),
  ])
  if (cR.error || fR.error || nR.error || vR.error || cxR.error || lR.error || atR.error || exR.error) return leitura

  const rows = (r: { data: unknown }) => (r.data ?? []) as Record<string, unknown>[]
  const qtdCaixinha = Number((rows(cxR)[0] ?? {}).quantidade ?? 0)
  const obraFin: ObraFin = { id, os: null, loja: null, paiId: null, receitaCentavos: receitaEmCentavos(obra.valor), cancelada: false }

  const fin = montarFinanceiro({
    obraId: id,
    obras: [obraFin],
    compras: rows(cR),
    fornecedores: rows(fR),
    notas: rows(nR),
    vinculos: rows(vR),
    avanco: null,
    medicoesFornecedorAtrasadas: rows(atR),
    caixinhaSemObra: Number.isFinite(qtdCaixinha) ? qtdCaixinha : null,
    locacoes: itensDeLocacao(rows(lR)),
    hoje,
  })
  if (!fin.resumo.ok || !fin.faturamento.ok) return leitura

  const externas: NotaExterna[] = rows(exR).map((r) => ({
    nfse: String(r.nfse),
    emitidaEm: String(r.emitida_em),
    valorCentavos: Number(r.valor_centavos),
  }))
  const t = fin.resumo.dados.total
  const resumo = resumoSpot({
    valorCentavos: receitaEmCentavos(obra.valor),
    etapa: obra.etapa,
    fatNfse: obra.fat_nfse,
    notas: fin.faturamento.dados,
    externas,
    custo: { comprometido: t.custoComprometido, realizado: t.custoRealizado, pago: t.custoPago },
  })
  return { ok: true, lidoEm: new Date().toISOString(), fin, resumo, locacoes: montarLocacoes(rows(lR)), externas }
}
