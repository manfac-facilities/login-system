'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { MULTA_STATUS, isValidEnum } from '@/lib/sofia/enums'

function parseDescontoFormData(formData: FormData) {
  const id = formData.get('id') as string
  const valor_descontado = Number(formData.get('valor_descontado'))
  const tipo_desconto = formData.get('tipo_desconto') as string
  const autorizacao_assinada = formData.get('autorizacao_assinada') === 'true'
  return { id, valor_descontado, tipo_desconto, autorizacao_assinada }
}

export async function atualizarStatusMultaAction(id: string, status: string) {
  if (!isValidEnum(MULTA_STATUS, status)) throw new Error('Status de multa inválido')

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase.from('multas').update({ status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoMultaAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  if (Number.isNaN(valor_descontado) || valor_descontado < 0) {
    throw new Error('Valor do desconto inválido')
  }

  const { data: multa } = await supabase.from('multas').select('valor').eq('id', id).single()
  if (multa && valor_descontado > (multa as { valor: number }).valor) {
    throw new Error('Valor do desconto não pode ser maior que o valor original')
  }

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
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase.from('multas').update({ status: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function atualizarStatusDescontoSinistroAction(id: string, status: string) {
  if (!isValidEnum(MULTA_STATUS, status)) throw new Error('Status de desconto inválido')

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase.from('sinistros').update({ status_desconto: status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoSinistroAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  if (Number.isNaN(valor_descontado) || valor_descontado < 0) {
    throw new Error('Valor do desconto inválido')
  }

  const { data: sinistro } = await supabase.from('sinistros').select('valor_dano').eq('id', id).single()
  if (sinistro && (sinistro as { valor_dano: number | null }).valor_dano != null && valor_descontado > (sinistro as { valor_dano: number }).valor_dano) {
    throw new Error('Valor do desconto não pode ser maior que o valor original')
  }

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
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase.from('sinistros').update({ status_desconto: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}
