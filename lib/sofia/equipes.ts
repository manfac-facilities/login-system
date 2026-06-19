import type { ChecklistTipo, VeiculoStatus } from './types'

export function ultimoTipoPorVeiculo(
  checklists: { veiculo_id: string; tipo: ChecklistTipo; created_at: string }[]
): Map<string, ChecklistTipo> {
  const result = new Map<string, ChecklistTipo>()
  for (const c of checklists) {
    if (!result.has(c.veiculo_id)) result.set(c.veiculo_id, c.tipo)
  }
  return result
}

export type StatusEquipe = 'em_rota' | 'disponivel' | 'manutencao' | 'inativa'

export function statusEquipe(params: {
  ativo: boolean
  veiculoStatus?: VeiculoStatus
  ultimoTipo?: ChecklistTipo
}): StatusEquipe {
  if (!params.ativo) return 'inativa'
  if (params.veiculoStatus === 'manutencao') return 'manutencao'
  if (params.ultimoTipo === 'saida') return 'em_rota'
  return 'disponivel'
}
