'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarPendenciaAction(_prev: State, formData: FormData): Promise<State> {
  const descricao = (formData.get('descricao') as string).trim()
  const responsavel = (formData.get('responsavel') as string).trim() || null
  const prazo = (formData.get('prazo') as string) || null
  const proxima_acao = (formData.get('proxima_acao') as string).trim() || null

  if (!descricao) return { error: 'Descrição é obrigatória' }

  const supabase = await createClient()
  const { error } = await supabase.from('pendencias').insert({ descricao, responsavel, prazo, proxima_acao, origem: 'manual' })

  if (error) return { error: 'Erro ao criar pendência' }
  revalidatePath('/sofia/pendencias')
  return { success: true }
}

export async function atualizarStatusPendenciaAction(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('pendencias').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/pendencias')
}
