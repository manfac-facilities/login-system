/** Tipos da aba Comunicação (Leva 2 §3.1/§3.5). Fora do `_actions.ts` de propósito (`use server` não exporta tipo). */

export type Resultado = { ok: true } | { ok: false; erro: string }

export type Envio = {
  id: string
  tipo: string | null
  referencia: string | null
  lado: string | null
  enviadoPor: string | null
  enviadoEm: string
  destinatarios: string[]
  resultado: 'ok' | 'falha' | null
  detalhe: string | null
  registroId: string | null
}

export const TIPOS_REGISTRO = [
  { valor: 'reuniao', rotulo: 'Reunião (ata)' },
  { valor: 'ligacao', rotulo: 'Ligação' },
  { valor: 'visita', rotulo: 'Visita' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

/** Tipos do registro manual (a imediata nasce só pelo envio). */
export type TipoRegistroManual = (typeof TIPOS_REGISTRO)[number]['valor']
export type TipoRegistro = TipoRegistroManual | 'imediata'

export type Pendencia = { oque: string; responsavel: string; prazo: string | null }
export type Ata = { pauta: string; decisoes: string[]; pendencias: Pendencia[] }

export type NivelImediata = 'atencao' | 'urgente'
export const NIVEIS: { valor: NivelImediata; rotulo: string }[] = [
  { valor: 'atencao', rotulo: 'Atenção' },
  { valor: 'urgente', rotulo: 'Urgente' },
]

/** O que o formulário de registro manda (criar e editar). */
export type RegistroEntrada = {
  tipo: TipoRegistroManual
  data: string
  participantes: string
  texto: string
  /** Só na reunião. */
  ata: Ata | null
}

export type ImediataEntrada = {
  assunto: string
  texto: string
  nivel: NivelImediata
  impedimentoId: string | null
  atividadeNumero: number | null
}

export type Registro = {
  id: string
  tipo: TipoRegistro
  data: string
  participantes: string | null
  texto: string | null
  /** Reunião: pauta/decisões/pendências. Imediata: só `assunto` (guardado no mesmo jsonb). */
  ata: (Partial<Ata> & { assunto?: string }) | null
  nivel: NivelImediata | null
  impedimentoId: string | null
  atividadeNumero: number | null
  criadoPor: string | null
  criadoEm: string
  editadoEm: string | null
}

/** Destinatário que a tela de envio oferece (ata) ou mostra na confirmação (imediata). */
export type DestinatarioOpcao = { email: string; nome: string | null; lado: 'cliente' | 'interno'; tipos: string[] }

export type FiltroLinha = 'todos' | 'diario' | TipoRegistro

export type ItemLinha =
  | { tipo: 'envio'; chave: string; quando: string; envio: Envio }
  | { tipo: 'registro'; chave: string; quando: string; registro: Registro; envios: Envio[]; podeEditar: boolean }
