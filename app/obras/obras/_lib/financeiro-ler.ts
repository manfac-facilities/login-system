import type { SupabaseClient } from '@supabase/supabase-js'
import { montarFinanceiro, type Financeiro, type ObraFin } from './financeiro-tela'
import { receitaEmCentavos } from './medicao'
import type { ObraGrande } from './leitura'
import { itensDeLocacao } from '../[id]/financeiro/locacoes/_tipos'

export type LeituraFinanceiro =
  | { ok: true; fin: Financeiro; obras: ObraFin[] }
  | { ok: false; motivo: 'sem_permissao' | 'nao_encontrada' | 'leitura' }

/**
 * Leitura do Financeiro de uma obra (mãe + filhas), com o cliente da SESSÃO. Falha fechada:
 * sem `obras_pode_ver_valores === true` nada de valor é lido.
 */
export async function lerFinanceiroDaObra(
  supabase: SupabaseClient,
  obraId: string,
  og: { ok: true; dados: ObraGrande } | { ok: false; erro: string },
  hoje: string,
): Promise<LeituraFinanceiro> {
  const id = obraId
  const { data: pode, error: ePode } = await supabase.rpc('obras_pode_ver_valores', { p_obra: id })
  if (ePode || pode !== true) return { ok: false, motivo: 'sem_permissao' }

  const obrasR = await supabase.from('obras_obra').select('id, os, loja, obra_pai_id, valor, cancelado_em').or(`id.eq.${id},obra_pai_id.eq.${id}`)
  if (obrasR.error) return { ok: false, motivo: 'leitura' }
  type O = { id: string; os: string | null; loja: string | null; obra_pai_id: string | null; valor: unknown; cancelado_em: string | null }
  const obras: ObraFin[] = ((obrasR.data ?? []) as O[])
    .map((o) => ({ id: o.id, os: o.os, loja: o.loja, paiId: o.obra_pai_id, receitaCentavos: receitaEmCentavos(o.valor), cancelada: !!o.cancelado_em }))
    .sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : (a.os ?? '').localeCompare(b.os ?? '')))
  if (!obras.some((o) => o.id === id)) return { ok: false, motivo: 'nao_encontrada' }

  const [cR, fR, nR, vR, mR, cxR, lR, atR] = await Promise.all([
    supabase.rpc('obras_fin_compras', { p_obra: id }),
    supabase.rpc('obras_fin_fornecedores', { p_obra: id }),
    supabase.rpc('obras_fin_notas', { p_obra: id }),
    supabase.rpc('obras_fin_vinculos', { p_obra: id }),
    supabase.from('obras_medicao_cliente').select('obra_id, situacao, valor_centavos').in('obra_id', obras.map((o) => o.id)),
    supabase.rpc('obras_fin_caixinha_sem_obra', { p_obra: id }),
    supabase.rpc('obras_fin_locacoes', { p_obra: id }),
    supabase.rpc('obras_fin_medicoes_fornecedor_atrasadas', { p_obra: id }),
  ])
  const rows = (r: { data: unknown; error: unknown }) => (r.error ? [] : ((r.data ?? []) as Record<string, unknown>[]))
  const realizado = og.ok ? og.dados.calc?.realizado : undefined
  const qtdCaixinha = cxR.error ? null : Number((rows(cxR)[0] ?? {}).quantidade ?? 0)

  const fin = montarFinanceiro({
    obraId: id,
    obras,
    compras: rows(cR),
    fornecedores: rows(fR),
    notas: rows(nR),
    vinculos: rows(vR),
    medicoesCliente: rows(mR),
    // Sem cronograma (ou leitura falhou): sem avanço → custo/margem projetados "—".
    avanco: realizado !== undefined && realizado !== null && Number.isFinite(realizado) ? realizado : null,
    medicoesFornecedorAtrasadas: atR.error ? null : rows(atR),
    caixinhaSemObra: qtdCaixinha !== null && Number.isFinite(qtdCaixinha) ? qtdCaixinha : null,
    locacoes: lR.error ? null : itensDeLocacao(rows(lR)),
    hoje,
    feriados: og.ok ? og.dados.feriados : undefined,
  })
  // Leitura que falhou não vira "sem lançamentos": o bloco e o resumo avisam (falha fechada).
  const leitura = { ok: false as const, motivo: 'leitura' as const }
  if (cR.error) fin.compras = leitura
  if (fR.error) fin.fornecedores = leitura
  if (nR.error) fin.faturamento = leitura
  if (cR.error || fR.error || nR.error || vR.error || mR.error) {
    fin.resumo = leitura
    fin.semLancamentos = false
  }
  return { ok: true, fin, obras }
}
