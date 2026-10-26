'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateKmAtual } from './_validation'
import { logAudit } from '@/lib/sofia/auditLog'
import { requireGestorFrotas } from '@/lib/sofia/permissoes'
import { AUTORIZACAO_STATUS, isValidEnum } from '@/lib/sofia/enums'

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

  // Leitura da KM anterior, upsert do lançamento e atualização de
  // veiculos.km_atual acontecem dentro de uma transação só, com lock na linha
  // do veículo — sem isso, dois lançamentos simultâneos se atropelam e o
  // veiculos.km_atual final pode ficar menor que o real (B-13).
  const { error } = await supabase.rpc('lancar_km_atomico', {
    p_equipe_id: equipe_id,
    p_veiculo_id: veiculo_id,
    p_motorista_id: motorista_id,
    p_km_atual: km_atual,
    p_data: data,
    p_observacoes: observacoes,
  })

  if (error) {
    // Só as regras de negócio da function (errcode 'SOF01') têm mensagem
    // segura de exibir. Qualquer outro erro do Postgres (constraint, permissão,
    // timeout) vira a mensagem genérica que a action já mostrava antes.
    return { error: error.code === 'SOF01' ? error.message : 'Erro ao registrar KM' }
  }

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
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

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

  if (!isValidEnum(AUTORIZACAO_STATUS, status)) return

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return

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
  if (!id || !isValidEnum(AUTORIZACAO_STATUS, status)) return

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return

  const update: Record<string, unknown> = { autorizacao_status: status }
  if (status === 'solicitado') update.autorizacao_solicitado_em = new Date().toISOString()
  if (status === 'sem_solicitacao' || status === 'autorizado') update.autorizacao_solicitado_em = null

  await supabase.from('km_excedido_desconto').update(update).eq('id', id)
  revalidatePath('/sofia/km')
  revalidatePath('/sofia/descontos')
  revalidatePath('/sofia/pendencias')
}

export type CorrecaoKmState = State & { placa?: string; kmVeiculo?: number; aviso?: string }

/**
 * F2 — corrige um lançamento de KM via RPC corrigir_km_atomico, que valida o
 * intervalo entre os vizinhos, recalcula veiculos.km_atual com o veículo
 * travado e grava o antes/depois no audit_log na mesma transação (sem logAudit).
 */
export async function corrigirKmAction(
  _prev: CorrecaoKmState,
  formData: FormData
): Promise<CorrecaoKmState> {
  const id = formData.get('id') as string
  const kmRaw = ((formData.get('km_novo') as string) ?? '').trim()
  const motivo = ((formData.get('motivo') as string) ?? '').trim() || null
  if (!id) return { error: 'ID inválido' }
  if (kmRaw === '') return { error: 'Informe o KM correto.' }
  const kmNovo = Number(kmRaw)
  const erroKm = validateKmAtual(kmNovo)
  if (erroKm) return { error: erroKm }
  // revisão B4: a coluna é integer; 1050.5 viraria erro genérico no banco
  if (!Number.isInteger(kmNovo)) return { error: 'O KM precisa ser um número inteiro, sem vírgula ou ponto.' }

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  const { data, error } = await supabase.rpc('corrigir_km_atomico', {
    p_km_id: id,
    p_km_novo: kmNovo,
    p_motivo: motivo,
  })
  if (error) return { error: error.code === 'SOF01' ? error.message : 'Erro ao corrigir o KM' }

  revalidatePath('/sofia/km')
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/audit')

  const r = data as { placa: string; veiculo_id: string; data: string; km_veiculo_depois: number }

  // KM excedido (dinheiro): a correção NÃO altera km_excedido_desconto — a
  // regra depende do João (spec §8, pergunta 1). Mas nunca fica em silêncio:
  // se o mês do lançamento tem registro, a mensagem de sucesso avisa
  // (correção obrigatória da revisão de 26/10).
  let aviso: string | undefined
  const { data: excedido, error: erroExcedido } = await supabase
    .from('km_excedido_desconto')
    .select('id')
    .eq('veiculo_id', r.veiculo_id)
    .eq('mes', `${r.data.slice(0, 7)}-01`)
    .maybeSingle()
  if (erroExcedido) {
    aviso = `Não foi possível conferir se este mês tem registro de KM excedido para o ${r.placa}. Confira em Descontos.`
  } else if (excedido) {
    aviso = `Este mês tem registro de KM excedido para o ${r.placa}. A correção não altera esse registro — confira em Descontos.`
  }

  return { success: true, placa: r.placa, kmVeiculo: r.km_veiculo_depois, aviso }
}
