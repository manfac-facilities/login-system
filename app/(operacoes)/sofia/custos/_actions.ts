'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type State = { error?: string; success?: boolean }

export async function atualizarCentroCustoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const centro_custo = (formData.get('centro_custo') as string).trim()
  const vigente_desde = (formData.get('vigente_desde') as string) || new Date().toISOString().split('T')[0]

  if (!veiculo_id || !centro_custo) return { error: 'Veículo e centro de custo são obrigatórios' }

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return { error: erroAdmin }

  const { error } = await supabase.from('centro_custo_historico').insert({ veiculo_id, centro_custo, vigente_desde })

  if (error) return { error: 'Erro ao atualizar centro de custo' }
  revalidatePath('/sofia/custos')
  return { success: true }
}
