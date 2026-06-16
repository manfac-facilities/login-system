export type VeiculoStatus = 'ativo' | 'inativo' | 'manutencao'
export type ChecklistTipo = 'saida' | 'retorno'
export type MultaStatus = 'pendente' | 'validada' | 'descontada'

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
  status: VeiculoStatus
  equipe_id: string | null
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
  km_inicial: number
  km_final: number | null
  observacoes: string | null
  created_at: string
}

export interface Checklist {
  id: string
  tipo: ChecklistTipo
  data: string
  equipe_id: string
  veiculo_id: string
  motorista_id: string | null
  lataria_ok: boolean | null
  vidros_ok: boolean | null
  pneus_ok: boolean | null
  combustivel_ok: boolean | null
  itens_internos_ok: boolean | null
  estepe_ok: boolean | null
  macaco_ok: boolean | null
  triangulo_ok: boolean | null
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
  descricao: string
  valor: number
  status: MultaStatus
  ziv_task_id: string | null
  observacoes: string | null
  created_at: string
}

export interface Revisao {
  id: string
  veiculo_id: string
  km_ultima_revisao: number | null
  data_ultima_revisao: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}
