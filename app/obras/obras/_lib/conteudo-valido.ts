/**
 * Predicados de esquema do conteúdo congelado (entrada não confiável) e escape
 * de HTML — comuns ao semanal e aos relatórios de período.
 */
export const ISO = /^\d{4}-\d{2}-\d{2}$/
export type Campos = Record<string, unknown>
export const obj = (v: unknown): v is Campos => typeof v === 'object' && v !== null && !Array.isArray(v)
export const str = (v: unknown): v is string => typeof v === 'string'
export const strOuNull = (v: unknown) => v === null || str(v)
export const nums = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
export const lista = (v: unknown, item: (x: Campos) => boolean) => Array.isArray(v) && v.every((x) => obj(x) && item(x))
export const strs = (x: Campos, ...k: string[]) => k.every((c) => str(x[c]))

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
