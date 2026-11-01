/**
 * Regras puras da tela de faseamento (Leva 6b): carimbo padrão, regras a partir
 * do texto, id único de camada, proporção do quadro e qual revisão abrir.
 */
import { carimboSchema, type Camada, type Carimbo } from './_lib/camadas'
import type { RevisaoResumo } from './_tipos'

export const BASE_PADRAO = 'Layout aprovado do térreo · sem escala'
/** Altura do quadro (em 1000 de largura) quando não há planta: a proporção do mockup e da prancha. */
export const ALTURA_QUADRO = 700
export const MAX_NOME_FASE = 120

const pad2 = (n: number) => String(n).padStart(2, '0')

export function carimboPadrao(p: { numero: number; cliente: string | null | undefined }): Carimbo {
  return {
    titulo: `Planta de faseamento · Fase ${p.numero}`,
    cliente: (p.cliente ?? '').trim().slice(0, 300),
    desenho: `FAS-${pad2(p.numero)}`,
    base: BASE_PADRAO,
    rt: '',
  }
}

/** Carimbo gravado → carimbo da tela; o que não for válido volta ao padrão. */
export function carimboDe(v: unknown, numero: number, cliente: string | null | undefined): Carimbo {
  const r = carimboSchema.safeParse(v)
  return r.success ? r.data : carimboPadrao({ numero, cliente })
}

/** Uma regra por linha; linhas vazias saem. A validação (≤ 12, ≤ 200) é do `regrasSchema`. */
export const regrasDeTexto = (texto: string): string[] =>
  texto
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

/** Id novo e único entre as camadas: `c<n>`, n = maior número já usado + 1. */
export function novoIdCamada(camadas: readonly Pick<Camada, 'id'>[]): string {
  let max = 0
  for (const c of camadas) {
    const m = /^c(\d+)$/.exec(c.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  let n = max + 1
  const ids = new Set(camadas.map((c) => c.id))
  while (ids.has(`c${n}`)) n++
  return `c${n}`
}

/** Altura do viewBox (largura 1000): proporção da planta ou o quadro padrão. */
export const alturaDoQuadro = (largura: number | null | undefined, altura: number | null | undefined) =>
  largura && altura && largura > 0 && altura > 0 ? (1000 * altura) / largura : ALTURA_QUADRO

/** Revisão aberta na tela: a em rascunho; sem ela, a emitida mais recente. */
export function revisaoAberta(revisoes: readonly RevisaoResumo[]): RevisaoResumo | null {
  return revisoes.find((r) => r.status === 'rascunho') ?? [...revisoes].sort((a, b) => b.revisao - a.revisao)[0] ?? null
}

const dataCurtaBR = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(iso))

/** "R1 · rascunho", "R1 · emitida 30/10", "R1 · enviada 30/10". */
export function rotuloRevisao(r: RevisaoResumo): string {
  if (r.status === 'rascunho') return `R${r.revisao} · rascunho`
  if (r.enviadaEm) return `R${r.revisao} · enviada ${dataCurtaBR(r.enviadaEm)}`
  return `R${r.revisao} · emitida${r.emitidaEm ? ` ${dataCurtaBR(r.emitidaEm)}` : ''}`
}
