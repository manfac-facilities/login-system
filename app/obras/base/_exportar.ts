/**
 * Exportar a Base de obras para Excel.
 *
 * Exporta a lista que está na tela — os mesmos filtros e a mesma ordenação —
 * com as colunas da tabela primeiro e, depois, os campos da ficha que ajudam
 * quem trabalha a planilha (cronograma, pendência, faturamento, cancelamento).
 *
 * Os textos são os das etiquetas (`_etiquetas.tsx`), para a planilha dizer o
 * mesmo que a tela. Número sai como número e data como data do Excel, para dar
 * para somar, ordenar e filtrar lá.
 *
 * O exceljs é importado só no clique: é pesado e a maioria das visitas à Base
 * não exporta nada.
 */

import {
  dataSP,
  liberada,
  nomeEtapa,
  posCampo,
  prazoTxt,
  semCobertura,
  travado,
  encerrada,
  SEM_BLOQUEIO,
  type Obra,
} from '../_lib/tipos'
import { temAlertaDeAusenciaField } from './_regras'

export type Celula = string | number | Date | null

export type ColunaExcel = {
  t: string
  largura: number
  /** Formato de número do Excel; sem ele a célula fica no formato geral. */
  fmt?: string
  v: (o: Obra) => Celula
}

const FMT_DATA = 'dd/mm/yyyy'
const FMT_MOEDA = '"R$" #,##0.00'

const texto = (s: string | null | undefined): string | null => (s && s.trim() ? s : null)

/**
 * `AAAA-MM-DD` ou timestamp → Date à meia-noite UTC. O exceljs grava a data
 * pelo UTC: meia-noite local no Brasil viraria o dia anterior na planilha.
 */
function data(s: string | null | undefined): Date | null {
  const iso = s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : dataSP(s)
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

function etapa(o: Obra): string {
  if (o.etapa !== 'cancelado') return nomeEtapa(o.etapa)
  const quem = o.cancelado_por === 'cliente' ? 'Cliente' : o.cancelado_por === 'manfac' ? 'Manfac' : null
  return quem ? `${nomeEtapa('cancelado')} · ${quem}` : nomeEtapa('cancelado')
}

function cobertura(o: Obra): string | null {
  if (semCobertura(o)) return 'Sem cobertura'
  if (!o.os_aprovada && liberada(o)) return `Liberado por ${o.liberado_por}`
  return null
}

function bloqueio(o: Obra): string | null {
  if (!o.bloqueio || o.bloqueio === SEM_BLOQUEIO || posCampo(o)) return null
  return travado(o) ? `${o.bloqueio} (${o.bloqueada_dias} dias)` : o.bloqueio
}

/** As colunas da tabela da tela (`COLS`), na mesma ordem, e depois os campos da ficha. */
export const COLUNAS_EXCEL: ColunaExcel[] = [
  { t: 'Nº OS', largura: 14, v: (o) => texto(o.os) },
  { t: 'Loja', largura: 28, v: (o) => texto(o.loja) },
  { t: 'Cliente', largura: 10, v: (o) => texto(o.cliente) },
  { t: 'Tipo', largura: 14, v: (o) => texto(o.tipo) },
  { t: 'Descrição', largura: 40, v: (o) => texto(o.descricao) },
  { t: 'Responsável', largura: 14, v: (o) => texto(o.pcm) ?? 'a definir' },
  { t: 'Equipe / prestador', largura: 18, v: (o) => texto(o.equipe) },
  { t: 'Analista do cliente', largura: 16, v: (o) => texto(o.analista_cliente) },
  { t: 'Etapa da obra', largura: 30, v: etapa },
  { t: 'Mau uso', largura: 9, v: (o) => (o.mau_uso ? 'Sim' : 'Não') },
  { t: 'Fora do Field', largura: 12, v: (o) => (temAlertaDeAusenciaField(o) ? 'Sim' : 'Não') },
  { t: 'Prioridade', largura: 11, v: (o) => texto(o.prioridade) },
  { t: 'Com quem está', largura: 24, v: (o) => texto(o.dono) },
  { t: 'Parada nesta etapa (dias)', largura: 12, v: (o) => (encerrada(o) ? null : o.paradaEtapa) },
  { t: 'OS do cliente', largura: 16, v: (o) => (o.os_aprovada ? 'OS aprovada' : 'sem OS aprovada') },
  { t: 'Cobertura', largura: 22, v: cobertura },
  { t: 'Liberado em', largura: 12, fmt: FMT_DATA, v: (o) => data(o.liberado_em) },
  { t: 'Bloqueio', largura: 22, v: bloqueio },
  { t: 'Dias em aberto', largura: 10, v: (o) => o.diasAlerta },
  {
    t: 'Prazo consumido',
    largura: 18,
    v: (o) => (o.diaDe === null || o.fracPrazo === null ? 'sem prazo definido' : prazoTxt(o)),
  },
  { t: 'Valor (R$)', largura: 14, fmt: FMT_MOEDA, v: (o) => o.valor },
  { t: 'Aprovação', largura: 12, fmt: FMT_DATA, v: (o) => data(o.aprovacao) },
  { t: 'Início planejado', largura: 12, fmt: FMT_DATA, v: (o) => data(o.inicio_plan) },
  { t: 'Início real', largura: 12, fmt: FMT_DATA, v: (o) => data(o.inicio_real) },
  { t: 'Duração planejada (dias)', largura: 11, v: (o) => o.duracao },
  { t: 'Fim previsto', largura: 12, fmt: FMT_DATA, v: (o) => data(o.fimCalc) },
  { t: 'Fim real', largura: 12, fmt: FMT_DATA, v: (o) => data(o.fim_real) },
  { t: 'Atraso (dias)', largura: 9, v: (o) => o.atraso },
  { t: 'Pendência', largura: 30, v: (o) => texto(o.pendencia) },
  { t: 'Responsável pela pendência', largura: 16, v: (o) => texto(o.pend_resp) },
  { t: 'Prazo da pendência', largura: 12, fmt: FMT_DATA, v: (o) => data(o.pend_prazo) },
  { t: 'Próxima ação', largura: 30, v: (o) => texto(o.prox_acao) },
  { t: 'NFS-e', largura: 12, v: (o) => texto(o.fat_nfse) },
  { t: 'Pedido de compra', largura: 14, v: (o) => texto(o.fat_pedido) },
  { t: 'Folhas', largura: 12, v: (o) => texto(o.fat_folhas) },
  { t: 'Faturada em', largura: 12, fmt: FMT_DATA, v: (o) => data(o.marco_faturou) },
  { t: 'Cancelada em', largura: 12, fmt: FMT_DATA, v: (o) => data(o.cancelado_em) },
  { t: 'Motivo do cancelamento', largura: 30, v: (o) => texto(o.cancelado_obs) },
  { t: 'Última atualização', largura: 12, fmt: FMT_DATA, v: (o) => data(o.atualizacao) },
]

/** Uma linha por obra, na ordem recebida, uma célula por coluna de `COLUNAS_EXCEL`. */
export function linhasParaExcel(obras: Obra[]): Celula[][] {
  return obras.map((o) => COLUNAS_EXCEL.map((c) => c.v(o)))
}

export function nomeArquivoExcel(hoje: string): string {
  return `obras-${hoje}.xlsx`
}

/** O `.xlsx` pronto: cabeçalho em negrito e congelado, autofiltro, larguras e formatos. */
export async function gerarPlanilhaObras(obras: Obra[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Obras', { views: [{ state: 'frozen', ySplit: 1 }] })

  ws.columns = COLUNAS_EXCEL.map((c) => ({ header: c.t, width: c.largura, style: c.fmt ? { numFmt: c.fmt } : {} }))
  ws.addRows(linhasParaExcel(obras))

  const cab = ws.getRow(1)
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2050' } }
  cab.alignment = { vertical: 'middle', wrapText: true }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS_EXCEL.length } }

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

/** Gera e baixa o arquivo no navegador. */
export async function baixarExcelObras(obras: Obra[], hoje: string): Promise<void> {
  const buf = await gerarPlanilhaObras(obras)
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivoExcel(hoje)
  a.click()
  URL.revokeObjectURL(url)
}
