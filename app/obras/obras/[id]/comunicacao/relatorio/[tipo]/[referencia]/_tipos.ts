/** Tipos da tela do relatório de período (fora do `_actions.ts`: `use server` não exporta tipo). */
export type { Resultado, ResultadoEnvio, ResultadoIa } from '../../../semanal/_tipos'
export { MAX_OBSERVACOES } from '../../../semanal/_tipos'

export type EstadoTela = 'nao_iniciado' | 'rascunho' | 'validado' | 'enviado'

/** O que o rascunho grava: observações, ids automáticos MARCADOS e o highlight livre. */
export type EntradaRascunho = { observacoes: string; marcados: string[]; livre: string }

export const ROTULO_TIPO = { mensal: 'Relatório mensal', fase: 'Relatório de fase', entrega: 'Relatório de entrega' } as const
