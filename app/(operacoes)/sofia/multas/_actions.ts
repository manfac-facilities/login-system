'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/sofia/auditLog'
import { isAdminEmail } from '@/lib/auth/admins'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { AUTORIZACAO_STATUS, isValidEnum } from '@/lib/sofia/enums'

type State = { error?: string; success?: boolean }

export async function criarMultaAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const data_recebimento = (formData.get('data_recebimento') as string) || ''
  const tipoInfracaoSelect = ((formData.get('tipo_infracao') as string) ?? '').trim()
  const tipoInfracaoOutra = ((formData.get('tipo_infracao_outra') as string) ?? '').trim()
  const tipo_infracao = tipoInfracaoSelect === 'outra' ? tipoInfracaoOutra : tipoInfracaoSelect
  const descricao = ((formData.get('descricao') as string) ?? '').trim() || null
  const valorRaw = formData.get('valor') as string
  const valor = Number(valorRaw)
  const observacoes = ((formData.get('observacoes') as string) ?? '').trim() || null

  if (!data || !data_recebimento || !tipo_infracao || valorRaw === '' || Number.isNaN(valor))
    return { error: 'Data, data de recebimento, tipo de infração e valor são obrigatórios' }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('multas')
    .insert({ veiculo_id, motorista_id, data, data_recebimento, tipo_infracao, descricao, valor, observacoes })
    .select()
    .single()

  if (error) return { error: 'Erro ao registrar multa' }

  await logAudit('multas', 'criou', row.id, `Multa registrada — ${tipo_infracao} (${data})`)

  revalidatePath('/sofia/multas')
  return { success: true }
}

export async function enviarParaDescontoEmMassaAction(ids: string[]) {
  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)
  const { error } = await supabase
    .from('multas')
    .update({ status: 'validada' })
    .in('id', ids)
    .eq('status', 'pendente')
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function excluirMultaAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem excluir multas' }

  const { data: multa, error } = await supabase.from('multas').delete().eq('id', id).select().single()
  if (error) return { error: 'Erro ao excluir multa' }
  if (!multa) return { error: 'Multa não encontrada' }

  await logAudit('multas', 'excluiu', id, `Multa excluída — ${multa.tipo_infracao ?? multa.descricao ?? id}`)

  revalidatePath('/sofia/multas')
  return { success: true }
}

export async function excluirMultasEmMassaAction(ids: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    throw new Error('Apenas administradores podem excluir multas')

  const { data: multas, error } = await supabase.from('multas').delete().in('id', ids).select()
  if (error) throw error

  for (const multa of multas ?? []) {
    await logAudit('multas', 'excluiu', multa.id, `Multa excluída em massa — ${multa.tipo_infracao ?? multa.descricao ?? multa.id}`)
  }

  revalidatePath('/sofia/multas')
}

export async function atualizarAutorizacaoMultaAction(id: string, formData: FormData): Promise<void> {
  const status = formData.get('status') as string
  if (!isValidEnum(AUTORIZACAO_STATUS, status)) return

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return

  const update: Record<string, unknown> = { autorizacao_status: status }
  if (status === 'solicitado') update.autorizacao_solicitado_em = new Date().toISOString()
  if (status === 'sem_solicitacao') update.autorizacao_solicitado_em = null

  await supabase.from('multas').update(update).eq('id', id)
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
  revalidatePath('/sofia/pendencias')
  revalidatePath('/sofia/motoristas')
}
