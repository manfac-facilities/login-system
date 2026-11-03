/**
 * Fluxo da multa por etapa — funções PURAS (spec 2026-11-03 §2.1 e §4.1).
 * Espelha as funções SQL sofia_multa_etapa_ordem / _status_da_etapa /
 * _autorizacao_da_etapa e as transições da trigger trg_multas_etapa. O banco é
 * quem decide; isto só serve para a tela oferecer o botão certo com o motivo.
 */
import type { AutorizacaoStatus, Multa, MultaStatus } from './types'

export type MultaEtapa =
  | 'registrada'
  | 'condutor'
  | 'termo'
  | 'indicado'
  | 'validada'
  | 'contestada'
  | 'cobrada'
  | 'solicitado'
  | 'autorizado'
  | 'descontada'

export type ResponsavelDobro = 'empresa' | 'motorista'

/** Multa com as colunas novas (sdd-sql-sofia-multa-avaria.sql), sem mexer em types.ts. */
export type MultaComEtapa = Multa & {
  etapa: MultaEtapa
  locadora: string | null
  auto_infracao: string | null
  orgao_autuador: string | null
  pontos: number | null
  prazo_indicacao: string | null
  motorista_condutor_id: string | null
  indicado_em: string | null
  protocolo_indicacao: string | null
  boleto_lancado_em: string | null
  pago_em_dobro: boolean
  responsavel_dobro: ResponsavelDobro | null
  desconto_competencia: string | null
}

export interface EtapaInfo {
  k: MultaEtapa
  rotulo: string
  ator: string
  tag: 'NOVO' | 'AMPLIADO' | 'EXISTE'
  hoje: string
  novo: string
}

// Textos do mockup aprovado (aba 1). Ajustados onde o mockup descrevia o que NÃO
// é construído: termo (motoristas não têm login, spec §2.3) e autorizado
// (decisão 3 já tomada: só admin).
export const ETAPAS_MULTA: readonly EtapaInfo[] = [
  {
    k: 'registrada',
    rotulo: 'Multa registrada',
    ator: 'Frotas (qualquer usuário com acesso)',
    tag: 'AMPLIADO',
    hoje: 'Existe: data, recebimento, tipo, valor, descrição. Qualquer usuário com acesso registra.',
    novo: 'Novos campos: locadora, auto de infração, órgão autuador, pontos e PRAZO de indicação (padrão: recebimento + 30 dias).',
  },
  {
    k: 'condutor',
    rotulo: 'Confirmar o condutor',
    ator: 'Frotas',
    tag: 'NOVO',
    hoje: 'Hoje: o Igor olha a planilha para ver quem estava com o carro no dia.',
    novo: 'O sistema sugere o motorista pelo histórico equipe x carro x motorista na data da infração. Frotas confirma ou troca, e confirma por WhatsApp.',
  },
  {
    k: 'termo',
    rotulo: 'Motorista aceita o termo de responsabilidade',
    ator: 'Frotas (anexa o termo assinado)',
    tag: 'NOVO',
    hoje: 'Existe só um "autorizou: sim/não" e upload do termo. O termo é impresso, assinado na base e escaneado.',
    novo: 'Frotas anexa o termo assinado (PDF ou foto). O aceite pelo celular fica para depois: os motoristas ainda não têm login no hub.',
  },
  {
    k: 'indicado',
    rotulo: 'Indicar condutor ao órgão autuador',
    ator: 'Frotas',
    tag: 'NOVO',
    hoje: 'Fora do sistema (e-mail da locadora, Correios). Só existe a data limite na planilha.',
    novo: 'Frotas marca "indicado em" e o protocolo. Esta é a etapa com prazo: não espera a validação do gestor da equipe.',
  },
  {
    k: 'validada',
    rotulo: 'Gestor da equipe valida (RH em cópia)',
    ator: 'Gestor da equipe',
    tag: 'AMPLIADO',
    hoje: 'Existe o status "validada" pelo botão "Enviar para desconto", só para admin/gestor de frotas. A validação do gestor da equipe vai por e-mail e quase nunca volta.',
    novo: 'Registra quem validou, quando e por qual canal. Se o gestor contestar, a multa vai para "contestada" e não segue para desconto.',
  },
  {
    k: 'contestada',
    rotulo: 'Contestada pelo gestor da equipe',
    ator: 'Gestor da equipe',
    tag: 'NOVO',
    hoje: 'Não existe: a contestação ficava no e-mail.',
    novo: 'Registra quem contestou, por qual canal e o motivo. A multa não segue para desconto.',
  },
  {
    k: 'cobrada',
    rotulo: 'Boleto da locadora lançado para pagamento',
    ator: 'Frotas',
    tag: 'NOVO',
    hoje: 'Fora do módulo (processo de pagamento do hub).',
    novo: 'Só um marcador "boleto lançado em" para a multa não ficar sem cobrança. Não integra com o Financeiro nesta rodada.',
  },
  {
    k: 'solicitado',
    rotulo: 'Solicitar desconto',
    ator: 'Gestor de frotas',
    tag: 'EXISTE',
    hoje: 'Existe o botão "Solicitar" (autorizacao_status = solicitado). Hoje o banco só deixa admin/gestor de frotas.',
    novo: 'Sem mudança de regra. A tela mostra o botão desabilitado, com o motivo, para quem não pode.',
  },
  {
    k: 'autorizado',
    rotulo: 'Autorizar desconto',
    ator: 'Administrador',
    tag: 'AMPLIADO',
    hoje: 'Hoje gestor de frotas e admin autorizam o que o próprio gestor solicitou.',
    novo: 'Quem pede não autoriza: o gestor de frotas solicita e só o administrador autoriza.',
  },
  {
    k: 'descontada',
    rotulo: 'RH desconta no contracheque',
    ator: 'RH informa, Frotas registra',
    tag: 'EXISTE',
    hoje: 'Existe: registrar desconto (total ou parcial, valor descontado) na tela Descontos.',
    novo: 'Acrescenta a competência (mês do contracheque). Fecha a multa.',
  },
]

const ORDEM: Record<MultaEtapa, number> = {
  registrada: 0,
  condutor: 1,
  termo: 2,
  indicado: 3,
  validada: 4,
  contestada: 4,
  cobrada: 5,
  solicitado: 6,
  autorizado: 7,
  descontada: 8,
}

/** As 9 etapas do caminho normal, na ordem do stepper (contestada só aparece quando é a atual). */
export const ORDEM_STEPPER: readonly MultaEtapa[] = [
  'registrada',
  'condutor',
  'termo',
  'indicado',
  'validada',
  'cobrada',
  'solicitado',
  'autorizado',
  'descontada',
]

export function ehEtapaMulta(v: unknown): v is MultaEtapa {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ORDEM, v)
}

export function infoEtapa(e: MultaEtapa): EtapaInfo {
  return ETAPAS_MULTA.find((x) => x.k === e)!
}

export function ordemEtapa(e: MultaEtapa): number {
  return ORDEM[e]
}

export function statusDaEtapa(e: MultaEtapa): MultaStatus {
  if (e === 'descontada') return 'descontada'
  if (['registrada', 'condutor', 'termo', 'indicado', 'contestada'].includes(e)) return 'pendente'
  return 'validada'
}

export function autorizacaoDaEtapa(e: MultaEtapa): AutorizacaoStatus {
  if (e === 'solicitado') return 'solicitado'
  if (e === 'autorizado' || e === 'descontada') return 'autorizado'
  return 'sem_solicitacao'
}

/** Mesmas regras da trigger (spec §2.1) + a RPC não aceitar repetir a etapa (revisão N2). */
export function podeTransicionar(de: MultaEtapa, para: MultaEtapa): boolean {
  if (de === para) return de === 'condutor'
  if (para === 'autorizado') return de === 'solicitado' || de === 'descontada'
  if (para === 'descontada') return de === 'autorizado'
  if (para === 'solicitado' && de === 'autorizado') return true
  if (para === 'cobrada' && de === 'solicitado') return true
  if (para === 'contestada') return ['registrada', 'condutor', 'termo', 'indicado'].includes(de)
  if (de === 'contestada' || de === 'autorizado' || de === 'descontada') return false
  return ORDEM[para] > ORDEM[de]
}

/** Transição que só o administrador faz: autorizar e revogar. */
export function exigeAdmin(de: MultaEtapa, para: MultaEtapa): boolean {
  return (de === 'solicitado' && para === 'autorizado') || (de === 'autorizado' && para === 'solicitado')
}

export interface Perfil {
  podeGerir: boolean
  ehAdmin: boolean
}

export interface AcaoMulta {
  destino: MultaEtapa
  rotulo: string
  tipo: 'avancar' | 'voltar'
  permitida: boolean
  motivo: string | null
}

const MOTIVO_ADMIN = 'Só administrador pode.'
const MOTIVO_GESTOR = 'Só gestor de frotas ou administrador.'

const ROTULO_ACAO: Record<MultaEtapa, string> = {
  registrada: 'Registrar multa',
  condutor: 'Confirmar condutor',
  termo: 'Anexar termo assinado',
  indicado: 'Registrar indicação feita',
  validada: 'Registrar validação (em nome do gestor da equipe)',
  contestada: 'Registrar contestação',
  cobrada: 'Marcar boleto lançado',
  solicitado: 'Solicitar desconto',
  autorizado: 'Autorizar desconto',
  descontada: 'Registrar desconto efetuado',
}

/** Ação para ir de `de` a `para`, ou null se a transição não existe. */
export function acaoPara(de: MultaEtapa, para: MultaEtapa, perfil: Perfil): AcaoMulta | null {
  if (!podeTransicionar(de, para)) return null
  const voltar = ORDEM[para] < ORDEM[de]
  let rotulo = ROTULO_ACAO[para]
  if (de === 'autorizado' && para === 'solicitado') rotulo = 'Revogar autorização'
  if (de === 'solicitado' && para === 'cobrada') rotulo = 'Cancelar solicitação'
  if (de === 'descontada' && para === 'autorizado') rotulo = 'Desfazer desconto'
  const admin = exigeAdmin(de, para)
  const permitida = admin ? perfil.ehAdmin === true : perfil.podeGerir === true
  return {
    destino: para,
    rotulo,
    tipo: voltar ? 'voltar' : 'avancar',
    permitida,
    motivo: permitida ? null : admin ? MOTIVO_ADMIN : MOTIVO_GESTOR,
  }
}

/** Próxima etapa do caminho normal + contestar (antes de validada) + as voltas permitidas. */
export function proximasAcoes(etapa: MultaEtapa, perfil: Perfil): AcaoMulta[] {
  const destinos: MultaEtapa[] = []
  const i = ORDEM_STEPPER.indexOf(etapa)
  if (etapa !== 'contestada' && i >= 0 && i < ORDEM_STEPPER.length - 1) destinos.push(ORDEM_STEPPER[i + 1])
  if (['registrada', 'condutor', 'termo', 'indicado'].includes(etapa)) destinos.push('contestada')
  if (etapa === 'solicitado') destinos.push('cobrada')
  if (etapa === 'autorizado') destinos.push('solicitado')
  if (etapa === 'descontada') destinos.push('autorizado')
  return destinos.map((d) => acaoPara(etapa, d, perfil)).filter((a): a is AcaoMulta => a !== null)
}

// ---------- datas (string YYYY-MM-DD, aritmética de data pura) ----------

function parseData(d: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d ?? '')
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function formatar(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

const DIA = 86_400_000

/** Prazo padrão de indicação: recebimento + 30 dias (decisão 5). */
export function prazoPadrao(recebimento: string): string | null {
  const t = parseData(recebimento)
  return t === null ? null : formatar(t + 30 * DIA)
}

/** Hoje no fuso de São Paulo, como YYYY-MM-DD (o servidor roda em UTC). */
export function hojeSP(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
}

export interface ClassePrazo {
  tipo: 'indicado' | 'vencido' | 'urgente' | 'atencao' | 'normal'
  dias: number | null
  texto: string
}

/** Pill do prazo (prazoPill do mockup). null = não mostra pill. */
export function classePrazo(prazo: string | null, etapa: MultaEtapa, hoje: string): ClassePrazo | null {
  if (etapa === 'contestada') return null
  if (ORDEM[etapa] >= ORDEM.indicado) return { tipo: 'indicado', dias: null, texto: 'indicado' }
  if (!prazo) return null
  const p = parseData(prazo)
  const h = parseData(hoje)
  if (p === null || h === null) return null
  const dias = Math.round((p - h) / DIA)
  if (dias < 0) return { tipo: 'vencido', dias, texto: 'prazo vencido: paga em dobro' }
  const texto = `vence em ${dias} d`
  if (dias <= 5) return { tipo: 'urgente', dias, texto }
  if (dias <= 10) return { tipo: 'atencao', dias, texto }
  return { tipo: 'normal', dias, texto }
}

export const LOCADORAS_SUGERIDAS = ['Locafácil', 'Maestro', 'Foco'] as const

/** Cartão "Modo de indicação por locadora" (documento do Igor). Outra locadora: sem cartão. */
export const MODO_INDICACAO_POR_LOCADORA: Record<string, string> = {
  Maestro:
    'Maestro: papel pelos Correios, assinatura original do motorista. O sistema não substitui o papel; só controla o prazo e o envio.',
  Locafácil: 'Locafácil: habilitação + termo da locadora assinado, foto legível enviada por e-mail.',
  Foco: 'Foco: envio da habilitação com dados pessoais por e-mail.',
}
