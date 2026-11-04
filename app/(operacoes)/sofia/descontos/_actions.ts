'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireGestorFrotas } from '@/lib/sofia/permissoes'
import { MULTA_STATUS, isValidEnum } from '@/lib/sofia/enums'
import { registrarEtapaMultaAction } from '../multas/_actions'

function parseDescontoFormData(formData: FormData) {
  const id = formData.get('id') as string
  const valor_descontado = Number(formData.get('valor_descontado'))
  const tipo_desconto = formData.get('tipo_desconto') as string
  const autorizacao_assinada = formData.get('autorizacao_assinada') === 'true'
  return { id, valor_descontado, tipo_desconto, autorizacao_assinada }
}

type State = { error?: string; success?: boolean }

// ---------------------------------------------------------------------------
// MULTA: pelo fluxo de etapas (spec 2026-11-03 §2.1/§2.6/§4.3). Depois de
// sdd-sql-sofia-multa-avaria.sql, status/valor_descontado/tipo_desconto de multas
// só mudam pela RPC sofia_multa_registrar_etapa (registrarEtapaMultaAction).
// Avançar a multa (validar, cobrar...) é no detalhe /sofia/multas/[id]; o antigo
// atualizarStatusMultaAction foi removido.
// ---------------------------------------------------------------------------

/** Registrar desconto = etapa "descontada" (só a partir de "autorizado"; o banco confere). */
export async function registrarDescontoMultaAction(_prev: State, formData: FormData): Promise<State> {
  const id = ((formData.get('id') as string | null) ?? '').trim()
  const valorRaw = ((formData.get('valor_descontado') as string | null) ?? '').trim()
  const tipo_desconto = ((formData.get('tipo_desconto') as string | null) ?? '').trim()
  const competencia = ((formData.get('competencia') as string | null) ?? '').trim()

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  const valor_descontado = Number(valorRaw)
  if (!id || valorRaw === '' || Number.isNaN(valor_descontado) || valor_descontado < 0)
    return { error: 'Valor do desconto inválido' }
  if (tipo_desconto !== 'total' && tipo_desconto !== 'parcial')
    return { error: 'Informe o tipo de desconto (total ou parcial)' }
  if (!/^\d{4}-\d{2}$/.test(competencia)) return { error: 'Informe a competência (mês do contracheque)' }

  const { data: multa, error } = await supabase.from('multas').select('valor').eq('id', id).single()
  if (error || !multa) return { error: 'Multa não encontrada' }
  if (valor_descontado > Number((multa as { valor: number }).valor))
    return { error: 'Valor do desconto não pode ser maior que o valor original' }

  const dados = new FormData()
  dados.set('valor_descontado', valorRaw)
  dados.set('tipo_desconto', tipo_desconto)
  dados.set('competencia', competencia)
  return registrarEtapaMultaAction(id, 'descontada', dados)
}

/** Desfazer desconto = descontada → autorizado (gestor/admin; o banco limpa valor/tipo/competência). */
export async function desfazerDescontoMultaAction(id: string, _prev?: State): Promise<State> {
  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }
  return registrarEtapaMultaAction(id, 'autorizado', new FormData())
}

export async function atualizarStatusDescontoSinistroAction(id: string, status: string) {
  if (!isValidEnum(MULTA_STATUS, status)) throw new Error('Status de desconto inválido')

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) throw new Error(erroGestor)

  const { error } = await supabase.from('sinistros').update({ status_desconto: status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoSinistroAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) throw new Error(erroGestor)

  if (Number.isNaN(valor_descontado) || valor_descontado < 0) {
    throw new Error('Valor do desconto inválido')
  }

  const { data: sinistro } = await supabase.from('sinistros').select('valor_dano').eq('id', id).single()
  if (sinistro && (sinistro as { valor_dano: number | null }).valor_dano != null && valor_descontado > (sinistro as { valor_dano: number }).valor_dano) {
    throw new Error('Valor do desconto não pode ser maior que o valor original')
  }

  const { error } = await supabase
    .from('sinistros')
    .update({ valor_descontado, tipo_desconto, autorizacao_assinada, status_desconto: 'descontada' })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}

export async function desfazerDescontoSinistroAction(id: string) {
  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) throw new Error(erroGestor)

  const { error } = await supabase.from('sinistros').update({ status_desconto: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}
