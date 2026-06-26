'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function lancarAbastecimentoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const valor = Number(formData.get('valor'))
  const litrosRaw = formData.get('litros') as string
  const litros = litrosRaw ? Number(litrosRaw) : null
  const km = formData.get('km') ? Number(formData.get('km')) : null
  const posto = ((formData.get('posto') as string) ?? '').trim() || null
  const data =
    (formData.get('data') as string) || new Date().toISOString().split('T')[0]

  if (!veiculo_id) return { error: 'Selecione a equipe para identificar o veículo' }
  if (!valor || Number.isNaN(valor) || valor <= 0) return { error: 'Informe o valor do abastecimento' }

  const supabase = await createClient()
  const { error } = await supabase.from('abastecimentos').insert({
    veiculo_id,
    data,
    litros,
    valor,
    km,
    posto,
  })

  if (error) return { error: 'Erro ao registrar abastecimento' }

  revalidatePath('/sofia/abastecimento')
  return { success: true }
}

export async function deletarAbastecimentoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('abastecimentos').delete().eq('id', id)

  if (error) return { error: 'Erro ao excluir abastecimento' }

  revalidatePath('/sofia/abastecimento')
  return { success: true }
}
