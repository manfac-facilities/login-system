import type { VeiculoStatus } from './types'

export type MotivoParado = 'manutencao' | 'sem_motorista' | 'outro'

export function motivoParado(params: { status: VeiculoStatus; temResponsavelAtivo: boolean }): MotivoParado | null {
  if (params.status === 'manutencao') return 'manutencao'
  if (params.status === 'ativo') return params.temResponsavelAtivo ? null : 'sem_motorista'
  return 'outro'
}

export function formatarTempoDesde(desde: string, agora: Date = new Date()): string {
  const minutos = Math.floor((agora.getTime() - new Date(desde).getTime()) / 60000)
  if (minutos < 60) return `${minutos}min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `${horas}h`
  const dias = Math.floor(horas / 24)
  return `${dias}d ${horas % 24}h`
}
