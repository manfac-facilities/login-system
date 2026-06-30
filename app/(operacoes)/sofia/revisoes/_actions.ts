'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarRevisaoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const tipo = formData.get('tipo') as string
  const fornecedor = (formData.get('fornecedor') as string).trim() || null
  const valor = formData.get('valor') ? Number(formData.get('valor')) : null
  const data_realizada = (formData.get('data_realizada') as string) || null
  const km_realizada = formData.get('km_realizada') ? Number(formData.get('km_realizada')) : null
  const proxima_data = (formData.get('proxima_data') as string) || null
  const proxima_km = formData.get('proxima_km') ? Number(formData.get('proxima_km')) : null
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!veiculo_id || !tipo) return { error: 'Veículo e tipo são obrigatórios' }

  const status = proxima_data && new Date(proxima_data) < new Date() ? 'atrasada' : proxima_data ? 'agendada' : 'em_dia'

  const supabase = await createClient()
  const { error } = await supabase.from('revisoes').insert({
    veiculo_id, motorista_id, tipo, fornecedor, valor, data_realizada, km_realizada, proxima_data, proxima_km, status, observacoes,
  })

  if (error) return { error: 'Erro ao registrar revisão' }
  revalidatePath('/sofia/revisoes')
  return { success: true }
}
