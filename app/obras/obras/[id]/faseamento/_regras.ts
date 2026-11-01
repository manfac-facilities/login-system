/**
 * Regras puras da tela de faseamento (Leva 6b): carimbo padrão, regras a partir
 * do texto, id único de camada, proporção do quadro e qual revisão abrir.
 */
import { MAX_CAMADAS, MAX_REGRAS, camadasSchema, carimboSchema, regrasSchema, type Camada, type Carimbo } from './_lib/camadas'
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

export type LeituraCamadas = { camadas: Camada[]; descartadas: number; ok: boolean }

/**
 * Camadas gravadas → camadas válidas, uma a uma (Task 2 sem mudar limites): a inválida (ou id repetido, ou além
 * do máximo) é descartada e contada, nunca troca tudo por `[]` em silêncio. `ok` = a lista inteira passou no schema.
 */
export function lerCamadas(v: unknown): LeituraCamadas {
  const todas = camadasSchema.safeParse(v)
  if (todas.success) return { camadas: todas.data, descartadas: 0, ok: true }
  if (!Array.isArray(v)) return { camadas: [], descartadas: 1, ok: false }
  const camadas: Camada[] = []
  const ids = new Set<string>()
  for (const item of v) {
    const r = camadasSchema.safeParse([item])
    if (!r.success || ids.has(r.data[0].id) || camadas.length >= MAX_CAMADAS) continue
    ids.add(r.data[0].id)
    camadas.push(r.data[0])
  }
  return { camadas, descartadas: v.length - camadas.length, ok: false }
}

export type LeituraRegras = { regras: string[]; descartadas: number; ok: boolean }

/** Regras gravadas → as válidas, uma a uma, contando as descartadas. */
export function lerRegras(v: unknown): LeituraRegras {
  const todas = regrasSchema.safeParse(v ?? [])
  if (todas.success) return { regras: todas.data, descartadas: 0, ok: true }
  if (!Array.isArray(v)) return { regras: [], descartadas: 1, ok: false }
  const regras: string[] = []
  for (const item of v) {
    const r = regrasSchema.safeParse([item])
    if (r.success && regras.length < MAX_REGRAS) regras.push(r.data[0])
  }
  return { regras, descartadas: v.length - regras.length, ok: false }
}

/** Carimbo gravado legível? Objeto vazio (`{}`, o padrão da coluna) conta como "ainda não preenchido", não como erro. */
export const carimboLegivel = (v: unknown) =>
  (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0) || carimboSchema.safeParse(v).success

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios.replace('#', String(n)))

/** Nota do rodapé do PDF: "1 camada não pôde ser desenhada · 2 regras não puderam ser impressas". */
export function avisoDeLeitura(c: LeituraCamadas, r: LeituraRegras): string | null {
  const partes = [
    c.descartadas ? plural(c.descartadas, '1 camada não pôde ser desenhada', '# camadas não puderam ser desenhadas') : null,
    r.descartadas ? plural(r.descartadas, '1 regra não pôde ser impressa', '# regras não puderam ser impressas') : null,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

/**
 * Erro de leitura que indica o SQL da leva 6b ainda não aplicado: coluna (42703) ou tabela (42P01) ausente, ou o
 * cache do PostgREST sem elas (PGRST204/PGRST205), ou a mensagem citando um objeto da 6b. Quem lê trata como
 * "faseamento indisponível" em vez de quebrar a tela.
 */
export function faltaSqlFaseamento(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false
  if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(String(e.code ?? ''))) return true
  return /fase_revisao_id|coordenador_email|obras_fase/.test(String(e.message ?? ''))
}
