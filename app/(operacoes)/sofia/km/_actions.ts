'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function lancarKmAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const equipe_id = formData.get('equipe_id') as string
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const km_inicial = Number(formData.get('km_inicial'))
  const km_final = formData.get('km_final') ? Number(formData.get('km_final')) : null
  const data =
    (formData.get('data') as string) || new Date().toISOString().split('T')[0]
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!equipe_id || !veiculo_id) return { error: 'Selecione equipe e veículo' }
  if (!km_inicial) return { error: 'KM inicial é obrigatório' }
  if (km_final && km_final < km_inicial)
    return { error: 'KM final não pode ser menor que o KM inicial' }

  const supabase = await createClient()
  const { error } = await supabase.from('km_diario').upsert(
    {
      equipe_id,
      veiculo_id,
      motorista_id,
      km_inicial,
      km_final,
      data,
      observacoes,
    },
    { onConflict: 'data,equipe_id' }
  )

  if (error) return { error: 'Erro ao registrar KM' }

  if (km_final) {
    await supabase.from('veiculos').update({ km_atual: km_final }).eq('id', veiculo_id)
  }

  revalidatePath('/sofia/km')
  return { success: true }
}
