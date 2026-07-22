'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateKmAtual } from './_validation'
import { logAudit } from '@/lib/sofia/auditLog'
import { requireAdmin } from '@/lib/auth/requireAdmin'

type State = { error?: string; success?: boolean }

async function verificarERegistrarExcedencia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  veiculoId: string,
  data: string
) {
  const mes = data.slice(0, 7) // '2026-06'
  const mesInicio = `${mes}-01`
  const [ano, mesNum] = mes.split('-').map(Number)
  const proximoMes = mesNum === 12
    ? `${ano + 1}-01-01`
    : `${ano}-${String(mesNum + 1).padStart(2, '0')}-01`

  const [{ data: veiculo }, { data: lancamentos }] = await Promise.all([
    supabase.from('veiculos').select('km_contratual_mensal, placa').eq('id', veiculoId).single(),
    supabase.from('km_diario').select('km_atual').eq('veiculo_id', veiculoId)
      .gte('data', mesInicio).lt('data', proximoMes).order('data', { ascending: true }),
  ])

  if (!veiculo?.km_contratual_mensal || !lancamentos || lancamentos.length < 2) return

  const kmRodados = lancamentos[lancamentos.length - 1].km_atual - lancamentos[0].km_atual
  if (kmRodados <= veiculo.km_contratual_mensal) return

  // Upsert km_excedido_desconto
  const { data: existing } = await supabase
    .from('km_excedido_desconto')
    .select('id')
    .eq('veiculo_id', veiculoId)
    .eq('mes', mesInicio)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('km_excedido_desconto')
      .update({ km_realizado: kmRodados, km_contratual: veiculo.km_contratual_mensal })
      .eq('id', existing.id)
  } else {
    await supabase.from('km_excedido_desconto').insert({
      veiculo_id: veiculoId,
      mes: mesInicio,
      km_contratual: veiculo.km_contratual_mensal,
      km_realizado: kmRodados,
      autorizacao_status: 'sem_solicitacao',
    })

    // Criar pendência apenas se não existir uma aberta com a mesma descrição
    const dataFormatada = new Date(`${mesInicio}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    const descricao = `KM excedido — ${veiculo.placa} ${dataFormatada}`
    const { data: pendenciaExistente } = await supabase
      .from('pendencias')
      .select('id')
      .eq('descricao', descricao)
      .eq('status', 'aberta')
      .maybeSingle()

    if (!pendenciaExistente) {
      await supabase.from('pendencias').insert({
        descricao,
        origem: 'km_excedido',
        status: 'aberta',
      })
    }
  }
}

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
    { onConflict: 'data,veiculo_id' }
  )

  if (error) return { error: 'Erro ao registrar KM' }

  await supabase.from('veiculos').update({ km_atual }).eq('id', veiculo_id)

  revalidatePath('/sofia/km')
  revalidatePath('/sofia/veiculos')
  await logAudit('km_diario', 'criou', null, `KM ${km_atual} km lançado — equipe ${equipe_id} (${data})`)

  // Verificar excedência e criar pendência/desconto automaticamente
  await verificarERegistrarExcedencia(supabase, veiculo_id, data)
  revalidatePath('/sofia/descontos')
  revalidatePath('/sofia/pendencias')

  return { success: true }
}

export async function deletarKmAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return { error: erroAdmin }

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
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return

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

export async function atualizarAutorizacaoKmExcedidoAction(id: string, formData: FormData): Promise<void> {
  const status = formData.get('status') as string
  if (!id || !['sem_solicitacao', 'solicitado', 'autorizado'].includes(status)) return

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return

  const update: Record<string, unknown> = { autorizacao_status: status }
  if (status === 'solicitado') update.autorizacao_solicitado_em = new Date().toISOString()
  if (status === 'sem_solicitacao' || status === 'autorizado') update.autorizacao_solicitado_em = null

  await supabase.from('km_excedido_desconto').update(update).eq('id', id)
  revalidatePath('/sofia/km')
  revalidatePath('/sofia/descontos')
  revalidatePath('/sofia/pendencias')
}
