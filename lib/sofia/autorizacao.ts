import type { AutorizacaoStatus } from './types'

export function formatAutorizacaoLabel(
  status: AutorizacaoStatus,
  solicitadoEm: string | null
): string {
  if (status === 'autorizado') return 'autorizado'
  if (status === 'solicitado') {
    if (!solicitadoEm) return 'solicitação feita - hoje sem resposta'
    const dias = Math.floor((Date.now() - new Date(solicitadoEm).getTime()) / 86400000)
    if (dias === 0) return 'solicitação feita - hoje sem resposta'
    return `solicitação feita - ${dias} dia${dias !== 1 ? 's' : ''} sem resposta`
  }
  return 'não solicitado'
}

export function autorizacaoBadgeClass(status: AutorizacaoStatus): string {
  if (status === 'autorizado') return 'bg-green-900 text-green-300'
  if (status === 'solicitado') return 'bg-amber-900 text-amber-300'
  return 'bg-[#1e3a5f] text-[#94a3b8]'
}
