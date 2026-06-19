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
  const { error } = await supabase.from('multas').update({ status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
}

export async function registrarDescontoMultaAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const valor_descontado = Number(formData.get('valor_descontado'))
  const tipo_desconto = formData.get('tipo_desconto') as string
  const autorizacao_assinada = formData.get('autorizacao_assinada') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('multas')
    .update({ valor_descontado, tipo_desconto, autorizacao_assinada, status: 'descontada' })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/sofia/multas')
}
