/**
 * Leitura da Visão do CEO: lê o banco com o cliente da SESSÃO (recebido por parâmetro) e monta a
 * carteira com as regras puras de `carteira.ts`. Falha de uma leitura afeta só o pedaço dela.
 * Spec: docs/superpowers/specs/2026-11-04-obras-visao-ceo-design.md (§5, §6b).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { diasUteisEntre } from './calendario'
import { lerObraGrande, lerPlanos, lerRestricoes } from './leitura'
import { lerAgenda } from './envios-agenda'
import { lerFinanceiroDaObra } from './financeiro-ler'
import {
  dinheiroDaCarteira, estadoDaObra, etapasDaCarteira, ficaNaCarteira, ordenarCarteira, semanaDe,
  sinaisDoCliente, travaPrincipal, travasDaObra,
  type Diario, type Mensagem, type ObraCarteira,
} from './carteira'

export type LinhaUniverso = {
  id: string; os: string | null; loja: string | null; modalidade: string; etapa: string | null
  cancelado_em: string | null; obra_pai_id: string | null; engenheiro_email: string | null
}

/** Obras da modalidade OBRA, sem canceladas e sem aditivos (filhas). */
export function obrasDoUniverso(rows: LinhaUniverso[]): LinhaUniverso[] {
  return rows.filter((r) => r.modalidade === 'obra' && r.etapa !== 'cancelado' && !r.cancelado_em && !r.obra_pai_id)
}

/** Dias úteis a mais depois da base (`diasUteisEntre` conta as duas pontas); antes ou igual → 0. */
export function desvioEmDiasUteis(base: string | null, projetado: string | null, feriados: ReadonlySet<string>): number | null {
  if (!base || !projetado) return null
  return projetado > base ? Math.max(0, diasUteisEntre(base, projetado, feriados) - 1) : 0
}

type RdoLinha = { id: string; data: string; sem_execucao: boolean | null; motivo_sem_execucao: string | null; efetivo: number | null }
type AvancoLinha = { rdo_id: string; numero: number; de: number | null; para: number | null; concluida: boolean | null }

/** Texto curto de cada diário: motivo sem execução, ou equipe + atividades que avançaram (até 3). */
export function diariosDe(rdos: RdoLinha[], avancos: AvancoLinha[], descricoes: ReadonlyMap<number, string>): Diario[] {
  return rdos.map((r) => {
    if (r.sem_execucao) return { data: r.data, texto: `Sem execução: ${r.motivo_sem_execucao ?? ''}`.trim() }
    const nomes = avancos
      .filter((a) => a.rdo_id === r.id && (a.concluida || Number(a.para ?? 0) > Number(a.de ?? 0)))
      .map((a) => descricoes.get(Number(a.numero)) ?? `atividade ${a.numero}`)
    const lista = nomes.length > 3 ? `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}` : nomes.join(', ')
    return { data: r.data, texto: `Equipe de ${r.efetivo ?? 0}.${lista ? ` ${lista}.` : ''}` }
  })
}

async function lerDiarios(supabase: SupabaseClient, obraId: string) {
  const rdoR = await supabase
    .from('obras_rdo').select('id, data, sem_execucao, motivo_sem_execucao, efetivo')
    .eq('obra_id', obraId).in('estado', ['validado', 'enviado']).order('data', { ascending: false }).limit(3)
  if (rdoR.error) return null
  const rdos = (rdoR.data ?? []) as RdoLinha[]
  if (!rdos.length) return { rdos, avancos: [] as AvancoLinha[] }
  const avR = await supabase.from('obras_rdo_avanco').select('rdo_id, numero, de, para, concluida').in('rdo_id', rdos.map((r) => r.id))
  if (avR.error) return null
  return { rdos, avancos: (avR.data ?? []) as AvancoLinha[] }
}

async function lerMensagens(supabase: SupabaseClient, obraId: string): Promise<Mensagem[] | null> {
  const { data, error } = await supabase
    .from('obras_mensagem').select('autor_tipo, criado_em')
    .eq('obra_id', obraId).order('criado_em', { ascending: false }).limit(50)
  if (error) return null
  return ((data ?? []) as { autor_tipo: Mensagem['autorTipo']; criado_em: string }[])
    .map((m) => ({ autorTipo: m.autor_tipo, criadoEm: m.criado_em }))
}

async function lerObraDaCarteira(supabase: SupabaseClient, linha: LinhaUniverso, hoje: string): Promise<ObraCarteira> {
  const [og, restR, planR, diaR, mensagens] = await Promise.all([
    lerObraGrande(supabase, linha.id, hoje),
    lerRestricoes(supabase, linha.id),
    lerPlanos(supabase, linha.id),
    lerDiarios(supabase, linha.id),
    lerMensagens(supabase, linha.id),
  ])
  const [agenda, fin] = await Promise.all([
    og.ok ? lerAgenda(supabase, linha.id, og.dados, hoje) : Promise.resolve(null),
    lerFinanceiroDaObra(supabase, linha.id, og, hoje),
  ])

  const d = og.ok ? og.dados : null
  const calc = d?.calc ?? null
  const feriados: ReadonlySet<string> = d?.feriados ?? new Set()
  const restricoes = restR.ok ? restR.restricoes : null
  const impedimentos = d?.impedimentos ?? []
  const travas = travasDaObra(restricoes ?? [], impedimentos, hoje)
  const terminoBase = d?.terminoBase ?? null
  const terminoProjetado = calc?.terminoProjetado || null
  const desvioDiasUteis = desvioEmDiasUteis(terminoBase, terminoProjetado, feriados)
  const descricoes = new Map((calc?.atividades ?? []).map((a) => [a.numero, a.descricao]))

  return {
    id: linha.id, os: linha.os, loja: linha.loja, engenheiro: linha.engenheiro_email,
    sinal: d?.sinal ?? null,
    estado: d
      ? estadoDaObra({
          calc, sinal: d.sinal, hist: d.hist,
          impedimentosAbertos: impedimentos.filter((i) => i.categoria === 'impedimento' && i.encerradoEm === null).length,
          dataBase: d.obra.data_base ?? null, hoje, feriados,
        })
      : { tipo: 'sem_cronograma' },
    realizado: calc?.realizado ?? null,
    previsto: calc?.previsto ?? null,
    terminoBase, terminoProjetado, desvioDiasUteis,
    travas, travaPrincipal: travaPrincipal(travas),
    sinais: sinaisDoCliente({ terminoBase, terminoProjetado, desvioDiasUteis, restricoes, mensagens, agenda, hoje, feriados }),
    etapas: etapasDaCarteira(calc),
    semana: d && planR.ok ? semanaDe(planR.planos, hoje) : null,
    diarios: d && diaR ? diariosDe(diaR.rdos, diaR.avancos, descricoes) : [],
    dinheiro: dinheiroDaCarteira(fin),
  }
}

export async function lerCarteira(
  supabase: SupabaseClient,
  hoje: string,
): Promise<{ ok: true; obras: ObraCarteira[] } | { ok: false }> {
  const { data, error } = await supabase
    .from('obras_obra')
    .select('id, os, loja, modalidade, etapa, cancelado_em, obra_pai_id, engenheiro_email')
    .eq('modalidade', 'obra')
  if (error) return { ok: false }
  const obras = await Promise.all(obrasDoUniverso((data ?? []) as LinhaUniverso[]).map((l) => lerObraDaCarteira(supabase, l, hoje)))
  return { ok: true, obras: ordenarCarteira(obras.filter(ficaNaCarteira)) }
}
