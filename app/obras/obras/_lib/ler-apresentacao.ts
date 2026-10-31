/**
 * Lê do banco o que a apresentação ao cliente precisa (Leva 4 §2.4) e monta o
 * conteúdo. Não grava nada. A obra é lida pela sessão (RLS) e o id usado dali em
 * diante é o do banco, não o do navegador. Fotos: os ids pedidos são
 * re-resolvidos contra as fotos dos diários validados/enviados DESTA obra no
 * período (id estranho some).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { fotosDosIds, fotosElegiveisDoPeriodo, type FotoRef } from '../_pdf/fotos-periodo'
import { highlightsDoPeriodo } from './highlights'
import { lerObraGrande, lerPlanos, lerRestricoes, type ObraGrande } from './leitura'
import {
  MAX_FOTOS_APRESENTACAO, montarApresentacao, periodoDaApresentacao, type ConteudoApresentacao, type ParamsApresentacao,
} from './apresentacao'

export type DadosApresentacao = {
  og: ObraGrande
  conteudo: ConteudoApresentacao
  inicio: string
  fim: string
  /** Todas as fotos elegíveis do período (para o seletor). */
  elegiveis: FotoRef[]
  /** Fotos escolhidas, já re-resolvidas (padrão sem escolha: amostra espalhada). */
  fotos: FotoRef[]
}
export type Falha = { ok: false; status: 400 | 404 | 500; erro: string }

/** Até `max` fotos espalhadas pelo período (a primeira e a última sempre entram). */
export function amostra(fotos: FotoRef[], max: number): FotoRef[] {
  if (fotos.length <= max) return fotos
  const idx = new Set(Array.from({ length: max }, (_, i) => Math.round((i * (fotos.length - 1)) / (max - 1))))
  return [...idx].map((i) => fotos[i])
}

export async function lerApresentacao(
  supabase: SupabaseClient,
  obraId: string,
  hoje: string,
  params: ParamsApresentacao,
  og?: ObraGrande,
): Promise<{ ok: true; dados: DadosApresentacao } | Falha> {
  let obra = og
  if (!obra) {
    const lida = await lerObraGrande(supabase, obraId, hoje)
    if (!lida.ok) return { ok: false, status: 404, erro: lida.erro }
    obra = lida.dados
  }
  if (obra.obra.modalidade !== 'obra') return { ok: false, status: 404, erro: 'Obra não encontrada' }
  const id = String(obra.obra.id)

  const p = periodoDaApresentacao(params, hoje, (obra.obra.data_base as string | null | undefined) ?? null)
  if (!p.ok) return { ok: false, status: 400, erro: p.erro }
  const { inicio, fim } = p
  const ref = fim < hoje ? fim : hoje
  if (ref !== hoje) {
    const lida = await lerObraGrande(supabase, id, ref)
    if (!lida.ok) return { ok: false, status: 404, erro: lida.erro }
    obra = lida.dados
  }

  const [plR, rR, elegiveis] = await Promise.all([
    lerPlanos(supabase, id),
    lerRestricoes(supabase, id),
    params.blocos.includes('fotos') ? fotosElegiveisDoPeriodo(supabase, id, inicio, fim) : Promise.resolve([] as FotoRef[]),
  ])
  if (!plR.ok || !rR.ok) return { ok: false, status: 500, erro: 'Não deu para ler os dados da obra' }

  const destaques = highlightsDoPeriodo({ obra, inicio, fim, ref, planos: plR.planos }).map((h) => h.texto)
  const conteudo = montarApresentacao({
    obra, inicio, fim, ref, hoje, planos: plR.planos, restricoes: rR.restricoes, destaques, blocos: params.blocos,
  })
  const fotos = params.blocos.includes('fotos')
    ? params.fotos ? fotosDosIds(params.fotos, elegiveis, MAX_FOTOS_APRESENTACAO) : amostra(elegiveis, MAX_FOTOS_APRESENTACAO)
    : []
  return { ok: true, dados: { og: obra, conteudo, inicio, fim, elegiveis, fotos } }
}
