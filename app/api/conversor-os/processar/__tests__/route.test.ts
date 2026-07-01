/**
 * @jest-environment node
 */
// app/api/conversor-os/processar/__tests__/route.test.ts
import ExcelJS from 'exceljs'
import { POST } from '../route'

async function bufferParaFile(workbook: ExcelJS.Workbook, filename: string): Promise<File> {
  const buffer = await workbook.xlsx.writeBuffer()
  return new File([buffer], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function buildDpspWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  // Excel trunca nomes de aba em 31 caracteres — nome real no arquivo do cliente.
  const sheet = workbook.addWorksheet('Extrato do CICLO OS Corretiva+P')
  sheet.addRow(['Relatório DPSP'])
  sheet.addRow(['Gerado em 30/06/2026'])
  sheet.addRow([])
  sheet.addRow(['Nº Chamado', 'B', 'C', 'D', 'E', 'Descrição', 'G', 'Sobrenome do Solicitante'])
  sheet.addRow(['CH-1', '', '', '', '', 'Ar-condicionado com falha', '', 'Silva'])
  sheet.addRow(['CH-1', '', '', '', '', 'duplicado', '', 'Silva']) // duplicate identificador
  sheet.addRow(['', '', '', '', '', 'sem chamado', '', 'Souza']) // invalid: missing Col A
  return workbook
}

async function postFormData(cliente: string, workbook: ExcelJS.Workbook) {
  const formData = new FormData()
  formData.set('cliente', cliente)
  formData.set('arquivo', await bufferParaFile(workbook, 'planilha.xlsx'))
  const request = new Request('http://localhost/api/conversor-os/processar', {
    method: 'POST',
    body: formData,
  })
  return POST(request)
}

describe('POST /api/conversor-os/processar', () => {
  it('converts a valid DPSP file and returns summary, preview, errors, and base64 output', async () => {
    const response = await postFormData('DPSP', buildDpspWorkbook())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.cliente).toBe('DPSP')
    expect(body.filename).toMatch(/^DPSP-convertido-\d{8}-\d{4}\.xlsx$/)
    expect(body.linhasOrigem).toBe(3)
    expect(body.linhasConvertidas).toBe(1)
    expect(body.duplicadosRemovidos).toBe(1)
    expect(body.erros).toEqual([{ linha: 7, motivo: 'linha 7: falta Nº Chamado' }])
    expect(body.preview[0].identificador).toBe('CH-1')
    expect(typeof body.arquivoBase64).toBe('string')
    expect(body.arquivoBase64.length).toBeGreaterThan(0)
  })

  it('returns 422 when the expected DPSP sheet is missing (wrong cliente selected)', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('CHAMADOS') // this is the D1000 sheet name, not DPSP's
    const response = await postFormData('DPSP', workbook)
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toMatch(/Aba .* não encontrada/)
  })

  it('applies D1000 filters (MANFAC + not ROSARIO) before mapping', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('CHAMADOS')
    sheet.addRow(['Codigo', 'Bandeira', 'Loja', 'Grupo Analista Atual', 'E', 'F', 'G', 'Descrição do Problema'])
    sheet.addRow(['D-1', 'TAMOIO', '180', 'EQUIPE MANFAC SP', '', '', '', 'Falha no ar'])
    sheet.addRow(['D-2', 'ROSARIO', '10', 'EQUIPE MANFAC SP', '', '', '', 'Outro problema'])
    sheet.addRow(['D-3', 'DROGASMIL', '611', 'EQUIPE TERCEIROS', '', '', '', 'Mais um'])
    const response = await postFormData('D1000', workbook)
    const body = await response.json()
    expect(body.linhasConvertidas).toBe(1)
    expect(body.preview[0].nomeLocalizacao).toBe('TMO-180')
  })

  it('returns 400 for an invalid cliente value', async () => {
    const response = await postFormData('OUTRO', buildDpspWorkbook())
    expect(response.status).toBe(400)
  })
})
