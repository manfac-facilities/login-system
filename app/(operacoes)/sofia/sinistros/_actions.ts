'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function atualizarAutorizacaoSinistroAction(id: string, formData: FormData): Promise<void> {
  const status = formData.get('status') as string
  if (!['sem_solicitacao', 'solicitado', 'autorizado'].includes(status)) return

  const supabase = await createClient()
  const update: Record<string, unknown> = { autorizacao_status: status }
  if (status === 'solicitado') update.autorizacao_solicitado_em = new Date().toISOString()
  if (status === 'sem_solicitacao') update.autorizacao_solicitado_em = null

  await supabase.from('sinistros').update(update).eq('id', id)
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
  revalidatePath('/sofia/pendencias')
  revalidatePath('/sofia/motoristas')
}

type State = { error?: string; success?: boolean; sinistroId?: string }

export async function criarSinistroAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const tipo = formData.get('tipo') as string
  const descricao = (formData.get('descricao') as string).trim()
  const valor_dano = formData.get('valor_dano') ? Number(formData.get('valor_dano')) : null
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!data || !tipo || !descricao) return { error: 'Data, tipo e descrição são obrigatórios' }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('sinistros')
    .insert({ veiculo_id, motorista_id, data, tipo, descricao, valor_dano, observacoes })
    .select('id')
    .single()

  if (error) return { error: 'Erro ao registrar sinistro' }
  revalidatePath('/sofia/sinistros')
  return { success: true, sinistroId: row.id }
}

export async function uploadFotoSinistroAction(sinistroId: string, storagePath: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('sinistro_fotos')
    .insert({ sinistro_id: sinistroId, storage_path: storagePath })
  if (error) throw error
  revalidatePath('/sofia/sinistros')
}

export async function atualizarTratativaSinistroAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  const status = formData.get('status') as string

  const supabase = await createClient()
  const { error } = await supabase.from('sinistros').update({ status }).eq('id', id)

  if (error) return { error: 'Erro ao atualizar tratativa' }
  revalidatePath('/sofia/sinistros')
  return { success: true }
}

export async function excluirSinistroAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }
  const supabase = await createClient()
  const { error } = await supabase.from('sinistros').delete().eq('id', id)
  if (error) return { error: 'Erro ao excluir sinistro' }
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
  return { success: true }
}
