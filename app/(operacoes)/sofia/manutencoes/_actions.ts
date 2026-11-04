'use server'
/**
 * Manutenção corretiva (spec 2026-11-03 §3.2). Escrita só de gestor de frotas/admin:
 * `requireGestorFrotas` aqui (mensagem amigável) e RLS + guarda nas RPCs no banco.
 */
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireGestorFrotas } from '@/lib/sofia/permissoes'
import { logAudit } from '@/lib/sofia/auditLog'
import { STATUS_LBL, caminhoAnexoValido, proximoStatus, validarAbertura, type ManutencaoStatus } from '@/lib/sofia/manutencoes'

type State = { error?: string; success?: boolean }

const ERRO_ABRIR = 'Erro ao registrar manutenção'

function revalidar() {
  revalidatePath('/sofia/manutencoes')
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/veiculos/[id]', 'page')
  revalidatePath('/sofia/equipes')
  revalidatePath('/sofia/disponibilidade')
  revalidatePath('/sofia')
}

/** Erro de regra (SOF01) vem com texto pronto do banco; o resto vira mensagem genérica. */
function mensagemRpc(error: { code?: string; message?: string }, generica: string, onde: string): string {
  if (error.code === 'SOF01' && error.message) return error.message
  console.error(`[manutencoes] ${onde} falhou:`, error)
  return generica
}

const texto = (v: FormDataEntryValue | null) => String(v ?? '').trim()
const dinheiro = (s: string): number | null => (s === '' ? null : Number(s.replace(',', '.')))

export async function abrirManutencaoAction(_prev: State, formData: FormData): Promise<State> {
  const supabase = await createClient()
  const negado = await requireGestorFrotas(supabase)
  if (negado) return { error: negado }

  const f = {
    veiculo_id: texto(formData.get('veiculo_id')),
    defeito: texto(formData.get('defeito')),
    data_entrada: texto(formData.get('data_entrada')),
    saida_prevista: texto(formData.get('saida_prevista')),
  }
  const invalido = validarAbertura(f)
  if (invalido) return { error: invalido }
  const custo = dinheiro(texto(formData.get('custo')))
  if (custo != null && (!Number.isFinite(custo) || custo < 0)) return { error: 'O custo não pode ser negativo.' }

  const { error } = await supabase.rpc('sofia_abrir_manutencao', {
    p_veiculo_id: f.veiculo_id,
    p_defeito: f.defeito,
    p_oficina: texto(formData.get('oficina')) || null,
    p_data_entrada: f.data_entrada,
    p_saida_prevista: f.saida_prevista || null,
    p_custo: custo,
    p_quem_arca: texto(formData.get('quem_arca')) || null,
    p_status: texto(formData.get('status')) || null,
    p_tirar_da_equipe: formData.get('tirar_da_equipe') === 'on',
    p_observacoes: texto(formData.get('observacoes')) || null,
  })
  if (error) return { error: mensagemRpc(error, ERRO_ABRIR, 'abrir') }
  revalidar()
  return { success: true }
}

export async function avancarStatusManutencaoAction(id: string, para: string): Promise<State> {
  const supabase = await createClient()
  const negado = await requireGestorFrotas(supabase)
  if (negado) return { error: negado }

  const { data: atual, error: errLer } = await supabase.from('manutencoes').select('status').eq('id', id).maybeSingle()
  if (errLer || !atual) return { error: 'Manutenção não encontrada.' }
  const de = atual.status as ManutencaoStatus
  const prox = proximoStatus(de)
  if (!prox || prox.para !== para) return { error: 'Mudança de status inválida. Recarregue a página.' }

  const { data, error } = await supabase
    .from('manutencoes')
    .update({ status: prox.para, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', de)
    .select('id')
  if (error) {
    console.error('[manutencoes] avançar status falhou:', error)
    return { error: 'Erro ao mudar o status' }
  }
  if (!data || data.length === 0) return { error: 'A manutenção mudou enquanto você olhava. Recarregue.' }
  await logAudit('manutencoes', 'atualizou', id, `Status: ${STATUS_LBL[de]} → ${STATUS_LBL[prox.para]}`)
  revalidar()
  return { success: true }
}

export async function concluirManutencaoAction(
  id: string,
  f: { data_saida: string; custo: string; quem_arca: string }
): Promise<State> {
  const supabase = await createClient()
  const negado = await requireGestorFrotas(supabase)
  if (negado) return { error: negado }

  const custo = dinheiro(String(f.custo ?? '').trim())
  const { error } = await supabase.rpc('sofia_concluir_manutencao', {
    p_id: id,
    p_data_saida: f.data_saida || null,
    p_custo: custo != null && Number.isFinite(custo) ? custo : null,
    p_quem_arca: f.quem_arca || null,
  })
  if (error) return { error: mensagemRpc(error, 'Erro ao concluir a manutenção', 'concluir') }
  revalidar()
  return { success: true }
}

/** Grava o caminho do anexo já enviado ao bucket; só aceita `manutencoes/<id>/<arquivo>`. */
export async function anexarManutencaoAction(id: string, path: string): Promise<State> {
  const supabase = await createClient()
  const negado = await requireGestorFrotas(supabase)
  if (negado) return { error: negado }
  if (!caminhoAnexoValido(id, path)) return { error: 'Arquivo inválido.' }

  const { data, error } = await supabase
    .from('manutencoes')
    .update({ anexo_storage_path: path, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
  if (error) {
    console.error('[manutencoes] anexar falhou:', error)
    return { error: 'Erro ao salvar o anexo' }
  }
  if (!data || data.length === 0) return { error: 'Manutenção não encontrada.' }
  await logAudit('manutencoes', 'atualizou', id, 'Anexo (orçamento ou nota) enviado')
  revalidatePath('/sofia/manutencoes')
  return { success: true }
}

/** URL assinada de 60 s; o caminho vem do banco pelo id, nunca do navegador. */
export async function verAnexoManutencaoAction(id: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }

  const { data: m } = await supabase.from('manutencoes').select('anexo_storage_path').eq('id', id).maybeSingle()
  if (!m?.anexo_storage_path) return { error: 'Esta manutenção não tem anexo.' }
  const { data, error } = await supabase.storage.from('sofia-anexos').createSignedUrl(m.anexo_storage_path, 60)
  if (error || !data) return { error: 'Erro ao gerar link do arquivo' }
  return { url: data.signedUrl }
}
