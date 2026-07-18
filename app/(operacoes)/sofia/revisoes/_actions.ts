'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isAdminEmail } from '@/lib/auth/admins'

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

  const hoje = new Date().toISOString().split('T')[0]
  const status = proxima_data && proxima_data < hoje ? 'atrasada' : proxima_data ? 'agendada' : 'em_dia'

  const supabase = await createClient()
  const { error } = await supabase.from('revisoes').insert({
    veiculo_id, motorista_id, tipo, fornecedor, valor, data_realizada, km_realizada, proxima_data, proxima_km, status, observacoes,
  })

  if (error) return { error: 'Erro ao registrar revisão' }
  revalidatePath('/sofia/revisoes')
  return { success: true }
}

export async function excluirRevisaoAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem excluir revisões' }

  const { error } = await supabase.from('revisoes').delete().eq('id', id)
  if (error) return { error: 'Erro ao excluir revisão' }
  revalidatePath('/sofia/revisoes')
  return { success: true }
}
