import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'

/**
 * Guarda das escritas do Financeiro da obra (medições ao cliente e locações): engenheiro da OS
 * ou da obra mãe, ou administrador — o mesmo que `obras_engenheiro_ou_admin_mae` no banco
 * (que confere de novo, com RLS e trigger). A OS tem de ser a obra da página ou um aditivo
 * dela. Falha fechada: qualquer erro de leitura recusa.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type OsAutorizada = {
  supabase: SupabaseClient
  email: string
  admin: boolean
  os: { id: string; paiId: string | null; valor: unknown }
}

export async function autorizarOs(paginaId: string, osId: string, quem: string): Promise<OsAutorizada | { ok: false; erro: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return { ok: false, erro: 'Não autenticado' }
  if (!UUID.test(paginaId ?? '') || !UUID.test(osId ?? '')) return { ok: false, erro: 'OS não encontrada' }

  const { data, error } = await supabase
    .from('obras_obra')
    .select('id, obra_pai_id, engenheiro_email, valor, modalidade')
    .eq('id', osId)
    .maybeSingle()
  if (error) return { ok: false, erro: 'Não foi possível conferir a OS. Tente de novo.' }
  const os = data as { id: string; obra_pai_id: string | null; engenheiro_email: string | null; valor: unknown; modalidade: string } | null
  if (!os || os.modalidade !== 'obra' || (os.id !== paginaId && os.obra_pai_id !== paginaId)) {
    return { ok: false, erro: 'OS não encontrada nesta obra' }
  }

  const admin = await isAdmin(supabase, email)
  if (!admin) {
    const engs = [os.engenheiro_email]
    if (os.obra_pai_id) {
      const { data: mae, error: eM } = await supabase.from('obras_obra').select('engenheiro_email').eq('id', os.obra_pai_id).maybeSingle()
      if (eM) return { ok: false, erro: 'Não foi possível conferir a OS. Tente de novo.' }
      engs.push((mae as { engenheiro_email: string | null } | null)?.engenheiro_email ?? null)
    }
    const ehEngenheiro = engs.some((e) => !!e && e.trim().toLowerCase() === email)
    if (!ehEngenheiro) return { ok: false, erro: `Só o engenheiro da obra (ou da obra mãe) ou um administrador ${quem}` }
  }
  return { supabase, email, admin, os: { id: os.id, paiId: os.obra_pai_id, valor: os.valor } }
}
