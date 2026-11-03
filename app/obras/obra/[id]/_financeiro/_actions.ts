'use server'

/**
 * Locação da obra SPOT: marcar devolvida / renovar até. A autorização real é do banco
 * (trigger/policies de `obras_locacao_estado`: acesso ao Obras ou admin; senão 42501). Aqui só a
 * sessão, a modalidade e as mesmas validações de data das locações da obra. Sem `export type`.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { hojeISO } from '../../../_lib/tipos'
import { erroDoBanco } from '../../../obras/_lib/medicao'
import { montarLocacoes, type Resultado } from '../../../obras/[id]/financeiro/locacoes/_tipos'

const falha = (erro: string) => ({ ok: false as const, erro })
const ISO = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const dataValida = (s: string) => ISO.test(s ?? '') && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s
const MSG_42501 = 'Só quem tem acesso ao Gestão de Obras ou um administrador marca a locação.'

async function preparar(obraId: string, pedidoId: string) {
  if (!UUID.test(obraId ?? '') || !UUID.test(pedidoId ?? '')) return { erro: falha('Locação não encontrada nesta obra') }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { erro: falha('Sessão expirada. Entre de novo.') }
  if (!(await isAdmin(supabase, user.email)) && !(await hasSystemAccess(supabase, user.email, 'obras'))) {
    return { erro: falha('Sem permissão para marcar a locação') }
  }
  const { data: obra } = await supabase.from('obras_obra').select('modalidade').eq('id', obraId).maybeSingle()
  if (obra?.modalidade !== 'spot') return { erro: falha('Esta ação é só para obras SPOT') }
  const { data, error } = await supabase.rpc('obras_fin_locacoes', { p_obra: obraId })
  const loc = error ? null : montarLocacoes((data ?? []) as Record<string, unknown>[]).find((l) => l.pedidoId === pedidoId)
  if (!loc) return { erro: falha('Locação não encontrada nesta obra') }
  return { supabase, loc }
}

async function gravar(obraId: string, pedidoId: string, campos: Record<string, string>, msgErro: string): Promise<Resultado> {
  const p = await preparar(obraId, pedidoId)
  if ('erro' in p) return p.erro!
  const { error } = await p.supabase
    .from('obras_locacao_estado')
    .upsert({ cmp_pedido_id: pedidoId, obra_id: p.loc.obraId, ...campos }, { onConflict: 'cmp_pedido_id' })
  if (error) return falha(error.code === '42501' ? MSG_42501 : erroDoBanco(error, msgErro))
  revalidatePath(`/obras/obra/${obraId}`)
  return { ok: true }
}

export async function marcarDevolvidaSpotAction(obraId: string, pedidoId: string, data: string): Promise<Resultado> {
  if (!dataValida(data)) return falha('Data de devolução inválida')
  if (data > hojeISO()) return falha('A devolução não pode ser no futuro')
  const p = await preparar(obraId, pedidoId)
  if ('erro' in p) return p.erro!
  if (p.loc.estado === 'devolvida') return falha('Esta locação já foi marcada como devolvida')
  if (p.loc.inicio && data < p.loc.inicio) return falha('A devolução não pode ser antes do início da locação')
  return gravar(obraId, pedidoId, { devolvida_em: data }, 'Não foi possível marcar a devolução. Tente de novo.')
}

export async function renovarLocacaoSpotAction(obraId: string, pedidoId: string, ate: string): Promise<Resultado> {
  if (!dataValida(ate)) return falha('Data da renovação inválida')
  const p = await preparar(obraId, pedidoId)
  if ('erro' in p) return p.erro!
  if (p.loc.estado === 'devolvida') return falha('Locação devolvida não se renova')
  const atual = p.loc.fim ?? p.loc.inicio
  if (atual && ate <= atual) return falha('A renovação tem de ir além do fim atual da locação')
  return gravar(obraId, pedidoId, { renovada_ate: ate }, 'Não foi possível renovar a locação. Tente de novo.')
}
