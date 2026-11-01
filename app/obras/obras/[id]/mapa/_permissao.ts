import type { SupabaseClient } from '@supabase/supabase-js'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'

/**
 * Quem monta o mapa (spec Leva 6 §2.9): o engenheiro da obra (com acesso ao
 * sistema `obras`) ou administrador — o mesmo critério do banco
 * (`obras_engenheiro_ou_admin`). Falha fechada: obra sem engenheiro só admin.
 * Usado pela tela (mostrar "Montar o mapa") e pelas actions (a barreira de fato,
 * com o trigger OBRAS_MAPA atrás).
 */
export async function podeMontarMapa(
  supabase: SupabaseClient,
  email: string,
  engenheiroEmail: string | null | undefined,
): Promise<boolean> {
  const e = email.trim().toLowerCase()
  if (!e) return false
  if (await isAdmin(supabase, e)) return true
  const eng = (engenheiroEmail ?? '').trim().toLowerCase()
  return !!eng && eng === e && (await hasSystemAccess(supabase, e, 'obras'))
}
