import type {
  VeiculoStatus,
  MultaStatus,
  SinistroStatus,
  PendenciaStatus,
  AutorizacaoStatus,
} from './types'

/**
 * Valores permitidos dos enums de status em runtime (achado B-17 da auditoria).
 * As `type` unions de types.ts só existem em tempo de compilação; estas tuplas
 * dão a mesma lista em runtime pra validar valores vindos de FormData antes de
 * gravar. O `satisfies` garante que a tupla e a union não saiam de sincronia:
 * se alguém adicionar um valor ao type sem atualizar aqui (ou vice-versa), o
 * typecheck quebra.
 */
export const VEICULO_STATUS = ['ativo', 'inativo', 'manutencao'] as const satisfies readonly VeiculoStatus[]
export const MULTA_STATUS = ['pendente', 'validada', 'descontada'] as const satisfies readonly MultaStatus[]
export const SINISTRO_STATUS = ['aberto', 'em_tratativa', 'encerrado'] as const satisfies readonly SinistroStatus[]
export const PENDENCIA_STATUS = ['aberta', 'em_andamento', 'concluida'] as const satisfies readonly PendenciaStatus[]
export const AUTORIZACAO_STATUS = ['sem_solicitacao', 'solicitado', 'autorizado'] as const satisfies readonly AutorizacaoStatus[]

/** Retorna true (com narrowing) se `value` for um dos valores permitidos. */
export function isValidEnum<T extends string>(allowed: readonly T[], value: string): value is T {
  return (allowed as readonly string[]).includes(value)
}
