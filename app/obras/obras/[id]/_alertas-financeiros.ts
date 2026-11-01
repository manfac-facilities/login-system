import type { createClient } from '@/lib/supabase/server'

type Supa = Awaited<ReturnType<typeof createClient>>

export type MedicaoClienteAlerta = { numero: number; os: string | null; enviadaEm: string; situacao: string }
export type MedicaoFornecedorAlerta = { fornecedor: string | null; dias: number; aguardando: string | null }

/**
 * Leituras dos alertas de medição > 10 dias do painel da obra (Fases B/C §2.4). Só para quem vê
 * valores (`podeVer`): para os demais NENHUMA consulta é feita (Disk IO) e os dois vêm null
 * (sem alerta). Cliente da SESSÃO. Leitura que falha → null (nunca alerta falso).
 * Medições de OS cancelada ficam fora.
 */
export async function lerAlertasFinanceiros(
  supabase: Supa,
  id: string,
  podeVer: boolean,
): Promise<{ medicoesCliente: MedicaoClienteAlerta[] | null; medicoesFornecedor: MedicaoFornecedorAlerta[] | null }> {
  if (!podeVer) return { medicoesCliente: null, medicoesFornecedor: null }
  const [medicoesCliente, frnR] = await Promise.all([
    medicoesEnviadas(supabase, id),
    supabase.rpc('obras_fin_medicoes_fornecedor_atrasadas', { p_obra: id }),
  ])
  return {
    medicoesCliente,
    medicoesFornecedor: frnR.error
      ? null
      : ((frnR.data ?? []) as Record<string, unknown>[]).map((m) => ({
          fornecedor: m.fornecedor_razao_social ? String(m.fornecedor_razao_social) : null,
          dias: Number(m.dias_aguardando) || 0,
          aguardando: m.aguardando ? String(m.aguardando) : null,
        })),
  }
}

async function medicoesEnviadas(supabase: Supa, id: string): Promise<MedicaoClienteAlerta[] | null> {
  const fam = await supabase.from('obras_obra').select('id, os, cancelado_em').or(`id.eq.${id},obra_pai_id.eq.${id}`)
  if (fam.error) return null
  const ativas = ((fam.data ?? []) as { id: string; os: string | null; cancelado_em: string | null }[]).filter((o) => !o.cancelado_em)
  if (!ativas.length) return []
  const os = new Map(ativas.map((o) => [o.id, o.os]))
  const med = await supabase
    .from('obras_medicao_cliente')
    .select('numero, obra_id, enviada_em, situacao')
    .in('obra_id', [...os.keys()])
    .eq('situacao', 'enviada')
  if (med.error) return null
  return ((med.data ?? []) as { numero: number; obra_id: string; enviada_em: string; situacao: string }[]).map((m) => ({
    numero: Number(m.numero), os: os.get(m.obra_id) ?? null, enviadaEm: m.enviada_em, situacao: m.situacao,
  }))
}
