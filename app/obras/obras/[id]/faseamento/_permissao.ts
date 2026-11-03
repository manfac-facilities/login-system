import type { SupabaseClient } from '@supabase/supabase-js'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'

const normal = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * Quem edita, emite e envia a planta de faseamento (spec Leva 6b §2.1): o
 * administrador, ou, com acesso ao sistema `obras`, o engenheiro da obra ou o
 * coordenador da obra (`obras_obra.coordenador_email`). Mesmo critério do banco
 * (`obras_pode_fasear`, lower/trim). Falha fechada: e-mail da sessão, engenheiro
 * ou coordenador NULL/vazio nunca casam. Usado pela tela (mostrar os botões) e
 * pelas actions (a barreira de fato, com os triggers OBRAS_FASEAMENTO atrás).
 */
export async function podeFasear(
  supabase: SupabaseClient,
  email: string | null | undefined,
  obra: { engenheiro_email?: string | null; coordenador_email?: string | null },
): Promise<boolean> {
  const e = normal(email)
  if (!e) return false
  if (await isAdmin(supabase, e)) return true
  const eng = normal(obra.engenheiro_email)
  const coord = normal(obra.coordenador_email)
  if (!((eng && eng === e) || (coord && coord === e))) return false
  return hasSystemAccess(supabase, e, 'obras')
}
