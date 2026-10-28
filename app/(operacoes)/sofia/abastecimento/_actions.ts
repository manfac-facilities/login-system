'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/sofia/auditLog'
import { requireGestorFrotas } from '@/lib/sofia/permissoes'

type State = { error?: string; success?: boolean }

export async function lancarAbastecimentoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const valorRaw = (formData.get('valor') as string | null) ?? ''
  const litrosRaw = (formData.get('litros') as string | null) ?? ''
  const km = formData.get('km') ? Number(formData.get('km')) : null
  const posto = ((formData.get('posto') as string) ?? '').trim() || null
  const data =
    (formData.get('data') as string) || new Date().toISOString().split('T')[0]

  if (!veiculo_id) return { error: 'Selecione a equipe para identificar o veículo' }

  // valor: obrigatório e >= 0 (0 é válido — ex: voucher de combustível grátis)
  if (valorRaw.trim() === '') return { error: 'Informe o valor do abastecimento' }
  const valor = Number(valorRaw)
  if (Number.isNaN(valor) || valor < 0) return { error: 'Valor do abastecimento inválido' }

  // litros: obrigatório e >= 0 (0 é válido — ex: ajuste manual)
  if (litrosRaw.trim() === '') return { error: 'Informe os litros abastecidos' }
  const litros = Number(litrosRaw)
  if (Number.isNaN(litros) || litros < 0) return { error: 'Litros inválidos' }

  const supabase = await createClient()
  const { error } = await supabase.from('abastecimentos').insert({
    veiculo_id,
    data,
    litros,
    valor,
    km,
    posto,
  })

  if (error) return { error: 'Erro ao registrar abastecimento' }

  revalidatePath('/sofia/abastecimento')
  await logAudit('abastecimentos', 'criou', null, `Abastecimento R$ ${valor.toFixed(2)} — veículo ${veiculo_id} (${data})`)
  return { success: true }
}

export async function deletarAbastecimentoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  const { error } = await supabase.from('abastecimentos').delete().eq('id', id)

  if (error) return { error: 'Erro ao excluir abastecimento' }

  revalidatePath('/sofia/abastecimento')
  await logAudit('abastecimentos', 'excluiu', id, 'Abastecimento excluído')
  return { success: true }
}

/**
 * F3 — corrige litros, valor e KM via RPC corrigir_abastecimento (valida o KM
 * com a linha travada e grava antes/depois no audit_log na mesma transação;
 * sem logAudit). NÃO mexe em veiculos.km_atual: quem define é o KM diário.
 */
export async function corrigirAbastecimentoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  const litrosRaw = ((formData.get('litros') as string | null) ?? '').trim()
  const valorRaw = ((formData.get('valor') as string | null) ?? '').trim()
  const kmRaw = ((formData.get('km') as string | null) ?? '').trim()
  const motivo = ((formData.get('motivo') as string) ?? '').trim() || null
  if (!id) return { error: 'ID inválido' }

  const litros = Number(litrosRaw)
  if (litrosRaw === '' || Number.isNaN(litros) || litros < 0) return { error: 'Informe os litros abastecidos.' }
  const valor = Number(valorRaw)
  if (valorRaw === '' || Number.isNaN(valor) || valor < 0) return { error: 'Informe o valor do abastecimento.' }
  let km: number | null = null
  if (kmRaw !== '') {
    km = Number(kmRaw)
    if (Number.isNaN(km) || km < 0 || !Number.isInteger(km)) return { error: 'KM inválido.' }
  }

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  const { error } = await supabase.rpc('corrigir_abastecimento', {
    p_abastecimento_id: id,
    p_litros: litros,
    p_valor: valor,
    p_km: km,
    p_motivo: motivo,
  })
  if (error) return { error: error.code === 'SOF01' ? error.message : 'Erro ao corrigir o abastecimento' }

  revalidatePath('/sofia/abastecimento')
  revalidatePath('/sofia/custos')
  revalidatePath('/sofia/audit')
  return { success: true }
}
