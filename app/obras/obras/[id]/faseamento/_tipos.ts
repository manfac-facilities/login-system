/** Tipos da planta de faseamento (Leva 6b). Fora do `_actions.ts` de propósito (`use server` não exporta tipo). */
import type { Camada, Carimbo } from './_lib/camadas'

export type Resultado = { ok: true } | { ok: false; erro: string }

export type StatusRevisao = 'rascunho' | 'emitida'

/** O que o editor manda ao salvar o rascunho (validado de novo no servidor com os schemas da Task 2). */
export type EntradaRevisao = { camadas: Camada[]; regras: string[]; carimbo: Carimbo; usaTrava: boolean }

/** Linha curta da revisão (lista de revisões e status da fase). */
export type RevisaoResumo = { id: string; revisao: number; status: StatusRevisao; emitidaEm: string | null; enviadaEm: string | null }

export type FaseTela = { id: string; numero: number; nome: string; revisoes: RevisaoResumo[] }

/** Revisão aberta na tela (a em rascunho da fase ou, sem rascunho, a última emitida). */
export type RevisaoTela = {
  id: string
  faseId: string
  revisao: number
  status: StatusRevisao
  camadas: Camada[]
  regras: string[]
  carimbo: Carimbo
  usaTrava: boolean
  emitidaEm: string | null
  emitidaPor: string | null
  /** Texto impresso da trava (só na emitida com trava). */
  travaTexto: string | null
  /** Algo gravado não passou no schema (camadas, regras ou carimbo): aviso, e a revisão fica em leitura. */
  ilegivel: string | null
}

/** Base do desenho: a planta (URL assinada curta) ou quadro branco. */
export type BaseDesenho = { url: string | null; largura: number | null; altura: number | null }
