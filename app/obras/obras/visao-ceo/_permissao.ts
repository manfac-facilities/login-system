import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/auth/roles'

/**
 * Guarda da Visão do CEO (spec §4/§6b): só administrador do hub, até existirem os papéis do SGO
 * (o papel CEO entra aqui). Falha fechada: sem usuário, sem e-mail, erro ou exceção → false.
 */
export async function podeVerVisaoCeo(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getUser()
    const email = data?.user?.email
    if (error || !email) return false
    return (await isAdmin(supabase, email)) === true
  } catch {
    return false
  }
}
