/**
 * Tipos do diário de obra (RDO) da modalidade OBRA. Ficam aqui porque
 * `export type` num arquivo `'use server'` derruba a tela em runtime
 * (rules/obras.md, armadilha 1).
 */

export type Resultado = { ok: true } | { ok: false; erro: string }

export type Clima = 'sol' | 'nublado' | 'chuva' | 'impraticavel'
export type CausaNaoAndou = 'cliente' | 'material' | 'equipe' | 'clima' | 'projeto' | 'outro'
export type EstadoRdo = 'rascunho' | 'validado' | 'enviado'

export type AvancoRdo = {
  numero: number
  /** Percentual (0–1) antes do dia. O servidor sobrescreve com o percentual atual da execução. */
  de: number
  para: number
  concluida: boolean
  causa: CausaNaoAndou | null
}

export type RascunhoRdo = {
  semExecucao: boolean
  motivoSemExecucao: string | null
  efetivo: number | null
  equipeTexto: string | null
  /** Legado (antes dos turnos): continua lido e preservado. */
  clima: Clima | null
  climaManha: Clima | null
  climaTarde: Clima | null
  programacaoAmanha: string | null
  avancos: AvancoRdo[]
}

/** Uma linha do passo "O que andou" (sem peso nem valor: nada disso vai ao navegador). */
export type AtividadeDiario = {
  numero: number
  etapa: string
  descricao: string
  /** Percentual atual da execução (0–1). */
  atual: number
  travada: boolean
  motivoTrava: string | null
}

export type FotoRdo = { id: string; path: string; legenda: string | null; url: string | null }
