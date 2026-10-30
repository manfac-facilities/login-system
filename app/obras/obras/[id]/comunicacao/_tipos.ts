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
