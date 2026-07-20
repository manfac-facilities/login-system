import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Garante a regra "1 equipe por veículo não-inativo": uma equipe não pode
 * estar vinculada a mais de um veículo ativo/em manutenção ao mesmo tempo.
 * Espelha o índice único parcial `veiculos_equipe_ativo_uniq` do banco —
 * checar aqui devolve uma mensagem amigável em vez de deixar a constraint
 * do Postgres estourar sem tratamento.
 */
export async function validarVinculoEquipeUnico(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  equipeId: string,
  veiculoIdExcluir?: string
): Promise<string | null> {
  if (!equipeId) return null

  let query = supabase
    .from('veiculos')
    .select('id, placa')
    .eq('equipe_id', equipeId)
    .neq('status', 'inativo')
    .limit(1)

  if (veiculoIdExcluir) query = query.neq('id', veiculoIdExcluir)

  const { data } = await query

  if (data && (data as { id: string; placa: string }[]).length > 0) {
    return `Equipe já vinculada ao veículo ${(data as { id: string; placa: string }[])[0].placa}`
  }
  return null
}
