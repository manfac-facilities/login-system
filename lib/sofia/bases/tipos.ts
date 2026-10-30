/**
 * Bases em tabela do Frotas (Abastecimentos, KM diário, Motoristas, Veículos).
 * Linhas já resolvidas (equipe/motorista pelo histórico, "rodou desde o anterior"
 * etc.) e 100% serializáveis: a página (servidor) monta, o cliente filtra/ordena/exporta.
 */

export type BaseId = 'abast' | 'km' | 'mot' | 'veic'
export const BASES_IDS: BaseId[] = ['abast', 'km', 'mot', 'veic']

export type SituacaoVeiculo = 'uso' | 'livre' | 'oficina' | 'fora'
export type ClasseCnhBase = 'sem' | 'em_dia' | 'vencendo' | 'vencida'

/** Contextos de correção (iguais aos de lib/sofia/correcoes.ts), só preenchidos para gestor. */
export interface ContextoAbastLinha {
  anterior: { data: string; km: number } | null
  seguinte: { data: string; km: number } | null
  mes: string
  mesLitros: number
  mesValor: number
}
export interface ContextoKmLinha {
  anterior: { data: string; km: number } | null
  seguinte: { data: string; km: number } | null
  maxOutros: number | null
}

export interface AbastLinha {
  id: string
  data: string
  placa: string
  modelo: string
  /** Equipe que estava com o carro no dia (histórico de responsabilidade); null = sem registro */
  equipe: string | null
  motorista: string | null
  litros: number | null
  valor: number
  preco: number | null
  km: number | null
  posto: string | null
  criado: string
  corrigido: boolean
  contexto: ContextoAbastLinha | null
}

export interface KmLinha {
  id: string
  data: string
  equipe: string | null
  placa: string
  motorista: string | null
  km: number
  /** diferença para o lançamento anterior do mesmo carro; null no primeiro lançamento */
  rodado: number | null
  obs: string | null
  criado: string
  /** KM antes da correção, quando corrigido */
  era: number | null
  veiculoKmAtual: number | null
  contexto: ContextoKmLinha | null
}

export interface MotLinha {
  id: string
  nome: string
  equipe: string | null
  cnh: string | null
  cnhVenc: string | null
  cnhClasse: ClasseCnhBase
  /** dias até o vencimento (negativo = vencida); null sem vencimento */
  cnhDias: number | null
  contato: string | null
  ativo: boolean
}

export interface TrechoResponsabilidade {
  inicio: string
  fim: string | null
  equipe: string | null
  motorista: string | null
}

export interface VeicLinha {
  id: string
  placa: string
  modelo: string
  ano: number | null
  sit: SituacaoVeiculo
  equipe: string | null
  motorista: string | null
  km: number
  /** KM rodado no mês corrente (soma do "rodou desde o anterior"); null sem lançamento no mês */
  kmMes: number | null
  franquia: number | null
  locacao: number | null
  retorno: string | null
  substituto: string | null
  historico: TrechoResponsabilidade[]
  ultimosKm: { data: string; km: number }[]
  ultimosAbast: { data: string; litros: number | null; valor: number }[]
}

export type Linha = AbastLinha | KmLinha | MotLinha | VeicLinha

export interface FiltrosBase {
  q: string
  de: string
  ate: string
  equipe: string
  placa: string
  motorista: string
  /** motoristas: '' | 'ativo' | 'inativo' */
  situacao: string
  /** motoristas: '' | 'alerta' | 'vencendo' | 'vencida' */
  cnh: string
  /** veículos: '' | SituacaoVeiculo */
  sit: string
}

export const FILTROS_VAZIOS: FiltrosBase = {
  q: '', de: '', ate: '', equipe: '', placa: '', motorista: '', situacao: '', cnh: '', sit: '',
}
