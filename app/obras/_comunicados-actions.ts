'use server'

/**
 * Faixa "Novidade" do Controle de Obras (spec 2026-09-22-comunicado-atualizacoes).
 *
 * Sessão do usuário, nunca service role: quem decide o que cada pessoa vê é a
 * RLS de hub_comunicados (publicado + acesso ao slug). Não replicar filtro de
 * acesso aqui.
 */

import { createClient } from '@/lib/supabase/server'

export type Comunicado = {
  id: string
  titulo: string
  /** Texto puro, uma linha por item. A primeira linha é o texto curto da faixa. */
  corpo: string
  publicado_em: string
}

export async function listarComunicadosNaoLidos(): Promise<Comunicado[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const [comunicados, lidos] = await Promise.all([
    supabase
      .from('hub_comunicados')
      .select('id, titulo, corpo, publicado_em')
      .eq('sistema', 'obras')
      .order('publicado_em', { ascending: false }),
    supabase.from('hub_comunicados_lidos').select('comunicado_id').eq('user_id', user.id),
  ])
  if (comunicados.error || lidos.error) return []

  const jaLidos = new Set((lidos.data ?? []).map((l) => l.comunicado_id))
  return (comunicados.data ?? []).filter((c) => !jaLidos.has(c.id))
}

export async function marcarComunicadoLido(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { error } = await supabase
    .from('hub_comunicados_lidos')
    .insert({ comunicado_id: id, user_id: user.id })
  return { ok: !error || error.code === '23505' }
}
