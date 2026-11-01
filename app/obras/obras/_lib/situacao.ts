/**
 * Situação para o cliente (Leva 5 §7, Task 6): formato, validação e leitura da
 * situação PUBLICADA (`obras_situacao_cliente`, imutável; nova versão = nova
 * linha). Fonte única do portal (Visão geral) e dos relatórios semanal e de
 * período, que congelam a situação vigente no conteúdo do cliente.
 *
 * Tudo que entra aqui é não confiável (saída da IA, formulário, jsonb do banco
 * gravável pela API): `validarSituacao` confere o formato exato e os limites
 * antes de qualquer coisa ir à tela ou ao cliente. Nunca R$.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { FUSO } from '../../_lib/tipos'
import type { Responsavel } from './cronograma'
import type { ObraGrande } from './leitura'
import { lista, obj, str, strs } from './conteudo-valido'

export type AcaoSituacao = { oque: string; quando: string; efeito: string }
export type SituacaoTexto = { explicacao: string; acoes: AcaoSituacao[] }

/** Retrato interno dos números na publicação (base do "mudou desde a última situação"). */
export type NumerosSituacao = { atraso: Record<Responsavel, number>; desvioPP: number | null; terminoProjetado: string | null }

export type SituacaoPublicada = SituacaoTexto & {
  versao: number
  numeros: NumerosSituacao
  publicadaPor: string
  publicadaEm: string
}

/** O que o cliente vê (portal e relatórios): sem e-mail, sem números internos. */
export type SituacaoRelatorio = SituacaoTexto & { atualizadoEm: string; por: string }

export const LIMITES_SITUACAO = { explicacao: 1200, explicacaoIa: 900, acoes: 5, oque: 200, quando: 80, efeito: 200 } as const

const DINHEIRO = /R\s*\$/i
const chavesExatas = (x: Record<string, unknown>, chaves: string[]) =>
  Object.keys(x).length === chaves.length && chaves.every((k) => k in x)
/** Frases: pontos finais/!/? seguidos de espaço ou fim (aproximado; abreviações contam). */
const frases = (t: string) => t.split(/[.!?](?:\s+|$)/).filter((s) => s.trim()).length

/**
 * Valida e normaliza (trim). `ia`: saída do agente — explicação de 1 a 5 frases
 * (pedimos 2 a 4) e até 900 caracteres, ações com os três campos preenchidos.
 * `publicar`: o que o engenheiro revisou — explicação até 1200, ação com
 * "o quê" obrigatório; quando/efeito podem ficar vazios.
 */
export function validarSituacao(v: unknown, modo: 'ia' | 'publicar'): { ok: true; situacao: SituacaoTexto } | { ok: false; erro: string } {
  const L = LIMITES_SITUACAO
  if (!obj(v) || !chavesExatas(v, ['explicacao', 'acoes']) || !str(v.explicacao) || !Array.isArray(v.acoes)) {
    return { ok: false, erro: 'Formato inválido' }
  }
  const explicacao = v.explicacao.trim()
  const max = modo === 'ia' ? L.explicacaoIa : L.explicacao
  if (!explicacao) return { ok: false, erro: 'Escreva a explicação' }
  if (explicacao.length > max) return { ok: false, erro: `Explicação longa demais (até ${max} caracteres)` }
  if (modo === 'ia' && frases(explicacao) > 5) return { ok: false, erro: 'Explicação longa demais' }
  if (v.acoes.length > L.acoes) return { ok: false, erro: `No máximo ${L.acoes} ações` }
  const acoes: AcaoSituacao[] = []
  for (const a of v.acoes as unknown[]) {
    if (!obj(a) || !chavesExatas(a, ['oque', 'quando', 'efeito']) || !strs(a, 'oque', 'quando', 'efeito')) {
      return { ok: false, erro: 'Ação em formato inválido' }
    }
    const x = { oque: (a.oque as string).trim(), quando: (a.quando as string).trim(), efeito: (a.efeito as string).trim() }
    if (!x.oque) return { ok: false, erro: 'Toda ação precisa do "o quê"' }
    if (modo === 'ia' && (!x.quando || !x.efeito)) return { ok: false, erro: 'Ação incompleta' }
    if (x.oque.length > L.oque || x.quando.length > L.quando || x.efeito.length > L.efeito) {
      return { ok: false, erro: `Ação longa demais (o quê até ${L.oque}, quando até ${L.quando}, efeito até ${L.efeito} caracteres)` }
    }
    acoes.push(x)
  }
  if ([explicacao, ...acoes.flatMap((a) => [a.oque, a.quando, a.efeito])].some((t) => DINHEIRO.test(t))) {
    return { ok: false, erro: 'A situação para o cliente não fala de valores (R$)' }
  }
  return { ok: true, situacao: { explicacao, acoes } }
}

const RESPS: Responsavel[] = ['cliente', 'manfac', 'terceiro', 'clima']

function numerosDe(v: unknown): NumerosSituacao {
  const n = obj(v) ? v : {}
  const at = obj(n.atraso) ? n.atraso : {}
  const atraso = Object.fromEntries(
    RESPS.map((r) => [r, typeof at[r] === 'number' && Number.isFinite(at[r]) ? (at[r] as number) : 0]),
  ) as Record<Responsavel, number>
  return {
    atraso,
    desvioPP: typeof n.desvioPP === 'number' && Number.isFinite(n.desvioPP) ? n.desvioPP : null,
    terminoProjetado: typeof n.terminoProjetado === 'string' ? n.terminoProjetado : null,
  }
}

/** Retrato a gravar na publicação (interno: a quebra do atraso é a do motor). */
export const numerosAtuais = (og: ObraGrande): NumerosSituacao => ({
  atraso: Object.fromEntries(RESPS.map((r) => [r, og.atraso?.[r] ?? 0])) as Record<Responsavel, number>,
  desvioPP: og.calc?.desvioPP ?? null,
  terminoProjetado: og.calc?.terminoProjetado ?? null,
})

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** Linha do banco → situação publicada; formato inválido = null (não aparece). */
export function situacaoRowDe(l: Linha): SituacaoPublicada | null {
  const v = validarSituacao({ explicacao: l.explicacao, acoes: l.acoes }, 'publicar')
  if (!v.ok || typeof l.versao !== 'number' || !str(l.publicada_por) || !str(l.publicada_em)) return null
  return { ...v.situacao, versao: l.versao, numeros: numerosDe(l.numeros), publicadaPor: l.publicada_por, publicadaEm: l.publicada_em }
}

/**
 * A situação publicada vigente (maior versão) da obra. Lê todas as versões
 * (poucas por obra) e escolhe aqui. Erro de leitura = { ok: false }.
 */
export async function lerSituacaoPublicada(
  supabase: SupabaseClient,
  obraId: string,
): Promise<{ ok: true; situacao: SituacaoPublicada | null } | { ok: false }> {
  const { data, error } = await supabase.from('obras_situacao_cliente').select('*').eq('obra_id', obraId)
  if (error) return { ok: false }
  const linhas = ((data ?? []) as Linha[]).filter((l) => l.obra_id === undefined || l.obra_id === obraId)
  const ultima = linhas.reduce<Linha | null>((m, l) => (!m || Number(l.versao) > Number(m.versao) ? l : m), null)
  return { ok: true, situacao: ultima ? situacaoRowDe(ultima) : null }
}

/** "jose.guilherme@manfac.com.br" → "Jose Guilherme" (o cliente não vê e-mail). */
export function nomeDoEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const partes = local.split(/[._-]+/).filter((p) => /^[a-zà-ú]+$/i.test(p))
  if (!partes.length) return 'Engenharia Manfac'
  return partes.map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(' ')
}

const dataNoFuso = (ts: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts))

export const situacaoParaCliente = (s: SituacaoPublicada): SituacaoRelatorio => ({
  explicacao: s.explicacao,
  acoes: s.acoes,
  atualizadoEm: dataNoFuso(s.publicadaEm),
  por: nomeDoEmail(s.publicadaPor),
})

const DATA_BR = /^\d{2}\/\d{2}\/\d{4}$/

/** "o quê · quando · efeito" (só as partes preenchidas). */
export const acaoTxt = (a: AcaoSituacao) => [a.oque, a.quando, a.efeito].filter(Boolean).join(' · ')

/** Bloco da situação no e-mail em texto. */
export const linhasDaSituacao = (s: SituacaoRelatorio): string[] => [
  'SITUAÇÃO DA OBRA',
  s.explicacao,
  ...(s.acoes.length ? ['O que estamos fazendo para recuperar:', ...s.acoes.map((a) => `- ${acaoTxt(a)}`)] : []),
  `Atualizado em ${s.atualizadoEm} por ${s.por}.`,
]

/** Para os validadores do conteúdo congelado (semanal e período). */
export function situacaoRelatorioValida(v: unknown): v is SituacaoRelatorio {
  if (!obj(v) || !chavesExatas(v, ['explicacao', 'acoes', 'atualizadoEm', 'por'])) return false
  if (!str(v.atualizadoEm) || !DATA_BR.test(v.atualizadoEm) || !str(v.por) || v.por.length > 120) return false
  if (!lista(v.acoes, () => true)) return false
  const r = validarSituacao({ explicacao: v.explicacao, acoes: v.acoes }, 'publicar')
  return r.ok && r.situacao.explicacao === v.explicacao
}
