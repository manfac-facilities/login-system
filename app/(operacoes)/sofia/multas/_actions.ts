'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { registrarAuditoria } from '@/lib/sofia/auditLog'
import { isAdminEmail } from '@/lib/auth/admins'

type State = { error?: string; success?: boolean }

export async function criarMultaAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const data_recebimento = (formData.get('data_recebimento') as string) || ''
  const tipoInfracaoSelect = ((formData.get('tipo_infracao') as string) ?? '').trim()
  const tipoInfracaoOutra = ((formData.get('tipo_infracao_outra') as string) ?? '').trim()
  const tipo_infracao = tipoInfracaoSelect === 'outra' ? tipoInfracaoOutra : tipoInfracaoSelect
  const descricao = ((formData.get('descricao') as string) ?? '').trim() || null
  const valorRaw = formData.get('valor') as string
  const valor = Number(valorRaw)
  const observacoes = ((formData.get('observacoes') as string) ?? '').trim() || null

  if (!data || !data_recebimento || !tipo_infracao || valorRaw === '' || Number.isNaN(valor))
    return { error: 'Data, data de recebimento, tipo de infração e valor são obrigatórios' }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('multas')
    .insert({ veiculo_id, motorista_id, data, data_recebimento, tipo_infracao, descricao, valor, observacoes })
    .select()
    .single()

  if (error) return { error: 'Erro ao registrar multa' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await registrarAuditoria(supabase, {
    tabela: 'multas',
    registro_id: row.id,
    acao: 'criacao',
    dados: row,
    usuario_email: user?.email ?? null,
  })

  revalidatePath('/sofia/multas')
  return { success: true }
}

export async function enviarParaDescontoEmMassaAction(ids: string[]) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('multas')
    .update({ status: 'validada' })
    .in('id', ids)
    .eq('status', 'pendente')
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function excluirMultaAction(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    throw new Error('Apenas administradores podem excluir multas')

  const { data: multa } = await supabase.from('multas').select('*').eq('id', id).single()
  if (!multa) throw new Error('Multa não encontrada')

  await registrarAuditoria(supabase, {
    tabela: 'multas',
    registro_id: id,
    acao: 'exclusao',
    dados: multa,
    usuario_email: user.email,
  })

  const { error } = await supabase.from('multas').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
}

export async function excluirMultasEmMassaAction(ids: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    throw new Error('Apenas administradores podem excluir multas')

  const { data: multas } = await supabase.from('multas').select('*').in('id', ids)

  for (const multa of multas ?? []) {
    await registrarAuditoria(supabase, {
      tabela: 'multas',
      registro_id: multa.id,
      acao: 'exclusao',
      dados: multa,
      usuario_email: user.email,
    })
  }

  const { error } = await supabase.from('multas').delete().in('id', ids)
  if (error) throw error
  revalidatePath('/sofia/multas')
}
