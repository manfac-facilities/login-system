'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isAdminEmail } from '@/lib/auth/admins'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { AUTORIZACAO_STATUS, SINISTRO_STATUS, isValidEnum } from '@/lib/sofia/enums'

export async function atualizarAutorizacaoSinistroAction(id: string, formData: FormData): Promise<void> {
  const status = formData.get('status') as string
  if (!isValidEnum(AUTORIZACAO_STATUS, status)) return

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return

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
  const id = (formData.get('id') as string) || ''
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const tipo = formData.get('tipo') as string
  const descricao = (formData.get('descricao') as string).trim()
  const valor_dano = formData.get('valor_dano') ? Number(formData.get('valor_dano')) : null
  const observacoes = (formData.get('observacoes') as string).trim() || null

  let fotos: Record<string, string> = {}
  try {
    fotos = JSON.parse((formData.get('fotos') as string | null) || '{}')
  } catch {
    fotos = {}
  }

  if (!data || !tipo || !descricao) return { error: 'Data, tipo e descrição são obrigatórios' }
  if (!id) return { error: 'Erro interno: identificador do sinistro ausente' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sinistros')
    .insert({ id, veiculo_id, motorista_id, data, tipo, descricao, valor_dano, observacoes })

  if (error) return { error: 'Erro ao registrar sinistro' }

  const fotoRows = Object.values(fotos).map((storage_path) => ({ sinistro_id: id, storage_path }))
  if (fotoRows.length > 0) {
    const { error: fotosError } = await supabase.from('sinistro_fotos').insert(fotoRows)
    if (fotosError) {
      revalidatePath('/sofia/sinistros')
      return { error: 'Sinistro salvo, mas as fotos não foram registradas. Contate o suporte.', sinistroId: id }
    }
  }

  revalidatePath('/sofia/sinistros')
  return { success: true, sinistroId: id }
}

export async function atualizarTratativaSinistroAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  const status = formData.get('status') as string

  if (!isValidEnum(SINISTRO_STATUS, status)) return { error: 'Status de sinistro inválido' }

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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem excluir sinistros' }

  const { error } = await supabase.from('sinistros').delete().eq('id', id)
  if (error) return { error: 'Erro ao excluir sinistro' }
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
  return { success: true }
}
