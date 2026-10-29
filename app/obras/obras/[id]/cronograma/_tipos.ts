/**
 * Tipos das Server Actions do cronograma. Ficam aqui porque `export type` num
 * arquivo `'use server'` derruba a tela em runtime (rules/obras.md, armadilha 1).
 */
import type { StatusAtividade } from '../../_lib/cronograma'

export type Resultado = { ok: true } | { ok: false; erro: string }

/** O que o engenheiro edita numa linha do rascunho. `numero` identifica a linha. */
export type LinhaPlano = {
  numero: number
  etapa: string
  descricao: string
  pred1: number | null
  pred2: number | null
  duracao: number
  bloqueiaPorTrava: boolean
}

export type CamposExecucao = {
  status?: StatusAtividade
  percentual?: number
  inicioReal?: string | null
  fimReal?: string | null
}
