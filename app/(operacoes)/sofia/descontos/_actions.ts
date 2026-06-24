'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function parseDescontoFormData(formData: FormData) {
  const id = formData.get('id') as string
  const valor_descontado = Number(formData.get('valor_descontado'))
  const tipo_desconto = formData.get('tipo_desconto') as string
  const autorizacao_assinada = formData.get('autorizacao_assinada') === 'true'
  return { id, valor_descontado, tipo_desconto, autorizacao_assinada }
}

export async function atualizarStatusMultaAction(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('multas').update({ status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoMultaAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const { error } = await supabase
    .from('multas')
    .update({ valor_descontado, tipo_desconto, autorizacao_assinada, status: 'descontada' })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function desfazerDescontoMultaAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('multas').update({ status: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function atualizarStatusDescontoSinistroAction(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('sinistros').update({ status_desconto: status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoSinistroAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const { error } = await supabase
    .from('sinistros')
    .update({ valor_descontado, tipo_desconto, autorizacao_assinada, status_desconto: 'descontada' })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}

export async function desfazerDescontoSinistroAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('sinistros').update({ status_desconto: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}
