'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarEquipeAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const codigo = (formData.get('codigo') as string).trim().toUpperCase()
  const centro_custo = (formData.get('centro_custo') as string).trim() || null

  if (!codigo) return { error: 'Código da equipe é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('equipes')
    .insert({ codigo, centro_custo })

  if (error) {
    if (error.code === '23505') return { error: `Equipe ${codigo} já existe` }
    return { error: 'Erro ao criar equipe' }
  }

  revalidatePath('/sofia/equipes')
  return { success: true }
}

export async function toggleEquipeAction(id: string, ativo: boolean) {
  const supabase = await createClient()
  await supabase.from('equipes').update({ ativo }).eq('id', id)
  revalidatePath('/sofia/equipes')
}

export async function desativarEquipeAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }
  const supabase = await createClient()
  const { error } = await supabase.from('equipes').update({ ativo: false }).eq('id', id)
  if (error) return { error: 'Erro ao desativar equipe' }
  revalidatePath('/sofia/equipes')
  return { success: true }
}
