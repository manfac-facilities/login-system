/**
 * Regras puras do editor do mapa (Leva 6), usadas pela tela e pelas actions.
 * Coordenadas sempre relativas 0–1 (spec §3), com 4 casas.
 */
import type { Retangulo } from './_tipos'

const CASAS = 10000
export const arred = (v: number) => Math.round(v * CASAS) / CASAS
const dentro = (v: number) => Math.min(Math.max(v, 0), 1)
/** Lado mínimo do retângulo (1% do quadro): evita ambiente invisível. */
export const LADO_MINIMO = 0.01

/**
 * Retângulo válido para o banco (`obras_ambiente_retangulo_check`): x,y ≥ 0,
 * w,h > 0, x+w ≤ 1, y+h ≤ 1. Arredonda e encaixa no quadro; entrada não
 * numérica → null.
 */
export function normalizarRetangulo(r: Retangulo | null | undefined): Retangulo | null {
  if (!r) return null
  const vals = [r.x, r.y, r.w, r.h]
  if (!vals.every((v) => typeof v === 'number' && Number.isFinite(v))) return null
  const x = arred(dentro(r.x))
  const y = arred(dentro(r.y))
  const w = arred(Math.min(Math.max(r.w, LADO_MINIMO), 1 - x))
  const h = arred(Math.min(Math.max(r.h, LADO_MINIMO), 1 - y))
  if (!(w > 0 && h > 0)) return null
  return { x, y, w, h }
}

/** Posição de ponto (0–1) ou null quando não veio (modo ambientes). */
export function normalizarPosicao(x: number | null | undefined, y: number | null | undefined): { x: number; y: number } | null {
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x: arred(dentro(x)), y: arred(dentro(y)) }
}

/** Extensões aceitas para a planta, pelo tipo do arquivo (o banco aceita jpg|jpeg|png|webp). */
export const EXTENSAO_PLANTA: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
/** Caminho canônico da planta: `<obra>/mapa/<uuid>.<ext>` (mesma regex do banco, minúsculas). */
export function caminhoPlantaValido(obraId: string, path: string): boolean {
  return new RegExp(`^${UUID}/mapa/${UUID}\\.(jpg|jpeg|png|webp)$`).test(path) && path.startsWith(`${obraId}/mapa/`)
}
