export type Resultado = { ok: true } | { ok: false; erro: string }

export const TIPOS_ENVIO = [
  { valor: 'diario', rotulo: 'Diário' },
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'imediato', rotulo: 'Imediato' },
] as const

export type TipoEnvio = (typeof TIPOS_ENVIO)[number]['valor']
export type Lado = 'cliente' | 'interno'

export type DestinatarioEntrada = {
  id?: string
  email: string
  nome: string | null
  funcao: string | null
  lado: Lado
  tipos: TipoEnvio[]
  ativo: boolean
}

export type Destinatario = DestinatarioEntrada & { id: string }

export type ConfigObra = {
  engenheiroEmail: string | null
  dataBase: string | null
  atividadeTrava: number | null
}

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
}
