'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateKmAtual } from './_validation'
import { logAudit } from '@/lib/sofia/auditLog'

type State = { error?: string; success?: boolean }

export async function lancarKmAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const equipe_id = formData.get('equipe_id') as string
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const km_atual = Number(formData.get('km_atual'))
  const data =
    (formData.get('data') as string) || new Date().toISOString().split('T')[0]
  const observacoes = ((formData.get('observacoes') as string) ?? '').trim() || null

  if (!equipe_id || !veiculo_id) return { error: 'Selecione a equipe' }
  const validationError = validateKmAtual(km_atual)
  if (validationError) return { error: validationError }

  const supabase = await createClient()

  const { data: veiculo } = await supabase
    .from('veiculos')
    .select('km_atual')
    .eq('id', veiculo_id)
    .single()

  if (veiculo && km_atual < veiculo.km_atual) {
    return {
      error: `KM não pode ser menor que a última KM registrada (${veiculo.km_atual.toLocaleString('pt-BR')} km)`,
    }
  }

  const { error } = await supabase.from('km_diario').upsert(
    { equipe_id, veiculo_id, motorista_id, km_atual, data, observacoes },
    { onConflict: 'data,equipe_id' }
  )

  if (error) return { error: 'Erro ao registrar KM' }

  await supabase.from('veiculos').update({ km_atual }).eq('id', veiculo_id)

  revalidatePath('/sofia/km')
  revalidatePath('/sofia/veiculos')
  await logAudit('km_diario', 'criou', null, `KM ${km_atual} km lançado — equipe ${equipe_id} (${data})`)
  return { success: true }
}

export async function deletarKmAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('km_diario').delete().eq('id', id)

  if (error) return { error: 'Erro ao excluir lançamento' }

  revalidatePath('/sofia/km')
  await logAudit('km_diario', 'excluiu', id, 'Lançamento de KM excluído')
  return { success: true }
}

export async function upsertKmExcedidoStatusAction(formData: FormData): Promise<void> {
  const veiculo_id = formData.get('veiculo_id') as string
  const mes = formData.get('mes') as string
  const km_contratual = Number(formData.get('km_contratual'))
  const km_realizado = Number(formData.get('km_realizado'))
  const status = formData.get('status') as string

  if (!['sem_solicitacao', 'solicitado', 'autorizado'].includes(status)) return

  const supabase = await createClient()
  const update: Record<string, unknown> = {
    veiculo_id,
    mes,
    km_contratual,
    km_realizado,
    autorizacao_status: status,
  }
  if (status === 'solicitado') update.autorizacao_solicitado_em = new Date().toISOString()
  if (status === 'sem_solicitacao') update.autorizacao_solicitado_em = null

  await supabase
    .from('km_excedido_desconto')
    .upsert(update, { onConflict: 'veiculo_id,mes' })

  revalidatePath('/sofia/km')
  revalidatePath('/sofia/motoristas')
  revalidatePath('/sofia/pendencias')
}
