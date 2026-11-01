/**
 * Tipos do mapa da obra (Leva 6). Ficam aqui, e não no `_actions.ts`, porque
 * `export type` num arquivo `'use server'` derruba a tela em runtime
 * (rules/obras.md, armadilha 1).
 */

import type { ModoMapa } from '../../_lib/mapa-leitura'

export type Resultado = { ok: true } | { ok: false; erro: string }

/** Retângulo em coordenadas relativas 0–1 do quadro (imagem da planta ou croqui). */
export type Retangulo = { x: number; y: number; w: number; h: number }

export type DadosAmbiente = { nome: string; areaM2: number | null; retangulo: Retangulo | null }

export type DadosPonto = { nome: string; ambienteId: string; x: number | null; y: number | null }

/** O que a tela do mapa recebe por ambiente (sem peso nem valor: nada de R$ no navegador). */
export type AmbienteTela = {
  id: string
  nome: string
  areaM2: number | null
  x: number | null
  y: number | null
  w: number | null
  h: number | null
  /** Avanço físico (0–1) das atividades ligadas; null = sem atividade ligada ("—"). */
  pct: number | null
  previsto: number | null
  faixa: 0 | 1 | 2 | 3 | 4 | null
  atividades: { numero: number; descricao: string; pct: number; atrasada: boolean; concluida: boolean }[]
  /** Impedimentos abertos marcados neste ambiente. */
  impedimentos: { id: string; descricao: string }[]
  fotos: { id: string; url: string | null; data: string; pontoNumero: number | null }[]
}

export type PontoTela = { id: string; numero: number; nome: string; ambienteId: string; x: number | null; y: number | null }

export type MapaTela = {
  modo: ModoMapa
  /** URL assinada curta (gerada no servidor) da planta; null sem planta. */
  plantaUrl: string | null
  plantaLargura: number | null
  plantaAltura: number | null
  ambientes: AmbienteTela[]
  pontos: PontoTela[]
}
