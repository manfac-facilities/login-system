'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseChecklistFormData, validateChecklistInput } from './_validation'
import { logAudit } from '@/lib/sofia/auditLog'
import { isAdminEmail } from '@/lib/auth/admins'
import { validarVinculoEquipeUnico } from '@/lib/sofia/veiculos'

type State = { error?: string; success?: boolean; checklistId?: string }

export async function criarChecklistAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const input = parseChecklistFormData(formData)
  const {
    id,
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
    itens_problemas,
    fotos,
  } = input

  const validationError = validateChecklistInput(input)
  if (validationError) return { error: validationError }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('checklist').insert({
    id,
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
    itens_problemas,
    ...itens,
  })

  if (error) return { error: 'Erro ao salvar checklist' }

  const fotoRows = Object.entries(fotos).map(([posicao, foto]) => ({
    checklist_id: id,
    storage_path: foto.path,
    posicao,
    latitude: foto.lat,
    longitude: foto.lng,
    tirada_em: new Date().toISOString(),
  }))
  if (fotoRows.length > 0) {
    const { error: fotosError } = await supabase.from('checklist_fotos').insert(fotoRows)
    if (fotosError) {
      return {
        error: 'Checklist salvo, mas as fotos não foram registradas. Contate o suporte.',
        checklistId: id,
      }
    }
  }

  await logAudit('checklists', 'criou', id, `Checklist tipo '${tipo}' criado — veículo ${veiculo_id}`)

  const atribuiEquipe = tipo === 'troca' || (tipo === 'recebimento' && !!equipe_destino_id)

  if (atribuiEquipe) {
    const conflito = await validarVinculoEquipeUnico(supabase, equipe_destino_id as string, veiculo_id)
    if (conflito) {
      return { error: conflito, checklistId: id }
    }

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
      origem_checklist_id: id,
    })

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ equipe_id: equipe_destino_id })
      .eq('id', veiculo_id)

    const motoristaError = motorista_destino_id
      ? (
          await supabase
            .from('motoristas')
            .update({ equipe_id: equipe_destino_id })
            .eq('id', motorista_destino_id)
        ).error
      : null

    if (fechaError || insereError || veiculoError || motoristaError) {
      return {
        error:
          'Checklist salvo, mas a atribuição de equipe não foi totalmente registrada. Contate o suporte.',
        checklistId: id,
      }
    }

    await logAudit('veiculo_responsabilidade_historico', 'criou', null, `Atribuição de equipe: veículo ${veiculo_id} → equipe ${equipe_destino_id}`)
  } else if (tipo === 'devolucao') {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ equipe_id: null })
      .eq('id', veiculo_id)

    if (fechaError || veiculoError) {
      return {
        error: 'Checklist salvo, mas a devolução não foi totalmente registrada. Contate o suporte.',
        checklistId: id,
      }
    }

    await logAudit('veiculos', 'atualizou', veiculo_id, `Devolução registrada — veículo ${veiculo_id} sem equipe`)
  } else if (tipo === 'finalizacao_contrato') {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ status: 'inativo', equipe_id: null })
      .eq('id', veiculo_id)

    if (fechaError || veiculoError) {
      return {
        error: 'Checklist salvo, mas a finalização de contrato não foi totalmente registrada. Contate o suporte.',
        checklistId: id,
      }
    }

    await logAudit('veiculos', 'desativou', veiculo_id, `Finalização de contrato registrada via checklist — veículo ${veiculo_id}`)
  }

  revalidatePath('/sofia/checklist')
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/equipes')
  revalidatePath('/sofia/disponibilidade')
  return { success: true, checklistId: id }
}

export async function excluirChecklistAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem excluir checklists' }

  const { error } = await supabase.from('checklist').delete().eq('id', id)
  if (error) return { error: 'Erro ao excluir checklist' }
  revalidatePath('/sofia/checklist')
  return { success: true }
}
