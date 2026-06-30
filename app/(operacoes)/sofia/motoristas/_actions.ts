'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarMotoristaAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const nome = (formData.get('nome') as string).trim()
  const cnh = (formData.get('cnh') as string).trim() || null
  const cnh_vencimento = (formData.get('cnh_vencimento') as string) || null
  const contato = (formData.get('contato') as string).trim() || null
  const equipe_id = (formData.get('equipe_id') as string) || null

  if (!nome) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('motoristas')
    .insert({ nome, cnh, cnh_vencimento, contato, equipe_id })

  if (error) return { error: 'Erro ao cadastrar motorista' }

  revalidatePath('/sofia/motoristas')
  return { success: true }
}

export async function desativarMotoristaAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('motoristas')
    .update({ ativo: false })
    .eq('id', id)

  if (error) return { error: 'Erro ao desativar motorista' }

  revalidatePath('/sofia/motoristas')
  revalidatePath(`/sofia/motoristas/${id}`)
  return { success: true }
}
