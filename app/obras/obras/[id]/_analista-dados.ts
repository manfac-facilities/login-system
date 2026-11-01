/**
 * Leitura do quadro "Analista da obra" (Leva 5 §7, Task 6): perguntas já
 * gravadas + situação publicada vigente, cruzadas com os pontos que o analista
 * levanta agora. Módulo comum (não `use server`): usado pela página do painel
 * e pelas actions, que recalculam os pontos no servidor (nunca confiam no
 * contexto vindo do navegador). Leitura pela sessão (RLS vale).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { perguntaSalvaDe, pontosAExplicar, type PerguntaSalva, type Ponto } from '../_lib/analista'
import type { PlanoSemana, Restricao } from '../_lib/last-planner'
import { lerObraGrande, lerPlanos, lerRestricoes, type ObraGrande } from '../_lib/leitura'
import { lerSituacaoPublicada, type SituacaoPublicada } from '../_lib/situacao'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type Analise = { og: ObraGrande; pontos: Ponto[]; salvas: PerguntaSalva[]; publicada: SituacaoPublicada | null }

export async function lerAnalise(
  supabase: SupabaseClient,
  p: { og: ObraGrande; hoje: string; restricoes: Restricao[]; planos: PlanoSemana[] },
): Promise<{ ok: true; analise: Analise } | { ok: false }> {
  const obraId = String(p.og.obra.id)
  const [pergR, sitR] = await Promise.all([
    supabase.from('obras_situacao_pergunta').select('*').eq('obra_id', obraId),
    lerSituacaoPublicada(supabase, obraId),
  ])
  if (pergR.error || !sitR.ok) return { ok: false }
  const publicada = sitR.situacao
  const pontos = pontosAExplicar({
    og: p.og, hoje: p.hoje, restricoes: p.restricoes, planos: p.planos, ultimaPublicada: publicada?.numeros ?? null,
  })
  return { ok: true, analise: { og: p.og, pontos, salvas: ((pergR.data ?? []) as Linha[]).map(perguntaSalvaDe), publicada } }
}

/** Leitura completa a partir do id (actions): obra, restrições, planos e análise. */
export async function lerAnaliseDaObra(
  supabase: SupabaseClient,
  obraId: string,
  hoje: string,
): Promise<{ ok: true; analise: Analise } | { ok: false; erro: string }> {
  const [ogR, rR, pR] = await Promise.all([lerObraGrande(supabase, obraId, hoje), lerRestricoes(supabase, obraId), lerPlanos(supabase, obraId)])
  if (!ogR.ok) return { ok: false, erro: ogR.erro }
  if (!rR.ok || !pR.ok) return { ok: false, erro: 'Não deu para ler os dados da obra. Tente de novo.' }
  const a = await lerAnalise(supabase, { og: ogR.dados, hoje, restricoes: rR.restricoes, planos: pR.planos })
  if (!a.ok) return { ok: false, erro: 'Não deu para ler as perguntas do analista. Tente de novo.' }
  return a
}
