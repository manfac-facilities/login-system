'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseChecklistFormData, validateChecklistInput } from './_validation'

type State = { error?: string; success?: boolean; checklistId?: string }

export async function criarChecklistAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const input = parseChecklistFormData(formData)
  const {
    tipo,
    equipe_id,
    veiculo_id,
    motorista_id,
    equipe_destino_id,
    motorista_destino_id,
    observacoes,
    latitude,
    longitude,
    avaria_identificada,
    avaria_descricao,
    chave_entregue,
    cartao_combustivel_entregue,
    assinatura_motorista,
    itens,
  } = input

  const validationError = validateChecklistInput(input)
  if (validationError) return { error: validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('checklist')
    .insert({
      tipo,
      equipe_id,
      veiculo_id,
      motorista_id,
      equipe_destino_id,
      motorista_destino_id,
      observacoes,
      latitude,
      longitude,
      created_by: user?.id,
      avaria_identificada,
      avaria_descricao,
      chave_entregue,
      cartao_combustivel_entregue,
      assinatura_motorista,
      ...itens,
    })
    .select('id')
    .single()

  if (error) return { error: 'Erro ao salvar checklist' }

  if (tipo === 'troca') {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: insereError } = await supabase.from('veiculo_responsabilidade_historico').insert({
      veiculo_id,
      equipe_id: equipe_destino_id,
      motorista_id: motorista_destino_id,
      inicio: hoje,
      origem_checklist_id: data.id,
    })

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ equipe_id: equipe_destino_id })
      .eq('id', veiculo_id)

    if (fechaError || insereError || veiculoError) {
      return {
        error: 'Checklist salvo, mas a troca de responsável não foi totalmente registrada. Contate o suporte.',
        checklistId: data.id,
      }
    }
  }

  revalidatePath('/sofia/checklist')
  revalidatePath('/sofia/veiculos')
  return { success: true, checklistId: data.id }
}

export type UploadFotoResult = { error: string } | { success: true }

export async function uploadFotoAction(
  checklistId: string,
  storagePath: string,
  posicao: string,
  lat: number | null,
  lng: number | null
): Promise<UploadFotoResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('checklist_fotos').insert({
    checklist_id: checklistId,
    storage_path: storagePath,
    posicao,
    latitude: lat,
    longitude: lng,
    tirada_em: new Date().toISOString(),
  })

  if (error) return { error: 'Erro ao salvar registro da foto' }

  revalidatePath('/sofia/checklist')
  return { success: true }
}
