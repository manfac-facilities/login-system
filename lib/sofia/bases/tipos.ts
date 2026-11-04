/**
 * Bases em tabela do Frotas (Abastecimentos, KM diário, Motoristas, Veículos; desde 03/11/2026
 * também Revisões, Manutenção corretiva, Multas, Sinistros e Documentos).
 * Linhas já resolvidas (equipe/motorista pelo histórico, "rodou desde o anterior"
 * etc.) e 100% serializáveis: a página (servidor) monta, o cliente filtra/ordena/exporta.
 */
import type { ManutencaoStatus, QuemArca } from '../manutencoes'
import type { SituacaoCarro } from '../revisaoPrevisao'
import type {
  AutorizacaoStatus, DocumentoVeiculoTipo, MultaStatus, SinistroStatus, SinistroTipo, TipoDesconto,
} from '../types'

export type BaseId = 'abast' | 'km' | 'mot' | 'veic' | 'rev' | 'corr' | 'multa' | 'sin' | 'doc'
export const BASES_IDS: BaseId[] = ['abast', 'km', 'mot', 'veic', 'rev', 'corr', 'multa', 'sin', 'doc']
/** As 5 bases da terceira bateria (03/11/2026). */
export const BASES_NOVAS: BaseId[] = ['rev', 'corr', 'multa', 'sin', 'doc']

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

/** Situação na base de revisões: a da vigente do carro, ou "hist" (já superada). */
export type SituacaoRevLinha = Exclude<SituacaoCarro, 'sembase'> | 'hist'

export interface RevLinha {
  id: string
  veiculoId: string
  /** data_realizada (pode faltar em registro antigo) */
  data: string | null
  placa: string
  modelo: string
  motorista: string | null
  tipo: string
  oficina: string | null
  km: number | null
  valor: number | null
  pecas: string | null
  obs: string | null
  proxKm: number | null
  proxAuto: boolean
  proxData: string | null
  intervalo: number
  sit: SituacaoRevLinha
  origem: 'manual' | 'importacao'
}

export interface CorrLinha {
  id: string
  veiculoId: string
  /** = data de entrada (é a data do filtro de período) */
  data: string
  saidaPrev: string | null
  saida: string | null
  placa: string
  modelo: string
  motorista: string | null
  defeito: string
  oficina: string | null
  /** só quando tirou o carro da equipe */
  dias: number | null
  custo: number | null
  arca: QuemArca | null
  status: ManutencaoStatus
  tirou: boolean
  obs: string | null
  temArquivo: boolean
}

export interface MultaLinha {
  id: string
  data: string
  placa: string
  motorista: string | null
  infracao: string | null
  valor: number
  desc: number | null
  sit: MultaStatus
  aut: AutorizacaoStatus
  autSolicitadoEm: string | null
}

export interface SinLinha {
  id: string
  data: string
  placa: string
  motorista: string | null
  tipo: SinistroTipo
  desc: string
  dano: number | null
  descontado: number | null
  tipoDesconto: TipoDesconto
  sit: SinistroStatus
  aut: AutorizacaoStatus
  autSolicitadoEm: string | null
}

export type SituacaoDoc = 'vencido' | 'vence30' | 'dia'
export interface DocLinha {
  id: string
  placa: string
  modelo: string
  tipo: DocumentoVeiculoTipo
  numero: string | null
  venc: string
  sit: SituacaoDoc
  /** dias até o vencimento (negativo = vencido) */
  dias: number
  temArquivo: boolean
}

export type Linha = AbastLinha | KmLinha | MotLinha | VeicLinha | RevLinha | CorrLinha | MultaLinha | SinLinha | DocLinha

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
  /** veículos: '' | SituacaoVeiculo; rev/multa/sin/doc: a situação da linha */
  sit: string
  /** rev/sin/doc */
  tipo: string
  /** corr */
  status: string
  /** corr: quem arca */
  arca: string
  /** multa: autorização */
  aut: string
}

export const FILTROS_VAZIOS: FiltrosBase = {
  q: '', de: '', ate: '', equipe: '', placa: '', motorista: '', situacao: '', cnh: '', sit: '',
  tipo: '', status: '', arca: '', aut: '',
}

// ---------------------------------------------------------------- filtros de cada base

export type CampoSelecao = 'situacao' | 'cnh' | 'sit' | 'tipo' | 'status' | 'arca' | 'aut'
export type CampoFiltro =
  | { k: 'periodo' }
  | { k: 'equipe' | 'placa' | 'motorista'; t: string; lista: 'equipes' | 'placas' | 'motoristas'; todos: string }
  | { k: CampoSelecao; t: string; opcoes: [string, string][]; todos: string }

const EQUIPE: CampoFiltro = { k: 'equipe', t: 'Equipe', lista: 'equipes', todos: 'Todas' }
const PLACA: CampoFiltro = { k: 'placa', t: 'Placa', lista: 'placas', todos: 'Todas' }
const MOTORISTA: CampoFiltro = { k: 'motorista', t: 'Motorista', lista: 'motoristas', todos: 'Todos' }
const PERIODO: CampoFiltro = { k: 'periodo' }

export const AUT_LBL: Record<AutorizacaoStatus, string> = { sem_solicitacao: 'Sem pedido', solicitado: 'Pedida', autorizado: 'Autorizada' }
export const MULTA_SIT_LBL: Record<MultaStatus, string> = { pendente: 'Pendente', validada: 'Validada', descontada: 'Descontada' }
export const SIN_TIPO_LBL: Record<SinistroTipo, string> = { colisao: 'Colisão', furto: 'Furto', avaria: 'Avaria', outro: 'Outro' }
export const SIN_SIT_LBL: Record<SinistroStatus, string> = { aberto: 'Aberto', em_tratativa: 'Em tratativa', encerrado: 'Encerrado' }
export const REV_SIT_LBL: Record<SituacaoRevLinha, string> = {
  atrasada: 'Atrasada', breve: 'Vence em breve', dia: 'Em dia', semprev: 'Sem previsão automática', hist: 'Histórico',
}
export const DOC_SIT_LBL: Record<SituacaoDoc, string> = { vencido: 'Vencido', vence30: 'Vence em 30 dias', dia: 'Em dia' }
const opc = (r: Record<string, string>): [string, string][] => Object.entries(r)

/** Filtros de cada base, na ordem da tela (a busca vem sempre antes). */
export const FILTROS_DA_BASE: Record<BaseId, CampoFiltro[]> = {
  abast: [PERIODO, EQUIPE, PLACA, MOTORISTA],
  km: [PERIODO, EQUIPE, PLACA, MOTORISTA],
  mot: [
    EQUIPE,
    { k: 'situacao', t: 'Situação', todos: 'Todos', opcoes: [['ativo', 'Ativos'], ['inativo', 'Inativos']] },
    {
      k: 'cnh', t: 'CNH', todos: 'Todas',
      opcoes: [['alerta', 'Vencida ou vencendo em 60 dias'], ['vencendo', 'Vencendo em 60 dias'], ['vencida', 'Vencida']],
    },
  ],
  veic: [
    EQUIPE, PLACA,
    { k: 'sit', t: 'Situação', todos: 'Todas', opcoes: [['uso', 'Em uso'], ['livre', 'Livre'], ['oficina', 'Na oficina'], ['fora', 'Fora da frota']] },
  ],
  rev: [
    PERIODO, PLACA,
    { k: 'tipo', t: 'Tipo', todos: 'Todos', opcoes: [['preventiva', 'Preventiva'], ['corretiva', 'Corretiva']] },
    {
      k: 'sit', t: 'Situação', todos: 'Todos',
      opcoes: [['atrasada', 'Atrasada'], ['breve', 'Vence em breve'], ['dia', 'Em dia'], ['semprev', 'Sem previsão automática'], ['hist', 'Histórico (já superada)']],
    },
  ],
  corr: [
    PERIODO, PLACA,
    {
      k: 'status', t: 'Status', todos: 'Todos',
      opcoes: [['aguardando_orcamento', 'Aguardando orçamento'], ['aguardando_aprovacao', 'Aguardando aprovação'], ['em_conserto', 'Em conserto'], ['concluida', 'Concluída']],
    },
    { k: 'arca', t: 'Quem arca', todos: 'Todos', opcoes: [['locadora', 'Locadora'], ['empresa', 'Empresa'], ['motorista', 'Motorista (mau uso)']] },
  ],
  multa: [
    PERIODO, PLACA, MOTORISTA,
    { k: 'sit', t: 'Situação', todos: 'Todos', opcoes: opc(MULTA_SIT_LBL) },
    { k: 'aut', t: 'Autorização', todos: 'Todos', opcoes: opc(AUT_LBL) },
  ],
  sin: [
    PERIODO, PLACA, MOTORISTA,
    { k: 'tipo', t: 'Tipo', todos: 'Todos', opcoes: opc(SIN_TIPO_LBL) },
    { k: 'sit', t: 'Situação', todos: 'Todos', opcoes: opc(SIN_SIT_LBL) },
  ],
  doc: [
    PLACA,
    {
      k: 'tipo', t: 'Tipo', todos: 'Todos',
      opcoes: [['seguro', 'Seguro'], ['licenciamento', 'Licenciamento (CRLV)'], ['ipva', 'IPVA'], ['contrato_locacao', 'Contrato de locação'], ['outro', 'Outro']],
    },
    { k: 'sit', t: 'Situação', todos: 'Todos', opcoes: opc(DOC_SIT_LBL) },
  ],
}

export const temPeriodo = (base: BaseId): boolean => FILTROS_DA_BASE[base].some((c) => c.k === 'periodo')
