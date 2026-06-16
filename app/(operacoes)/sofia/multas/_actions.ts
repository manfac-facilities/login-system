'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarMultaAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const descricao = (formData.get('descricao') as string).trim()
  const valor = Number(formData.get('valor'))
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!data || !descricao || !valor)
    return { error: 'Data, descrição e valor são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('multas')
    .insert({ veiculo_id, motorista_id, data, descricao, valor, observacoes })

  if (error) return { error: 'Erro ao registrar multa' }

  revalidatePath('/sofia/multas')
  return { success: true }
}

export async function atualizarStatusMultaAction(id: string, status: string) {
  const supabase = await createClient()
  await supabase.from('multas').update({ status }).eq('id', id)
  revalidatePath('/sofia/multas')
}
