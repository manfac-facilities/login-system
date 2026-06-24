import { createClient } from '@/lib/supabase/server'
import type { AuditAcao } from './types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface RegistrarAuditoriaParams {
  tabela: string
  registro_id: string
  acao: AuditAcao
  dados: Record<string, unknown>
  usuario_email: string | null
}

export async function registrarAuditoria(
  supabase: SupabaseServerClient,
  params: RegistrarAuditoriaParams
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert(params)
  if (error) throw error
}
