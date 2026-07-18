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

// ---------------------------------------------------------------------------
// logAudit — lightweight helper for Task 10 Server Action instrumentation.
// Never throws: audit failures are silently swallowed so main operations
// are never interrupted.
// ---------------------------------------------------------------------------

type Operacao = 'criou' | 'atualizou' | 'excluiu' | 'desativou'

export async function logAudit(
  tabela: string,
  operacao: Operacao,
  registroId: string | null,
  descricao: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await supabase.from('audit_log').insert({
      tabela,
      operacao,
      registro_id: registroId,
      descricao,
      usuario_id: user?.id ?? null,
    })
  } catch (error) {
    // falha no audit não deve quebrar a operação principal, mas precisa ficar visível
    console.error('logAudit falhou:', error)
  }
}
