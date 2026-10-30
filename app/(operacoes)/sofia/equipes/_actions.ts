'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { podeGerirFrotas, requireGestorFrotas } from '@/lib/sofia/permissoes'

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
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !(await podeGerirFrotas(supabase)))
    return { error: 'Apenas administradores ou gestores de frotas podem desativar equipes' }

  const { error } = await supabase.from('equipes').update({ ativo: false }).eq('id', id)
  if (error) return { error: 'Erro ao desativar equipe' }
  revalidatePath('/sofia/equipes')
  return { success: true }
}

/**
 * F1 — edita código e motorista da equipe via RPC editar_equipe_atomico (tudo
 * ou nada: código, motoristas, históricos de responsabilidade e audit_log na
 * mesma transação; sem logAudit). O VEÍCULO não muda por aqui — só pelo checklist.
 */
export async function editarEquipeAction(
  _prev: State,
  formData: FormData
): Promise<State & { codigo?: string }> {
  const id = formData.get('id') as string
  const codigo = ((formData.get('codigo') as string) ?? '').trim().toUpperCase()
  const motorista_id = (formData.get('motorista_id') as string) || null
  if (!id) return { error: 'ID inválido' }
  if (!codigo) return { error: 'Informe o código da equipe' }

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  const { data, error } = await supabase.rpc('editar_equipe_atomico', {
    p_equipe_id: id,
    p_codigo: codigo,
    p_motorista_id: motorista_id,
  })
  if (error) return { error: error.code === 'SOF01' ? error.message : 'Erro ao salvar a equipe' }

  revalidatePath('/sofia/equipes')
  revalidatePath('/sofia/motoristas')
  revalidatePath('/sofia/disponibilidade')
  revalidatePath('/sofia/audit')
  return { success: true, codigo: (data as { codigo: string }).codigo }
}
