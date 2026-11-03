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
  /** "Sem impedimentos hoje" (item 7 da reunião de 31/10): passo 4 preenchido sem registrar nada. */
  semImpedimento: boolean
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

export type FotoRdo = {
  id: string
  path: string
  legenda: string | null
  url: string | null
  /** Vínculos do mapa (Leva 6); nulos em foto antiga ou de obra sem mapa. */
  ambienteId?: string | null
  pontoId?: string | null
  atividadeNumero?: number | null
}

/** Onde a foto nova fica no mapa (Leva 6). Com ponto, o ambiente é o do ponto. */
export type VinculoFoto = { ambienteId?: string | null; pontoId?: string | null; atividadeNumero?: number | null }

/**
 * O que o passo Fotos recebe quando a obra tem mapa (pelo menos um ambiente).
 * Sem mapa, `null`: o diário fica como sempre foi (ambiente não obrigatório).
 */
export type MapaDiario = {
  ambientes: { id: string; nome: string; atividades: number[] }[]
  /** Só os pontos ativos (a ronda), por número, com a última foto anterior como referência de ângulo. */
  pontos: { id: string; numero: number; nome: string; ambienteId: string; referenciaUrl: string | null; referenciaData: string | null }[]
  atividades: { numero: number; descricao: string }[]
}
