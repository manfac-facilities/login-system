'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/sofia/auditLog'
import { podeGerirFrotas, requireGestorFrotas } from '@/lib/sofia/permissoes'
import { MSG_SO_ADMIN_AUTORIZA, podeAutorizarDescontoMulta } from '@/lib/sofia/multaPermissoes'
import { AUTORIZACAO_STATUS, isValidEnum } from '@/lib/sofia/enums'
import { ehEtapaMulta, exigeAdmin, infoEtapa, prazoPadrao, type MultaEtapa } from '@/lib/sofia/multaEtapas'

type State = { error?: string; success?: boolean }

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

function texto(formData: FormData, campo: string): string {
  return ((formData.get(campo) as string | null) ?? '').trim()
}

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
  const locadora = texto(formData, 'locadora') || null
  const auto_infracao = texto(formData, 'auto_infracao') || null
  const orgao_autuador = texto(formData, 'orgao_autuador') || null
  const pontosRaw = texto(formData, 'pontos')
  const prazoRaw = texto(formData, 'prazo_indicacao')

  if (!data || !data_recebimento || !tipo_infracao || valorRaw === '' || Number.isNaN(valor))
    return { error: 'Data, data de recebimento, tipo de infração e valor são obrigatórios' }

  let pontos: number | null = null
  if (pontosRaw !== '') {
    pontos = Number(pontosRaw)
    if (!Number.isInteger(pontos) || pontos < 0) return { error: 'Pontos deve ser um número inteiro, zero ou mais' }
  }
  if (prazoRaw !== '' && !DATA_RE.test(prazoRaw)) return { error: 'Prazo de indicação inválido' }
  const prazo_indicacao = prazoRaw || prazoPadrao(data_recebimento)

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('multas')
    .insert({
      veiculo_id,
      motorista_id,
      data,
      data_recebimento,
      tipo_infracao,
      descricao,
      valor,
      observacoes,
      locadora,
      auto_infracao,
      orgao_autuador,
      pontos,
      prazo_indicacao,
    })
    .select()
    .single()

  if (error) return { error: 'Erro ao registrar multa' }

  await logAudit('multas', 'criou', row.id, `Multa registrada — ${tipo_infracao} (${data})`)

  revalidatePath('/sofia/multas')
  return { success: true }
}

export async function excluirMultaAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !(await podeGerirFrotas(supabase)))
    return { error: 'Apenas administradores ou gestores de frotas podem excluir multas' }

  const { data: multa, error } = await supabase.from('multas').delete().eq('id', id).select().single()
  if (error) return { error: 'Erro ao excluir multa' }
  if (!multa) return { error: 'Multa não encontrada' }

  await logAudit('multas', 'excluiu', id, `Multa excluída — ${multa.tipo_infracao ?? multa.descricao ?? id}`)

  revalidatePath('/sofia/multas')
  return { success: true }
}

export async function excluirMultasEmMassaAction(ids: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !(await podeGerirFrotas(supabase)))
    throw new Error('Apenas administradores ou gestores de frotas podem excluir multas')

  // O delete e o audit log de cada multa acontecem na mesma transação dentro
  // da function. Antes o loop de logAudit rodava depois do delete já commitado:
  // uma falha no meio deixava multa excluída sem rastro de quem excluiu (B-18).
  // O autor do log sai de auth.uid() dentro da function, não daqui — a function
  // é alcançável direto em /rpc/, então um autor vindo do cliente seria forjável.
  const { error } = await supabase.rpc('excluir_multas_em_massa', { p_ids: ids })
  if (error) throw error

  revalidatePath('/sofia/multas')
}

// ---------------------------------------------------------------------------
// Fluxo por etapa (spec 2026-11-03 §2.1/§3.5). A etapa só muda pela RPC
// sofia_multa_registrar_etapa; status/autorização/desconto são derivados no banco.
// ---------------------------------------------------------------------------

/** Chaves de p_dados aceitas por etapa (lista fechada; nada fora daqui vai para a RPC). */
const CHAVES_POR_ETAPA: Record<Exclude<MultaEtapa, 'registrada'>, readonly string[]> = {
  condutor: ['motorista_id', 'observacao'],
  termo: ['storage_path', 'observacao'],
  indicado: ['indicado_em', 'protocolo', 'observacao'],
  validada: ['em_nome_de', 'canal', 'observacao'],
  contestada: ['em_nome_de', 'canal', 'observacao'],
  cobrada: ['boleto_lancado_em', 'observacao'],
  solicitado: ['observacao'],
  autorizado: ['observacao'],
  descontada: ['valor_descontado', 'tipo_desconto', 'competencia', 'observacao'],
}

/** Mensagem fixa por etapa: nunca repassar error.message do banco para a tela. */
const ERRO_ETAPA: Record<Exclude<MultaEtapa, 'registrada'>, string> = {
  condutor: 'Não foi possível confirmar o condutor. Escolha o motorista e tente de novo.',
  termo: 'Não foi possível registrar o termo. Anexe o termo assinado e tente de novo.',
  indicado: 'Não foi possível registrar a indicação. Informe a data da indicação e tente de novo.',
  validada: 'Não foi possível registrar a validação. Informe em nome de quem e o canal.',
  contestada: 'Não foi possível registrar a contestação. Informe em nome de quem, o canal e o motivo.',
  cobrada: 'Não foi possível registrar o boleto. Informe a data em que foi lançado.',
  solicitado: 'Não foi possível registrar a solicitação de desconto. Atualize a página e tente de novo.',
  autorizado: 'Não foi possível registrar a autorização. Atualize a página e tente de novo.',
  descontada:
    'Não foi possível registrar o desconto. Informe valor (entre zero e o valor da multa), tipo e competência.',
}

const CANAIS = ['email', 'whatsapp', 'telefone', 'presencial']

function montarDados(id: string, etapa: Exclude<MultaEtapa, 'registrada'>, formData: FormData) {
  const dados: Record<string, string> = {}
  for (const chave of CHAVES_POR_ETAPA[etapa]) {
    const v = texto(formData, chave)
    if (v !== '') dados[chave] = v
  }
  // validação mínima no app; o banco revalida tudo
  if (etapa === 'termo' && !(dados.storage_path ?? '').startsWith(`multas/${id}/`)) return null
  if ((etapa === 'validada' || etapa === 'contestada') && dados.canal && !CANAIS.includes(dados.canal)) return null
  if (etapa === 'descontada') {
    if (dados.tipo_desconto && !['total', 'parcial'].includes(dados.tipo_desconto)) return null
    // <input type="month"> manda YYYY-MM; o banco grava o dia 1
    if (dados.competencia && /^\d{4}-\d{2}$/.test(dados.competencia)) dados.competencia += '-01'
  }
  for (const campo of ['indicado_em', 'boleto_lancado_em', 'competencia'])
    if (dados[campo] && !DATA_RE.test(dados[campo])) return null
  return dados
}

function revalidarMulta(id: string) {
  revalidatePath('/sofia/multas')
  revalidatePath(`/sofia/multas/${id}`)
  revalidatePath('/sofia/descontos')
  revalidatePath('/sofia/pendencias')
  revalidatePath('/sofia/motoristas')
}

export async function registrarEtapaMultaAction(id: string, etapa: string, formData: FormData): Promise<State> {
  if (!id) return { error: 'ID inválido' }
  if (!ehEtapaMulta(etapa) || etapa === 'registrada') return { error: 'Etapa inválida' }

  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }

  // autorizar (de solicitado) e revogar (de autorizado) são só do admin
  if (etapa === 'autorizado' || etapa === 'solicitado') {
    const { data: atual, error: erroLeitura } = await supabase
      .from('multas')
      .select('etapa')
      .eq('id', id)
      .single()
    if (erroLeitura || !atual || !ehEtapaMulta(atual.etapa)) return { error: 'Multa não encontrada' }
    if (exigeAdmin(atual.etapa, etapa) && !(await podeAutorizarDescontoMulta(supabase)))
      return { error: MSG_SO_ADMIN_AUTORIZA }
  }

  const dados = montarDados(id, etapa, formData)
  if (!dados) return { error: ERRO_ETAPA[etapa] }

  const { error } = await supabase.rpc('sofia_multa_registrar_etapa', {
    p_multa_id: id,
    p_etapa: etapa,
    p_dados: dados,
  })
  if (error) return { error: ERRO_ETAPA[etapa] }

  await logAudit('multas', 'atualizou', id, `Etapa: ${infoEtapa(etapa).rotulo}`)
  revalidarMulta(id)
  return { success: true }
}

export async function editarPrazoMultaAction(id: string, formData: FormData): Promise<State> {
  const prazo = texto(formData, 'prazo_indicacao')
  if (!id || !DATA_RE.test(prazo)) return { error: 'Informe o prazo de indicação' }
  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }
  const { error } = await supabase.from('multas').update({ prazo_indicacao: prazo }).eq('id', id)
  if (error) return { error: 'Não foi possível alterar o prazo' }
  await logAudit('multas', 'atualizou', id, `Prazo de indicação: ${prazo}`)
  revalidarMulta(id)
  return { success: true }
}

export async function registrarDobroAction(id: string, formData: FormData): Promise<State> {
  const responsavel = texto(formData, 'responsavel_dobro')
  if (!id || (responsavel !== 'empresa' && responsavel !== 'motorista'))
    return { error: 'Informe quem perdeu o prazo (empresa ou motorista)' }
  const supabase = await createClient()
  const erroGestor = await requireGestorFrotas(supabase)
  if (erroGestor) return { error: erroGestor }
  const { error } = await supabase
    .from('multas')
    .update({ pago_em_dobro: true, responsavel_dobro: responsavel })
    .eq('id', id)
  if (error) return { error: 'Não foi possível registrar a multa em dobro' }
  await logAudit('multas', 'atualizou', id, `Paga em dobro — responsável: ${responsavel}`)
  revalidarMulta(id)
  return { success: true }
}

/**
 * Assinatura antiga mantida (Descontos importa). Agora passa pelo fluxo de etapas:
 * solicitado → solicitado, autorizado → autorizado, sem_solicitacao → cobrada
 * (cancelar solicitação; de "autorizado" o banco recusa — o admin revoga antes).
 */
export async function atualizarAutorizacaoMultaAction(id: string, formData: FormData): Promise<State> {
  const status = formData.get('status') as string
  if (!isValidEnum(AUTORIZACAO_STATUS, status)) return { error: 'Status de autorização inválido' }
  const etapa: MultaEtapa = status === 'sem_solicitacao' ? 'cobrada' : status
  // devolve a recusa (ex.: "Só o administrador autoriza o desconto") para a tela mostrar
  return registrarEtapaMultaAction(id, etapa, new FormData())
}
