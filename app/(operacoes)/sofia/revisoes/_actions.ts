'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function registrarRevisaoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const km_ultima_revisao = Number(formData.get('km_ultima_revisao'))
  const data_ultima_revisao = (formData.get('data_ultima_revisao') as string) || null
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!veiculo_id || !km_ultima_revisao)
    return { error: 'Veículo e KM são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('revisoes').upsert(
    {
      veiculo_id,
      km_ultima_revisao,
      data_ultima_revisao,
      observacoes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'veiculo_id' }
  )

  if (error) return { error: 'Erro ao registrar revisão' }

  revalidatePath('/sofia/revisoes')
  return { success: true }
}
