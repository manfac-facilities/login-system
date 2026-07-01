export type Cliente = 'DPSP' | 'D1000'

export interface ConversorRow {
  identificador: string
  tipoOs: string
  documentoCliente: string
  nomeCliente: string
  nomeLocalizacao: string
  numeroSerie: string
  nomeColaborador: string
  colaboradoresSecundarios: string
  dataAgendamento: string
  horaAgendamento: string
  descricao: string
  descricaoTarefa: string
  etiquetas: string
}

export interface LinhaErro {
  linha: number
  motivo: string
}

export interface ConversaoResultado {
  linhasOrigem: number
  linhasConvertidas: number
  duplicadosRemovidos: number
  erros: LinhaErro[]
  rows: ConversorRow[]
}
