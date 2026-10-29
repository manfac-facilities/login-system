/**
 * "Último diário" = data do último diário que o CLIENTE de fato recebeu:
 * `obras_envio` tipo `diario`, lado `cliente` e ao menos um destinatário
 * aceito (`destinatarios` não vazio). Envio interno ou que falhou por
 * completo (`destinatarios = {}`, resultado `falha`) não conta.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export async function ultimosDiariosEnviados(
  supabase: SupabaseClient,
  obraIds: string[],
): Promise<{ ultimo: Map<string, string>; error: { message: string } | null }> {
  const ultimo = new Map<string, string>()
  if (!obraIds.length) return { ultimo, error: null }
  const { data, error } = await supabase
    .from('obras_envio')
    .select('obra_id, referencia')
    .eq('tipo', 'diario')
    .eq('lado', 'cliente')
    .not('destinatarios', 'eq', '{}')
    .in('obra_id', obraIds)
  for (const e of (data ?? []) as { obra_id: string; referencia: string | null }[]) {
    if (e.referencia && e.referencia > (ultimo.get(e.obra_id) ?? '')) ultimo.set(e.obra_id, e.referencia)
  }
  return { ultimo, error }
}
