import type { ChecklistTipo } from './types'

export interface ChecklistBadge {
  label: string
  style: string
}

/**
 * Rótulo e cor de cada tipo de checklist na listagem.
 *
 * O `Record<ChecklistTipo, …>` é proposital: se alguém adicionar um valor à
 * union `ChecklistTipo` sem dar um badge a ele aqui, o typecheck quebra. Foi
 * exatamente essa falta que deixou os três tipos da v04 (recebimento,
 * devolução e finalização de contrato) aparecendo como "RETORNO" na listagem.
 */
const BADGES: Record<ChecklistTipo, ChecklistBadge> = {
  recebimento: { label: '⇥ RECEBIMENTO', style: 'bg-teal-900 text-teal-300' },
  saida: { label: '↑ SAÍDA', style: 'bg-green-900 text-green-300' },
  retorno: { label: '↓ RETORNO', style: 'bg-blue-900 text-blue-300' },
  devolucao: { label: '⇤ DEVOLUÇÃO', style: 'bg-purple-900 text-purple-300' },
  troca: { label: '⇄ TROCA', style: 'bg-amber-900 text-amber-300' },
  finalizacao_contrato: { label: '⊗ FIM DE CONTRATO', style: 'bg-rose-900 text-rose-300' },
}

/**
 * Devolve o badge de um tipo vindo do banco. Um tipo desconhecido é exibido
 * como ele mesmo, em cinza neutro — nunca disfarçado de outro tipo, que
 * falsificaria o histórico pra quem está auditando.
 */
export function badgeChecklist(tipo: string): ChecklistBadge {
  return (
    BADGES[tipo as ChecklistTipo] ?? {
      label: tipo.replace(/_/g, ' ').toUpperCase(),
      style: 'bg-slate-800 text-slate-300',
    }
  )
}
