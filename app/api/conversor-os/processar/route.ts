import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import {
  localizarAba,
  localizarLinhaCabecalho,
  extrairLinhasBrutas,
  gerarWorkbookFieldControl,
} from '@/lib/conversor-os/planilha'
import { converterLinhas } from '@/lib/conversor-os/converter'
import { mapearLinhaDPSP } from '@/lib/conversor-os/dpsp'
import { filtrarLinhaD1000, mapearLinhaD1000 } from '@/lib/conversor-os/d1000'
import { gerarNomeArquivo } from '@/lib/conversor-os/nomeArquivo'
import type { Cliente, ConversaoResultado } from '@/lib/conversor-os/types'

function processarDPSP(workbook: ExcelJS.Workbook): ConversaoResultado | { erroEstrutura: string } {
  // Excel trunca nomes de aba em 31 caracteres — o nome real da aba do
  // relatório DPSP ("Extrato do CICLO OS Corretiva+Prev - JG") já chega
  // truncado no arquivo do cliente. Confirmado lendo o arquivo de exemplo.
  const aba = localizarAba(workbook, 'Extrato do CICLO OS Corretiva+P')
  if (!aba)
    return {
      erroEstrutura:
        'Aba "Extrato do CICLO OS Corretiva+P" não encontrada — confira se selecionou o cliente certo',
    }
  const linhaCabecalho = localizarLinhaCabecalho(aba, 1, 'Nº Chamado')
  if (!linhaCabecalho)
    return { erroEstrutura: 'Coluna "Nº Chamado" não encontrada — confira se selecionou o cliente certo' }
  const linhas = extrairLinhasBrutas(aba, linhaCabecalho + 1)
  return converterLinhas(linhas, mapearLinhaDPSP)
}

function processarD1000(workbook: ExcelJS.Workbook): ConversaoResultado | { erroEstrutura: string } {
  const aba = localizarAba(workbook, 'CHAMADOS')
  if (!aba)
    return { erroEstrutura: 'Aba "CHAMADOS" não encontrada — confira se selecionou o cliente certo' }
  const linhas = extrairLinhasBrutas(aba, 2)
  return converterLinhas(linhas, mapearLinhaD1000, filtrarLinhaD1000)
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const cliente = formData.get('cliente') as string | null
  const arquivo = formData.get('arquivo') as File | null

  if (cliente !== 'DPSP' && cliente !== 'D1000')
    return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
  if (!arquivo) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o arquivo .xlsx' }, { status: 422 })
  }

  const clienteTipado = cliente as Cliente
  const resultado = clienteTipado === 'DPSP' ? processarDPSP(workbook) : processarD1000(workbook)

  if ('erroEstrutura' in resultado)
    return NextResponse.json({ error: resultado.erroEstrutura }, { status: 422 })

  const workbookSaida = gerarWorkbookFieldControl(resultado.rows)
  const bufferSaida = await workbookSaida.xlsx.writeBuffer()
  const filename = gerarNomeArquivo(clienteTipado, new Date())

  return NextResponse.json({
    cliente: clienteTipado,
    filename,
    linhasOrigem: resultado.linhasOrigem,
    linhasConvertidas: resultado.linhasConvertidas,
    duplicadosRemovidos: resultado.duplicadosRemovidos,
    erros: resultado.erros,
    preview: resultado.rows.slice(0, 20),
    arquivoBase64: Buffer.from(bufferSaida).toString('base64'),
  })
}
