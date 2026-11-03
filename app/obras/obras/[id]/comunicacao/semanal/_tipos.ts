/** Tipos da tela do relatório semanal (fora do `_actions.ts`: `use server` não exporta tipo). */
export type Resultado = { ok: true } | { ok: false; erro: string }
export type ResultadoEnvio = Resultado & { enviados?: number }
export type ResultadoIa = { ok: true; texto: string } | { ok: false; erro: string }
export const MAX_OBSERVACOES = 5000
