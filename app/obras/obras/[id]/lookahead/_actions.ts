'use server'

/**
 * Server Actions das restrições do lookahead (Leva 3, Task 3). Qualquer usuário
 * de `obras` (ou admin) cria/move/edita; apagar só o autor ou admin. A atividade
 * precisa existir na versão vigente. Autoria/datas vêm do trigger — não enviar.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import {
  RESPONSAVEIS_RESTRICAO,
  SITUACOES,
  TIPOS_RESTRICAO,
  type NovaRestricao,
  type Resultado,
} from './_tipos'

const ISO = /^\d{4}-\d{2}-\d{2}$/
type Erro = { ok: false; erro: string }
const falha = (erro: string): Erro => ({ ok: false, erro })

async function autorizar(): Promise<{ supabase: SupabaseClient; email: string; admin: boolean } | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  const admin = await isAdmin(supabase, email)
  if (admin || (await hasSystemAccess(supabase, email, 'obras'))) return { supabase, email, admin }
  return falha('Sem acesso ao Gestão de Obras')
}

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.code === '42501' || e.message.includes('row-level security')) return falha('Você não tem permissão para isso.')
  if (e.code === '23503') return falha('Referência inválida (a obra não existe mais).')
  if (e.code === '23514') return falha('Dados inválidos: confira tipo, responsável e descrição.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes.`)
}

const revalidar = (obraId: string) => revalidatePath(`/obras/obras/${obraId}/lookahead`)

/** A atividade existe na versão vigente (última salva; sem salva, o rascunho)? */
async function atividadeNaVersaoVigente(supabase: SupabaseClient, obraId: string, numero: number): Promise<Erro | null> {
  const { data: vs, error } = await supabase
    .from('obras_cronograma_versao')
    .select('id, numero, salva_em')
    .eq('obra_id', obraId)
  if (error) return erroBanco('ler o cronograma', error)
  const versoes = ((vs ?? []) as { id: string; numero: number; salva_em: string | null }[])
    .slice()
    .sort((a, b) => a.numero - b.numero)
  const salvas = versoes.filter((v) => v.salva_em)
  const vigente = salvas.length ? salvas[salvas.length - 1] : versoes.filter((v) => !v.salva_em).pop()
  if (!vigente) return falha('A obra ainda não tem cronograma')
  const { data, error: e2 } = await supabase
    .from('obras_atividade')
    .select('numero')
    .eq('versao_id', vigente.id)
    .eq('numero', numero)
    .maybeSingle()
  if (e2) return erroBanco('ler a atividade', e2)
  return data ? null : falha('Atividade não encontrada no cronograma vigente')
}

function validar(i: Omit<NovaRestricao, 'atividadeNumero'>): Erro | { descricao: string } {
  const descricao = (i.descricao ?? '').trim()
  if (!descricao) return falha('Descreva a restrição')
  if (!TIPOS_RESTRICAO.some((t) => t.valor === i.tipo)) return falha('Tipo inválido')
  if (!RESPONSAVEIS_RESTRICAO.some((r) => r.valor === i.responsavel)) return falha('Diga quem é o responsável')
  if (i.prazo !== null && !ISO.test(i.prazo)) return falha('Prazo inválido')
  return { descricao }
}

export async function criarRestricaoAction(obraId: string, i: NovaRestricao): Promise<Resultado & { id?: string }> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth
  if (!(Number.isInteger(i.atividadeNumero) && i.atividadeNumero > 0)) return falha('Atividade inválida')
  const v = validar(i)
  if ('ok' in v) return v
  const naoExiste = await atividadeNaVersaoVigente(supabase, obraId, i.atividadeNumero)
  if (naoExiste) return naoExiste

  const { data, error } = await supabase
    .from('obras_restricao')
    .insert({
      obra_id: obraId,
      atividade_numero: i.atividadeNumero,
      tipo: i.tipo,
      descricao: v.descricao,
      responsavel: i.responsavel,
      prazo: i.prazo,
    })
    .select('id')
    .single()
  if (error) return erroBanco('registrar a restrição', error)
  revalidar(obraId)
  return { ok: true, id: data.id as string }
}

export async function moverRestricaoAction(id: string, situacao: string): Promise<Resultado> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth
  if (!SITUACOES.some((s) => s.valor === situacao)) return falha('Situação inválida')
  const { data: r, error: e1 } = await supabase.from('obras_restricao').select('id, obra_id').eq('id', id).maybeSingle()
  if (e1) return erroBanco('ler a restrição', e1)
  if (!r) return falha('Restrição não encontrada')
  const { error } = await supabase.from('obras_restricao').update({ situacao }).eq('id', id)
  if (error) return erroBanco('mover a restrição', error)
  revalidar(r.obra_id as string)
  return { ok: true }
}

export async function editarRestricaoAction(
  id: string,
  i: Omit<NovaRestricao, 'atividadeNumero'>,
): Promise<Resultado> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth
  const v = validar(i)
  if ('ok' in v) return v
  const { data: r, error: e1 } = await supabase.from('obras_restricao').select('id, obra_id').eq('id', id).maybeSingle()
  if (e1) return erroBanco('ler a restrição', e1)
  if (!r) return falha('Restrição não encontrada')
  const { error } = await supabase
    .from('obras_restricao')
    .update({ tipo: i.tipo, descricao: v.descricao, responsavel: i.responsavel, prazo: i.prazo })
    .eq('id', id)
  if (error) return erroBanco('editar a restrição', error)
  revalidar(r.obra_id as string)
  return { ok: true }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Liga (ou desliga, `pedidoId` null) a restrição de Material a um pedido do Compras.
 * Defesa em duas camadas: o pedido tem de estar em `obras_restricao_pedidos(obra da restrição)`
 * (cliente da SESSÃO — nunca o admin) e o trigger `obras_restricao_pedido_guarda` recusa
 * pedido de outra obra (OBRAS_RESTRICAO_PEDIDO). Ligar não libera a restrição.
 */
export async function ligarPedidoAction(id: string, pedidoId: string | null): Promise<Resultado> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth
  if (pedidoId !== null && !UUID.test(pedidoId)) return falha('Pedido inválido')
  const { data: r, error: e1 } = await supabase.from('obras_restricao').select('id, obra_id, tipo').eq('id', id).maybeSingle()
  if (e1) return erroBanco('ler a restrição', e1)
  if (!r) return falha('Restrição não encontrada')
  if (r.tipo !== 'material') return falha('Só restrição de Material liga a um pedido do Compras')
  if (pedidoId !== null) {
    const { data: lista, error: e2 } = await supabase.rpc('obras_restricao_pedidos', { p_obra: r.obra_id })
    if (e2) return falha('Não deu para ler os pedidos do Compras. Tente de novo em instantes.')
    const daObra = ((lista ?? []) as { pedido_id: string }[]).some((p) => p.pedido_id === pedidoId)
    if (!daObra) return falha('Esse pedido não é desta obra')
  }
  const { error } = await supabase.from('obras_restricao').update({ cmp_pedido_id: pedidoId }).eq('id', id)
  if (error) {
    if (error.message?.includes('OBRAS_RESTRICAO_PEDIDO')) return falha('Esse pedido não é desta obra')
    return erroBanco('ligar o pedido', error)
  }
  revalidar(r.obra_id as string)
  return { ok: true }
}

export async function apagarRestricaoAction(id: string): Promise<Resultado> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase, email, admin } = auth
  const { data: r, error: e1 } = await supabase
    .from('obras_restricao')
    .select('id, obra_id, criado_por')
    .eq('id', id)
    .maybeSingle()
  if (e1) return erroBanco('ler a restrição', e1)
  if (!r) return falha('Restrição não encontrada')
  const autor = typeof r.criado_por === 'string' && r.criado_por.trim().toLowerCase() === email
  if (!admin && !autor) return falha('Só quem registrou ou um administrador pode apagar.')
  const { error } = await supabase.from('obras_restricao').delete().eq('id', id)
  if (error) return erroBanco('apagar a restrição', error)
  revalidar(r.obra_id as string)
  return { ok: true }
}
