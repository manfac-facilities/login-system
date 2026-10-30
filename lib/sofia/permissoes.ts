import type { SupabaseClient } from '@supabase/supabase-js'

export const MSG_SEM_PERMISSAO_FROTAS =
  'Apenas administradores ou gestores de frotas podem executar esta ação'

/**
 * Pergunta ao banco (sofia_pode_gerir) — a MESMA função que os triggers usam.
 * App e banco nunca divergem: não há segunda cópia da regra em TypeScript.
 * Falha FECHADO: erro de RPC, exceção, data null ou qualquer coisa que não
 * seja exatamente `true` vira false.
 *
 * Sem argumento de propósito: a identidade vem do JWT da sessão (client de
 * lib/supabase/server.ts), nunca de um e-mail passado pelo chamador.
 */
export async function podeGerirFrotas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('sofia_pode_gerir')
    if (error) return false
    return data === true
  } catch {
    return false
  }
}

/** null = pode; string = mensagem de negação. */
export async function requireGestorFrotas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return MSG_SEM_PERMISSAO_FROTAS
  return (await podeGerirFrotas(supabase)) ? null : MSG_SEM_PERMISSAO_FROTAS
}
