/**
 * Tipos e regras puras de impedimentos e orientações (Task 9a, spec §5.3 item 4
 * e §7.1). Fora do arquivo 'use server' de propósito.
 */

export type Resultado = { ok: true } | { ok: false; erro: string }

export type ResponsavelImp = 'cliente' | 'manfac' | 'terceiro' | 'clima'

export const TIPOS_IMPEDIMENTO = [
  'Área não liberada',
  'Cliente no local',
  'Serviço danificado pelo cliente',
  'Orientação descumprida',
  'Decisão pendente do cliente',
  'Material do cliente',
  'Material Manfac',
  'Equipe',
  'Clima',
  'Outro',
] as const

export type TipoImpedimento = (typeof TIPOS_IMPEDIMENTO)[number]

export const RESPONSAVEIS: { valor: ResponsavelImp; rotulo: string }[] = [
  { valor: 'cliente', rotulo: 'Cliente' },
  { valor: 'manfac', rotulo: 'Manfac' },
  { valor: 'terceiro', rotulo: 'Terceiro' },
  { valor: 'clima', rotulo: 'Clima' },
]

export const rotuloResponsavel = (r: ResponsavelImp | null) =>
  RESPONSAVEIS.find((x) => x.valor === r)?.rotulo ?? '—'

/** Responsável sugerido pelo tipo; `null` em "Outro" (a pessoa escolhe). */
export function responsavelPadrao(tipo: string | null): ResponsavelImp | null {
  const i = TIPOS_IMPEDIMENTO.indexOf(tipo as TipoImpedimento)
  if (i < 0) return null
  if (i <= 5) return 'cliente'
  if (tipo === 'Material Manfac' || tipo === 'Equipe') return 'manfac'
  if (tipo === 'Clima') return 'clima'
  return null
}

/** Cliente vê o que é dele ou do clima; manfac/terceiro ficam internos por padrão. */
export const exibirAoClientePadrao = (r: ResponsavelImp | null): boolean => r === 'cliente' || r === 'clima'

/**
 * Data com que o botão "Encerrar" encerra: a de referência (data do diário ou
 * hoje), mas nunca antes da abertura. Item 9 da reunião de 31/10: o impedimento
 * aberto pelo diário de um dia posterior nasce com `aberto_em` = data do diário,
 * e o botão mandava "hoje" — anterior à abertura, a action recusava.
 */
export const dataEncerramento = (abertoEm: string, referencia: string): string =>
  referencia < abertoEm ? abertoEm : referencia

export type NovoImpedimento = {
  tipo: string | null
  responsavel: ResponsavelImp | null
  atividadeNumero: number | null
  descricao: string
  pessoaCliente: string | null
  fotoPath: string | null
  travaAtividade: boolean
  impactoDias: number | null
  /** Ausente = padrão do responsável. */
  exibirAoCliente?: boolean
  /** Ausente = hoje. */
  abertoEm?: string
  rdoId?: string | null
}

export type NovaOrientacao = {
  descricao: string
  pessoaCliente: string | null
  atividadeNumero: number | null
  fotoPath: string | null
  exibirAoCliente?: boolean
  abertoEm?: string
  rdoId?: string | null
}
