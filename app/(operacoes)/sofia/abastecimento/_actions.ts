'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function lancarAbastecimentoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const data = (formData.get('data') as string) || new Date().toISOString().split('T')[0]
  const litrosRaw = formData.get('litros') as string
  const valorRaw = formData.get('valor') as string
  const litros = Number(litrosRaw)
  const valor = Number(valorRaw)
  const km = formData.get('km') ? Number(formData.get('km')) : null
  const posto = (formData.get('posto') as string).trim() || null

  if (!veiculo_id || litrosRaw === '' || Number.isNaN(litros) || valorRaw === '' || Number.isNaN(valor))
    return { error: 'Veículo, litros e valor são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('abastecimentos').insert({ veiculo_id, data, litros, valor, km, posto })

  if (error) return { error: 'Erro ao registrar abastecimento' }
  revalidatePath('/sofia/abastecimento')
  return { success: true }
}
