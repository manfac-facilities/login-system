'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/sofia/auditLog'
import { isAdminEmail } from '@/lib/auth/admins'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { validarVinculoEquipeUnico } from '@/lib/sofia/veiculos'

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

  if (equipe_id) {
    const conflito = await validarVinculoEquipeUnico(supabase, equipe_id)
    if (conflito) return { error: conflito }
  }

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
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase
    .from('veiculos')
    .update({ valor_locacao_mensal })
    .eq('id', id)

  if (error) {
    console.error('atualizarLocacaoVeiculoAction:', error.message)
    throw new Error('Erro ao atualizar valor de locação')
  }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/custos')
}

export async function atualizarEquipeVeiculoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  const equipe_id = (formData.get('equipe_id') as string) || null
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem editar a equipe do veículo' }

  if (equipe_id) {
    const conflito = await validarVinculoEquipeUnico(supabase, equipe_id, id)
    if (conflito) return { error: conflito }
  }

  const { error } = await supabase.from('veiculos').update({ equipe_id }).eq('id', id)
  if (error) return { error: 'Erro ao atualizar equipe do veículo' }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/equipes')
  await logAudit('veiculos', 'atualizou', id, 'Equipe do veículo atualizada')
  return { success: true }
}

export async function enviarParaOficinaAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  const previsao_retorno_oficina = (formData.get('previsao_retorno_oficina') as string) || null
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem enviar veículo para oficina' }

  const hoje = new Date().toISOString().split('T')[0]
  const { error: fechaError } = await supabase
    .from('veiculo_responsabilidade_historico')
    .update({ fim: hoje })
    .eq('veiculo_id', id)
    .is('fim', null)

  if (fechaError) return { error: 'Erro ao enviar veículo para oficina' }

  const { error } = await supabase
    .from('veiculos')
    .update({ status: 'manutencao', equipe_id: null, previsao_retorno_oficina })
    .eq('id', id)

  if (error) return { error: 'Erro ao enviar veículo para oficina' }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/equipes')
  revalidatePath('/sofia/disponibilidade')
  await logAudit('veiculos', 'atualizou', id, 'Veículo enviado para oficina')
  return { success: true }
}

export async function retornarDaOficinaAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem registrar retorno da oficina' }

  const { error } = await supabase
    .from('veiculos')
    .update({ status: 'ativo', previsao_retorno_oficina: null, substituto_id: null })
    .eq('id', id)

  if (error) return { error: 'Erro ao registrar retorno da oficina' }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/disponibilidade')
  await logAudit('veiculos', 'atualizou', id, 'Veículo retornou da oficina')
  return { success: true }
}

export async function definirSubstitutoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  const substituto_id = (formData.get('substituto_id') as string) || null
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem definir o veículo substituto' }

  const { error } = await supabase.from('veiculos').update({ substituto_id }).eq('id', id)
  if (error) return { error: 'Erro ao definir veículo substituto' }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/veiculos')
  await logAudit('veiculos', 'atualizou', id, 'Veículo substituto definido')
  return { success: true }
}
