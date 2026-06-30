'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/sofia/auditLog'

type State = { error?: string; success?: boolean }

export async function criarVeiculoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const placa = (formData.get('placa') as string).trim().toUpperCase()
  const modelo = (formData.get('modelo') as string).trim()
  const ano = formData.get('ano') ? Number(formData.get('ano')) : null
  const km_atual = Number(formData.get('km_atual') ?? 0)
  const km_contratual_mensal = formData.get('km_contratual_mensal')
    ? Number(formData.get('km_contratual_mensal'))
    : null
  const valor_locacao_mensal = formData.get('valor_locacao_mensal')
    ? Number(formData.get('valor_locacao_mensal'))
    : null
  const equipe_id = (formData.get('equipe_id') as string) || null

  if (!placa || !modelo) return { error: 'Placa e modelo são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('veiculos')
    .insert({ placa, modelo, ano, km_atual, km_contratual_mensal, equipe_id, valor_locacao_mensal })

  if (error) {
    if (error.code === '23505')
      return { error: `Veículo com placa ${placa} já existe` }
    return { error: 'Erro ao criar veículo' }
  }

  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/equipes')
  return { success: true }
}

export async function softDeleteVeiculoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('veiculos')
    .update({ status: 'inativo' })
    .eq('id', id)

  if (error) return { error: 'Erro ao desativar veículo' }

  revalidatePath('/sofia/veiculos')
  await logAudit('veiculos', 'desativou', id, 'Veículo desativado (soft-delete)')
  redirect('/sofia/veiculos')
}

export async function atualizarLocacaoVeiculoAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const valor_locacao_mensal = formData.get('valor_locacao_mensal')
    ? Number(formData.get('valor_locacao_mensal'))
    : null

  const supabase = await createClient()
  await supabase
    .from('veiculos')
    .update({ valor_locacao_mensal })
    .eq('id', id)

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/custos')
}
