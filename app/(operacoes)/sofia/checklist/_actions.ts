'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { FOTO_POSICOES_OBRIGATORIAS, parseChecklistFormData, tipoDaFoto, validateChecklistInput } from './_validation'
import { logAudit } from '@/lib/sofia/auditLog'
import { ehAdminSofia } from '@/lib/sofia/multaPermissoes'
import { requireGestorFrotas } from '@/lib/sofia/permissoes'
import { hojeSP } from '@/lib/sofia/multaEtapas'
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
    chave_entregue,
    cartao_combustivel_entregue,
    assinatura_motorista,
    itens,
    itens_problemas,
    fotos,
    avarias,
  } = input
  // derivados das avarias registradas (telas antigas continuam coerentes)
  const avaria_identificada = avarias.length > 0
  const avaria_descricao = avarias.length > 0 ? avarias.map((a) => a.peca).join(', ') : null

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

  // ordem obrigatória: checklist → avarias → fotos (a foto de avaria aponta para a avaria)
  const idDaAvaria = new Map<string, string>()
  if (avarias.length > 0) {
    const avariaRows = avarias.map((a) => {
      const avariaId = crypto.randomUUID()
      idDaAvaria.set(a.ref, avariaId)
      return {
        id: avariaId,
        checklist_id: id,
        peca: a.peca,
        tamanho: a.tamanho,
        acao: a.acao,
        descricao: a.descricao,
      }
    })
    const { error: avariasError } = await supabase.from('checklist_avarias').insert(avariaRows)
    if (avariasError) {
      return {
        error: 'Checklist salvo, mas as avarias não foram registradas. Contate o suporte.',
        checklistId: id,
      }
    }
  }

  const fotoRows = Object.entries(fotos).map(([posicao, foto]) => ({
    checklist_id: id,
    storage_path: foto.path,
    posicao,
    latitude: foto.lat,
    longitude: foto.lng,
    tirada_em: new Date().toISOString(),
    tipo_foto: tipoDaFoto(posicao, foto),
    avaria_id: foto.avaria_ref ? (idDaAvaria.get(foto.avaria_ref) ?? null) : null,
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
  const reatribui = atribuiEquipe || tipo === 'devolucao' || tipo === 'finalizacao_contrato'

  if (reatribui) {
    if (atribuiEquipe) {
      const conflito = await validarVinculoEquipeUnico(supabase, equipe_destino_id as string, veiculo_id)
      if (conflito) {
        return { error: conflito, checklistId: id }
      }
    }

    // Fechar o histórico anterior, abrir o novo, atualizar veiculos.equipe_id e
    // motoristas.equipe_id acontecem numa transação só. Antes eram 4 escritas
    // soltas: uma falha no meio deixava o banco inconsistente e o usuário só
    // via um aviso pra "contatar o suporte" (B-06).
    const { error: rpcError } = await supabase.rpc('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: veiculo_id,
      p_equipe_id: atribuiEquipe ? equipe_destino_id : null,
      p_motorista_id: atribuiEquipe ? motorista_destino_id : null,
      p_tipo: tipo,
      p_checklist_id: id,
    })

    if (rpcError) {
      // O formulário já envolve esta mensagem em "O checklist já foi salvo, mas
      // houve um erro em uma etapa seguinte: …", então aqui só entra o que
      // falhou — e o nome da etapa varia por tipo de checklist.
      const etapa =
        tipo === 'devolucao'
          ? 'a devolução não foi registrada'
          : tipo === 'finalizacao_contrato'
            ? 'a finalização de contrato não foi registrada'
            : 'a atribuição de equipe não foi registrada'
      return {
        // "Contate o suporte" é obrigatório aqui: o formulário manda não
        // reenviar (o checklist já existe) e não há tela nenhuma pra refazer
        // só a etapa de equipe. Sem essa saída, o usuário fica com o veículo
        // na equipe antiga e nenhuma ação possível.
        error: `Erro ao processar o checklist: ${etapa}. Nenhuma alteração de equipe foi aplicada ao veículo. Contate o suporte.`,
        checklistId: id,
      }
    }

    if (atribuiEquipe) {
      await logAudit('veiculo_responsabilidade_historico', 'criou', null, `Atribuição de equipe: veículo ${veiculo_id} → equipe ${equipe_destino_id}`)
    } else if (tipo === 'devolucao') {
      await logAudit('veiculos', 'atualizou', veiculo_id, `Devolução registrada — veículo ${veiculo_id} sem equipe`)
    } else if (tipo === 'finalizacao_contrato') {
      await logAudit('veiculos', 'desativou', veiculo_id, `Finalização de contrato registrada via checklist — veículo ${veiculo_id}`)
    }
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
  // Só o admin exclui o checklist inteiro (decisão do João, 03/11): a cascata leva
  // fotos e avarias, e a trigger trg_excluir_so_admin grava o audit_log com tudo.
  if (!user?.email || !(await ehAdminSofia(supabase)))
    return { error: 'Apenas administradores podem excluir checklists' }

  const { error } = await supabase.from('checklist').delete().eq('id', id)
  if (error) {
    if ((error as { code?: string }).code === '23503')
      return { error: 'Este registro tem vínculos (troca de responsabilidade/documentos) e não pode ser excluído' }
    return { error: 'Erro ao excluir checklist' }
  }
  revalidatePath('/sofia/checklist')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Histórico do checklist e avarias (spec 2026-11-03 §2.9/§2.10)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Baixa da avaria (sem volta). Quem deu baixa sai do JWT, na trigger — não daqui. */
export async function marcarAvariaReparadaAction(id: string, data: string): Promise<State> {
  if (!UUID_RE.test(id ?? '')) return { error: 'Avaria inválida' }
  const hoje = hojeSP()
  if (!DATA_RE.test(data ?? '') || data > hoje) return { error: 'Informe a data do reparo (hoje ou antes)' }

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  // hoje = agora; dia passado = meio-dia de São Paulo (a trigger recusa data no futuro)
  const reparada_em = data === hoje ? new Date().toISOString() : `${data}T12:00:00-03:00`
  const { error } = await supabase
    .from('checklist_avarias')
    .update({ status: 'reparada', reparada_em })
    .eq('id', id)
    .eq('status', 'aberta')
  if (error) return { error: 'Não foi possível marcar a avaria como reparada' }
  await logAudit('checklist_avarias', 'atualizou', id, `Avaria marcada como reparada em ${data}`)
  revalidatePath('/sofia/checklist', 'layout')
  return { success: true }
}

/** Reparo ou troca, definido depois por Frotas. */
export async function definirAcaoAvariaAction(id: string, acao: string): Promise<State> {
  if (!UUID_RE.test(id ?? '')) return { error: 'Avaria inválida' }
  if (acao !== 'reparo' && acao !== 'troca') return { error: 'Escolha reparo ou troca' }
  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }
  const { error } = await supabase.from('checklist_avarias').update({ acao }).eq('id', id)
  if (error) return { error: 'Não foi possível salvar reparo/troca' }
  await logAudit('checklist_avarias', 'atualizou', id, `Avaria: ${acao}`)
  revalidatePath('/sofia/checklist', 'layout')
  return { success: true }
}

export interface UltimoChecklist {
  ultimo: { id: string; data: string } | null
  /** posição obrigatória → URL assinada (3600 s) */
  fotos: Record<string, string>
}

/** Painel da troca: último checklist do veículo, só leitura (qualquer usuário do Sofia, pela RLS). */
export async function ultimoChecklistAction(veiculoId: string): Promise<UltimoChecklist> {
  const vazio: UltimoChecklist = { ultimo: null, fotos: {} }
  if (!UUID_RE.test(veiculoId ?? '')) return vazio
  const supabase = await createClient()
  const { data: ultimo } = await supabase
    .from('checklist')
    .select('id, data')
    .eq('veiculo_id', veiculoId)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!ultimo) return vazio

  const { data: fotos } = await supabase
    .from('checklist_fotos')
    .select('storage_path, posicao')
    .eq('checklist_id', ultimo.id)
    .in('posicao', [...FOTO_POSICOES_OBRIGATORIAS])
  const lista = fotos ?? []
  if (lista.length === 0) return { ultimo, fotos: {} }
  const { data: assinadas } = await supabase.storage
    .from('checklist-fotos')
    .createSignedUrls(lista.map((f) => f.storage_path), 3600)
  const mapa: Record<string, string> = {}
  for (const f of lista) {
    const url = (assinadas ?? []).find((s) => s.path === f.storage_path)?.signedUrl
    if (url && f.posicao) mapa[f.posicao] = url
  }
  return { ultimo, fotos: mapa }
}
