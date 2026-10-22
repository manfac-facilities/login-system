/**
 * Quem ganha o botão "Enviar para faturamento" na ficha da obra.
 *
 * DPSP e D1000 liberam o faturamento por e-mail (o Financeiro já lê de lá);
 * para os demais clientes a liberação é combinada fora do sistema e o PCM
 * registra aqui. O banco repete a regra em `obras_enviar_para_faturamento`.
 */
import type { ObraRow } from './tipos'

export const CLIENTES_QUE_LIBERAM_POR_EMAIL: readonly string[] = ['DPSP', 'D1000']

export function podeEnviarParaFaturamento(
  obra: Pick<ObraRow, 'etapa' | 'cliente' | 'cancelado_em' | 'fat_enviado_em'>
): boolean {
  const cliente = (obra.cliente ?? '').trim().toUpperCase()
  if (cliente === '') return false
  if (CLIENTES_QUE_LIBERAM_POR_EMAIL.includes(cliente)) return false
  if (obra.etapa === 'faturado') return false
  if (obra.cancelado_em) return false
  if (obra.fat_enviado_em) return false
  return true
}
