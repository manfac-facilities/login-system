/**
 * Exportar uma base do Frotas para Excel (.xlsx) — padrão de app/obras/base/_exportar.ts.
 * Roda no navegador, com a lista que está na tela (filtrada e ordenada). exceljs só no clique.
 */
import { EXCEL, linhasParaExcel, nomeArquivoExcel } from './colunas'
import type { BaseId, Linha } from './tipos'

export async function gerarPlanilha(base: BaseId, rows: Linha[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs')
  const def = EXCEL[base]
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(def.aba, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = def.colunas.map((c) => ({ header: c.t, width: c.largura, style: c.fmt ? { numFmt: c.fmt } : {} }))
  ws.addRows(linhasParaExcel(base, rows))

  const cab = ws.getRow(1)
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2050' } }
  cab.alignment = { vertical: 'middle', wrapText: true }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: def.colunas.length } }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

export async function baixarExcel(base: BaseId, rows: Linha[], hoje: string): Promise<void> {
  const buf = await gerarPlanilha(base, rows)
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivoExcel(base, hoje)
  a.click()
  URL.revokeObjectURL(url)
}
