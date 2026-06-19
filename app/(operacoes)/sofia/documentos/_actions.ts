'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarDocumentoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const tipo = formData.get('tipo') as string
  const numero = (formData.get('numero') as string).trim() || null
  const vencimento = formData.get('vencimento') as string

  if (!veiculo_id || !tipo || !vencimento) return { error: 'Veículo, tipo e vencimento são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('documentos_veiculo').insert({ veiculo_id, tipo, numero, vencimento })

  if (error) return { error: 'Erro ao registrar documento' }
  revalidatePath('/sofia/documentos')
  return { success: true }
}
