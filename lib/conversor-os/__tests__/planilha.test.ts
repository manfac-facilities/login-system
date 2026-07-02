import ExcelJS from 'exceljs'
import {
  localizarAba,
  localizarLinhaCabecalho,
  extrairLinhasBrutas,
  gerarWorkbookFieldControl,
} from '../planilha'
import type { ConversorRow } from '../types'

describe('localizarAba', () => {
  it('finds a worksheet by exact (trimmed) name', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('CHAMADOS')
    expect(localizarAba(workbook, 'CHAMADOS')?.name).toBe('CHAMADOS')
  })

  it('returns null when no worksheet matches', () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Outra Aba')
    expect(localizarAba(workbook, 'CHAMADOS')).toBeNull()
  })
})

describe('localizarLinhaCabecalho', () => {
  it('finds the row whose first column matches the search text', () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('DPSP')
    sheet.addRow(['Título da planilha'])
    sheet.addRow(['Cliente: DPSP'])
    sheet.addRow([])
    sheet.addRow(['Nº Chamado', 'Outra coluna'])
    expect(localizarLinhaCabecalho(sheet, 1, 'Nº Chamado')).toBe(4)
  })

  it('returns null when the header text is not found within maxLinhas', () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('DPSP')
    sheet.addRow(['algo irrelevante'])
    expect(localizarLinhaCabecalho(sheet, 1, 'Nº Chamado', 3)).toBeNull()
  })
})

describe('extrairLinhasBrutas', () => {
  it('extracts rows starting at the given row number, with correct numeroLinha', () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('CHAMADOS')
    sheet.addRow(['Codigo', 'Bandeira']) // row 1: header
    sheet.addRow(['D-1', 'TAMOIO']) // row 2
    sheet.addRow(['D-2', 'DROGASMIL']) // row 3
    const linhas = extrairLinhasBrutas(sheet, 2)
    expect(linhas).toEqual([
      { numeroLinha: 2, valores: expect.arrayContaining(['D-1', 'TAMOIO']) },
      { numeroLinha: 3, valores: expect.arrayContaining(['D-2', 'DROGASMIL']) },
    ])
  })
})

describe('gerarWorkbookFieldControl', () => {
  it('writes a header row plus one row per ConversorRow, in column order', async () => {
    const rows: ConversorRow[] = [
      {
        identificador: 'A1', tipoOs: 'Manutenção Corretiva', documentoCliente: '',
        nomeCliente: 'DPSP', nomeLocalizacao: 'Loja X', numeroSerie: '',
        nomeColaborador: '', colaboradoresSecundarios: '', dataAgendamento: '',
        horaAgendamento: '', descricao: 'desc', descricaoTarefa: '', etiquetas: '',
      },
    ]
    const workbook = gerarWorkbookFieldControl(rows)
    const sheet = workbook.worksheets[0]
    expect(sheet.getRow(1).getCell(1).value).toBe('Identificador')
    expect(sheet.getRow(2).getCell(1).value).toBe('A1')
    expect(sheet.getRow(2).getCell(4).value).toBe('DPSP')
    expect(sheet.getRow(2).getCell(11).value).toBe('desc')
  })
})
