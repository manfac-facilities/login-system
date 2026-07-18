export type VeiculoStatus = 'ativo' | 'inativo' | 'manutencao'
export type ChecklistTipo = 'recebimento' | 'saida' | 'retorno' | 'devolucao' | 'troca' | 'finalizacao_contrato'
export type MultaStatus = 'pendente' | 'validada' | 'descontada'
export type TipoDesconto = 'nenhum' | 'parcial' | 'total'
export type SinistroTipo = 'colisao' | 'furto' | 'avaria' | 'outro'
export type SinistroStatus = 'aberto' | 'em_tratativa' | 'encerrado'
export type RevisaoTipo = 'preventiva' | 'corretiva'
export type RevisaoStatus = 'em_dia' | 'agendada' | 'atrasada'
export type DocumentoVeiculoTipo = 'seguro' | 'licenciamento' | 'ipva' | 'outro'
export type MotoristaDocumentoTipo = 'termo_uso' | 'autorizacao_desconto'
export type PendenciaOrigem = 'manual' | 'multa' | 'sinistro' | 'manutencao' | 'documento' | 'termo' | 'km_excedido'
export type PendenciaStatus = 'aberta' | 'em_andamento' | 'concluida'

export interface Equipe {
  id: string
  codigo: string
  centro_custo: string | null
  ativo: boolean
  created_at: string
}

export interface Veiculo {
  id: string
  placa: string
  modelo: string
  ano: number | null
  km_atual: number
  km_contratual_mensal: number | null
  valor_locacao_mensal: number | null
  status: VeiculoStatus
  equipe_id: string | null
  previsao_retorno_oficina: string | null
  substituto_id: string | null
  created_at: string
}

export interface Motorista {
  id: string
  nome: string
  cnh: string | null
  cnh_vencimento: string | null
  contato: string | null
  equipe_id: string | null
  ativo: boolean
  created_at: string
}

export interface KmDiario {
  id: string
  data: string
  equipe_id: string
  veiculo_id: string
  motorista_id: string | null
  km_atual: number
  observacoes: string | null
  created_at: string
}

/**
 * Shape returned by `getKmHoje()`, whose `.select()` joins `equipes(codigo)`,
 * `veiculos(placa)` and `motoristas(nome)` as nested objects. These joined
 * fields are not part of the base `km_diario` row (`KmDiario`), so a separate
 * type is needed to describe what the query actually returns.
 */
export interface KmDiarioComRelacoes extends KmDiario {
  equipes: { codigo: string } | null
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}

export interface Checklist {
  id: string
  tipo: ChecklistTipo
  data: string
  equipe_id: string
  veiculo_id: string
  motorista_id: string | null
  equipe_destino_id: string | null
  motorista_destino_id: string | null
  lataria_ok: boolean | null
  vidros_ok: boolean | null
  pneus_ok: boolean | null
  combustivel_ok: boolean | null
  itens_internos_ok: boolean | null
  estepe_ok: boolean | null
  macaco_ok: boolean | null
  triangulo_ok: boolean | null
  avaria_identificada: boolean
  avaria_descricao: string | null
  chave_entregue: boolean | null
  cartao_combustivel_entregue: boolean | null
  assinatura_motorista: boolean
  observacoes: string | null
  latitude: number | null
  longitude: number | null
  created_by: string | null
  created_at: string
}

export interface ChecklistFoto {
  id: string
  checklist_id: string
  storage_path: string
  posicao: string | null
  latitude: number | null
  longitude: number | null
  tirada_em: string
  created_at: string
}

export interface Multa {
  id: string
  veiculo_id: string | null
  motorista_id: string | null
  data: string
  data_recebimento: string | null
  tipo_infracao: string | null
  descricao: string | null
  valor: number
  valor_descontado: number | null
  tipo_desconto: TipoDesconto
  status: MultaStatus
  autorizacao_assinada: boolean
  autorizacao_status: AutorizacaoStatus
  autorizacao_solicitado_em: string | null
  autorizacao_storage_path: string | null
  ziv_task_id: string | null
  observacoes: string | null
  created_at: string
}

export interface Sinistro {
  id: string
  veiculo_id: string | null
  motorista_id: string | null
  data: string
  tipo: SinistroTipo
  descricao: string
  valor_dano: number | null
  valor_descontado: number | null
  tipo_desconto: TipoDesconto
  autorizacao_assinada: boolean
  autorizacao_status: AutorizacaoStatus
  autorizacao_solicitado_em: string | null
  autorizacao_storage_path: string | null
  status: SinistroStatus
  status_desconto: MultaStatus
  observacoes: string | null
  created_at: string
}

export interface KmExcedidoDesconto {
  id: string
  veiculo_id: string
  motorista_id: string | null
  mes: string
  km_contratual: number
  km_realizado: number
  autorizacao_status: AutorizacaoStatus
  autorizacao_solicitado_em: string | null
  observacoes: string | null
  created_at: string
}

export interface SinistroFoto {
  id: string
  sinistro_id: string
  storage_path: string
  created_at: string
}

export interface Revisao {
  id: string
  veiculo_id: string
  motorista_id: string | null
  tipo: RevisaoTipo
  fornecedor: string | null
  valor: number | null
  nota_fiscal_storage_path: string | null
  data_realizada: string | null
  km_realizada: number | null
  proxima_data: string | null
  proxima_km: number | null
  status: RevisaoStatus
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface DocumentoVeiculo {
  id: string
  veiculo_id: string
  tipo: DocumentoVeiculoTipo
  numero: string | null
  vencimento: string
  storage_path: string | null
  created_at: string
}

export interface Abastecimento {
  id: string
  veiculo_id: string
  data: string
  litros: number | null
  valor: number
  km: number | null
  posto: string | null
  created_at: string
}

export interface MotoristaDocumento {
  id: string
  motorista_id: string
  tipo: MotoristaDocumentoTipo
  assinado: boolean
  data_assinatura: string | null
  storage_path: string | null
  multa_id: string | null
  sinistro_id: string | null
  created_at: string
}

export interface VeiculoResponsabilidadeHistorico {
  id: string
  veiculo_id: string
  equipe_id: string | null
  motorista_id: string | null
  inicio: string
  fim: string | null
  origem_checklist_id: string | null
  created_at: string
}

export interface CentroCustoHistorico {
  id: string
  veiculo_id: string
  centro_custo: string
  vigente_desde: string
  created_at: string
}

export interface Pendencia {
  id: string
  descricao: string
  origem: PendenciaOrigem
  responsavel: string | null
  prazo: string | null
  proxima_acao: string | null
  status: PendenciaStatus
  created_at: string
  updated_at: string
}

export type AutorizacaoStatus = 'sem_solicitacao' | 'solicitado' | 'autorizado'

export type AuditAcao = 'criacao' | 'exclusao'

export interface AuditLog {
  id: string
  tabela: string
  registro_id: string
  acao: AuditAcao
  dados: Record<string, unknown>
  usuario_email: string | null
  created_at: string
}
