import ExcelJS from 'exceljs'
import type { LinhaBruta } from './converter'
import type { ConversorRow } from './types'

export function localizarAba(workbook: ExcelJS.Workbook, nomeExato: string): ExcelJS.Worksheet | null {
  return workbook.worksheets.find((ws) => ws.name.trim() === nomeExato) ?? null
}

export function localizarLinhaCabecalho(
  worksheet: ExcelJS.Worksheet,
  coluna: number,
  textoBusca: string,
  maxLinhas = 10
): number | null {
  for (let i = 1; i <= maxLinhas; i++) {
    const valor = worksheet.getRow(i).getCell(coluna).value
    if (String(valor ?? '').trim() === textoBusca) return i
  }
  return null
}

export function extrairLinhasBrutas(
  worksheet: ExcelJS.Worksheet,
  primeiraLinhaDados: number
): LinhaBruta[] {
  const linhas: LinhaBruta[] = []
  worksheet.eachRow({ includeEmpty: false }, (row, numeroLinha) => {
    if (numeroLinha < primeiraLinhaDados) return
    const valores: unknown[] = []
    for (let col = 1; col <= 13; col++) valores[col - 1] = row.getCell(col).value
    linhas.push({ numeroLinha, valores })
  })
  return linhas
}

const CABECALHO_FIELD_CONTROL = [
  'Identificador', 'Tipo de OS', 'Documento do cliente', 'Nome do cliente',
  'Nome da localização', 'Número de série', 'Nome do colaborador',
  'Colaboradores secundários', 'Data de agendamento', 'Hora de agendamento',
  'Descrição', 'Descrição da tarefa', 'Etiquetas',
]

export function gerarWorkbookFieldControl(rows: ConversorRow[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('OS')
  sheet.addRow(CABECALHO_FIELD_CONTROL)
  for (const row of rows) {
    sheet.addRow([
      row.identificador, row.tipoOs, row.documentoCliente, row.nomeCliente,
      row.nomeLocalizacao, row.numeroSerie, row.nomeColaborador,
      row.colaboradoresSecundarios, row.dataAgendamento, row.horaAgendamento,
      row.descricao, row.descricaoTarefa, row.etiquetas,
    ])
  }
  return workbook
}
