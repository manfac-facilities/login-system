'use server'

/**
 * Server Action das Tarefas.
 *
 * Uma só, e é a que fecha o ciclo: marcar a tarefa como respondida, com o
 * resumo do que foi feito. Sem essa volta, o sistema seria um alarme educado.
 *
 * NA v1 essa volta chega pelo WhatsApp, sozinha. Na v0 alguém marca aqui — e é
 * exatamente por isso que o treinamento de terça precisa dizer que o mecanismo
 * de cobrança automática ainda não existe (spec §8, risco 4).
 *
 * "VENCIDA" NÃO É GRAVADA em lugar nenhum. A coluna `situacao` só aceita
 * 'aberta' e 'respondida'; vencida é `sitTarefa()`, calculada contra hoje.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { hojeISO, horaISO } from '../_lib/tipos'

export type EstadoTarefa = { error?: string; success?: boolean }

export async function responderTarefaAction(
  tarefaId: string,
  resumo: string
): Promise<EstadoTarefa> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }
  if (!(await hasSystemAccess(supabase, user.email, 'obras'))) {
    return { error: 'Sem acesso ao Controle de Obras' }
  }

  const texto = resumo.trim()
  if (!texto) return { error: 'Escreva em uma linha o que foi resolvido.' }

  const { error } = await supabase
    .from('obras_tarefa')
    .update({
      situacao: 'respondida',
      resposta_em: hojeISO(),
      resposta_hora: horaISO(),
      resumo: texto,
    })
    .eq('id', tarefaId)

  if (error) return { error: 'Erro ao marcar a tarefa como respondida' }

  revalidatePath('/obras/tarefas')
  revalidatePath('/obras/diario')
  return { success: true }
}
