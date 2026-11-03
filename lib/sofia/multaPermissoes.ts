import type { SupabaseClient } from '@supabase/supabase-js'

export const MSG_SO_ADMIN_AUTORIZA = 'Só o administrador autoriza o desconto'

/**
 * Autorizar (e revogar) desconto de multa é só do administrador (decisão 3 da
 * multa, 03/11/2026). Pergunta ao banco a mesma função que a trigger
 * trg_multas_etapa usa (sofia_is_admin). Falha FECHADA: só `data === true`.
 * Não importa nada de lib/auth (regra de sem-admin-do-hub.test.ts).
 */
export async function podeAutorizarDescontoMulta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('sofia_is_admin')
    if (error) return false
    return data === true
  } catch {
    return false
  }
}
