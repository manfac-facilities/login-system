'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/sofia/auditLog'
import { requireAdmin } from '@/lib/auth/requireAdmin'

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
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return { error: erroAdmin }

  const { error } = await supabase.from('abastecimentos').delete().eq('id', id)

  if (error) return { error: 'Erro ao excluir abastecimento' }

  revalidatePath('/sofia/abastecimento')
  await logAudit('abastecimentos', 'excluiu', id, 'Abastecimento excluído')
  return { success: true }
}
