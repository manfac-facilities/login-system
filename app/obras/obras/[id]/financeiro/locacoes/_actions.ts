'use server'

/**
 * Server Actions das locações (Fases B/C §2.9): marcar devolvida / renovada até. Grava em
 * `obras_locacao_estado` com o cliente da SESSÃO (RLS + trigger conferem engenheiro/admin, que o
 * pedido é locação emitida desta obra e que a renovação passa do fim atual). Sem `export type`.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hojeISO } from '../../../../_lib/tipos'
import { erroDoBanco } from '../../../_lib/medicao'
import { autorizarOs } from '../_autorizar'
import { montarLocacoes, type Resultado } from './_tipos'

const falha = (erro: string) => ({ ok: false as const, erro })
const ISO = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const dataValida = (s: string) => ISO.test(s ?? '') && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s

/** A locação tem de aparecer em `obras_fin_locacoes` da página (obra + aditivos, pedido emitido). */
async function acharLocacao(paginaId: string, pedidoId: string) {
  if (!UUID.test(paginaId ?? '') || !UUID.test(pedidoId ?? '')) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('obras_fin_locacoes', { p_obra: paginaId })
  if (error) return null
  return montarLocacoes((data ?? []) as Record<string, unknown>[]).find((l) => l.pedidoId === pedidoId) ?? null
}

async function gravar(paginaId: string, pedidoId: string, quem: string) {
  const loc = await acharLocacao(paginaId, pedidoId)
  if (!loc) return { erro: falha('Locação não encontrada nesta obra') }
  const auth = await autorizarOs(paginaId, loc.obraId, quem)
  if ('ok' in auth) return { erro: auth }
  return { loc, auth }
}

export async function marcarDevolvidaAction(paginaId: string, pedidoId: string, data: string): Promise<Resultado> {
  if (!dataValida(data)) return falha('Data de devolução inválida')
  if (data > hojeISO()) return falha('A devolução não pode ser no futuro')
  const g = await gravar(paginaId, pedidoId, 'marca a locação')
  if ('erro' in g) return g.erro!
  if (g.loc.estado === 'devolvida') return falha('Esta locação já foi marcada como devolvida')
  if (g.loc.inicio && data < g.loc.inicio) return falha('A devolução não pode ser antes do início da locação')
  const { error } = await g.auth.supabase
    .from('obras_locacao_estado')
    .upsert({ cmp_pedido_id: pedidoId, obra_id: g.loc.obraId, devolvida_em: data }, { onConflict: 'cmp_pedido_id' })
  if (error) return falha(erroDoBanco(error, 'Não foi possível marcar a devolução. Tente de novo.'))
  revalidatePath(`/obras/obras/${paginaId}/financeiro/locacoes`)
  revalidatePath(`/obras/obras/${paginaId}`)
  return { ok: true }
}

export async function renovarLocacaoAction(paginaId: string, pedidoId: string, ate: string): Promise<Resultado> {
  if (!dataValida(ate)) return falha('Data da renovação inválida')
  const g = await gravar(paginaId, pedidoId, 'renova a locação')
  if ('erro' in g) return g.erro!
  if (g.loc.estado === 'devolvida') return falha('Locação devolvida não se renova')
  const atual = g.loc.fim ?? g.loc.inicio
  if (atual && ate <= atual) return falha('A renovação tem de ir além do fim atual da locação')
  const { error } = await g.auth.supabase
    .from('obras_locacao_estado')
    .upsert({ cmp_pedido_id: pedidoId, obra_id: g.loc.obraId, renovada_ate: ate }, { onConflict: 'cmp_pedido_id' })
  if (error) return falha(erroDoBanco(error, 'Não foi possível renovar a locação. Tente de novo.'))
  revalidatePath(`/obras/obras/${paginaId}/financeiro/locacoes`)
  revalidatePath(`/obras/obras/${paginaId}`)
  return { ok: true }
}
