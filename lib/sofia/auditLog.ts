import { createClient } from '@/lib/supabase/server'

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
    const { error } = await supabase.from('audit_log').insert({
      tabela,
      operacao,
      registro_id: registroId,
      descricao,
      usuario_id: user?.id ?? null,
    })
    if (error) console.error('logAudit falhou:', error)
  } catch (error) {
    console.error('logAudit falhou:', error)
  }
}
