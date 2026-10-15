/**
 * @jest-environment node
 *
 * Exportar a Base de obras para Excel: as linhas que vão para a planilha e o
 * `.xlsx` gerado. Ambiente node porque o exceljs grava em Buffer.
 */
import ExcelJS from 'exceljs'
import { derivar, type ObraRow } from '../../_lib/tipos'
import { COLUNAS_EXCEL, gerarPlanilhaObras, linhasParaExcel, nomeArquivoExcel } from '../_exportar'

function linha(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: Math.random().toString(36).slice(2),
    os: '0226-000001',
    loja: 'DP TESTE',
    cliente: 'DPSP',
    descricao: 'Troca de piso',
    tipo: 'CIVIL',
    valor: 1234.5,
    origem: null,
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: 'LEANDRO',
    pcm: 'YURI',
    equipe: 'MANFAC-7',
    os_aprovada: true,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: 'Urgente',
    aprovacao: '2026-08-20',
    inicio_plan: '2026-08-21',
    inicio_real: null,
    duracao: 7,
    fim_real: null,
    desde_etapa: null,
    marco_exec_fim: null,
    marco_relatorio: null,
    marco_os_aprov: null,
    marco_fechou_os: null,
    marco_liberou_fat: null,
    marco_faturou: null,
    pendencia: null,
    pend_resp: null,
    pend_prazo: null,
    prox_acao: null,
    atualizacao: '2026-08-30',
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-08-20T00:00:00Z',
    updated_at: null,
    ...over,
  }
}

const HOJE = '2026-08-31'
const obra = (over: Partial<ObraRow> = {}) => derivar(linha(over), HOJE)

/** A célula da coluna de título `t` na linha exportada da obra. */
function celula(o: ReturnType<typeof obra>, t: string) {
  const i = COLUNAS_EXCEL.findIndex((c) => c.t === t)
  if (i < 0) throw new Error(`coluna inexistente: ${t}`)
  return linhasParaExcel([o])[0][i]
}

describe('colunas', () => {
  test('as colunas da tabela vêm primeiro, na mesma ordem da tela', () => {
    expect(COLUNAS_EXCEL.slice(0, 6).map((c) => c.t)).toEqual([
      'Nº OS',
      'Loja',
      'Cliente',
      'Tipo',
      'Descrição',
      'Responsável',
    ])
  })

  test('não há título repetido', () => {
    const t = COLUNAS_EXCEL.map((c) => c.t)
    expect(new Set(t).size).toBe(t.length)
  })
})

describe('linhasParaExcel', () => {
  test('uma linha por obra, na ordem recebida', () => {
    const linhas = linhasParaExcel([obra({ loja: 'B' }), obra({ loja: 'A' })])
    const iLoja = COLUNAS_EXCEL.findIndex((c) => c.t === 'Loja')
    expect(linhas.map((l) => l[iLoja])).toEqual(['B', 'A'])
  })

  test('textos simples e vazios', () => {
    const o = obra({ equipe: null })
    expect(celula(o, 'Nº OS')).toBe('0226-000001')
    expect(celula(o, 'Loja')).toBe('DP TESTE')
    expect(celula(o, 'Equipe / prestador')).toBeNull()
    expect(celula(o, 'Prioridade')).toBe('Urgente')
  })

  test('obra sem responsável sai "a definir", como na tela', () => {
    expect(celula(obra({ pcm: null }), 'Responsável')).toBe('a definir')
  })

  test('etapa pelo nome; cancelada diz quem cancelou', () => {
    expect(celula(obra(), 'Etapa da obra')).toBe('Em andamento')
    const c = obra({ etapa: 'cancelado', cancelado_por: 'cliente', cancelado_obs: 'Loja fechou', cancelado_em: '2026-08-30T12:00:00Z' })
    expect(celula(c, 'Etapa da obra')).toBe('Cancelada · Cliente')
    expect(celula(c, 'Motivo do cancelamento')).toBe('Loja fechou')
    expect(celula(c, 'Cancelada em')).toEqual(new Date(Date.UTC(2026, 7, 30)))
  })

  test('mau uso e ausência do Field viram Sim / Não', () => {
    expect(celula(obra({ mau_uso: true }), 'Mau uso')).toBe('Sim')
    expect(celula(obra(), 'Mau uso')).toBe('Não')
    expect(celula(obra({ field_ausente_em: '2026-08-29' }), 'Fora do Field')).toBe('Sim')
    expect(celula(obra(), 'Fora do Field')).toBe('Não')
  })

  test('OS e cobertura com os textos das etiquetas', () => {
    expect(celula(obra(), 'OS do cliente')).toBe('OS aprovada')
    expect(celula(obra(), 'Cobertura')).toBeNull()
    const lib = obra({ os_aprovada: false, liberado_por: 'CARLOS', liberado_em: '2026-08-25' })
    expect(celula(lib, 'OS do cliente')).toBe('sem OS aprovada')
    expect(celula(lib, 'Cobertura')).toBe('Liberado por CARLOS')
    expect(celula(lib, 'Liberado em')).toEqual(new Date(Date.UTC(2026, 7, 25)))
    expect(celula(obra({ os_aprovada: false, etapa: 'levantamento' }), 'Cobertura')).toBe('Sem cobertura')
  })

  test('bloqueio: "Sem bloqueio" fica vazio; travado mostra os dias', () => {
    expect(celula(obra(), 'Bloqueio')).toBeNull()
    expect(celula(obra({ bloqueio: 'Material', bloqueada_dias: 1 }), 'Bloqueio')).toBe('Material')
    expect(celula(obra({ bloqueio: 'Material', bloqueada_dias: 5 }), 'Bloqueio')).toBe('Material (5 dias)')
  })

  test('números saem como número, para somar e filtrar no Excel', () => {
    const o = obra()
    expect(celula(o, 'Dias em aberto')).toBe(o.diasAlerta)
    expect(typeof celula(o, 'Dias em aberto')).toBe('number')
    expect(celula(o, 'Valor (R$)')).toBe(1234.5)
    expect(celula(o, 'Duração planejada (dias)')).toBe(7)
    expect(celula(obra({ valor: null }), 'Valor (R$)')).toBeNull()
  })

  test('parada nesta etapa só depois de sair de campo', () => {
    expect(celula(obra(), 'Parada nesta etapa (dias)')).toBeNull()
    const f = obra({ etapa: 'fecharOS', desde_etapa: '2026-08-21' })
    expect(celula(f, 'Parada nesta etapa (dias)')).toBe(10)
  })

  test('prazo consumido com o texto da barra', () => {
    expect(celula(obra(), 'Prazo consumido')).toMatch(/^dia \d+ de 7$/)
    expect(celula(obra({ duracao: null }), 'Prazo consumido')).toBe('sem prazo definido')
  })

  test('datas saem como data do Excel (sem fuso), vazio como vazio', () => {
    const o = obra()
    expect(celula(o, 'Aprovação')).toEqual(new Date(Date.UTC(2026, 7, 20)))
    expect(celula(o, 'Última atualização')).toEqual(new Date(Date.UTC(2026, 7, 30)))
    expect(celula(o, 'Início real')).toBeNull()
  })

  test('faturamento', () => {
    const o = obra({ etapa: 'faturado', fat_nfse: '123', fat_pedido: 'PC-9', fat_folhas: '4500', marco_faturou: '2026-08-28' })
    expect(celula(o, 'NFS-e')).toBe('123')
    expect(celula(o, 'Pedido de compra')).toBe('PC-9')
    expect(celula(o, 'Folhas')).toBe('4500')
    expect(celula(o, 'Faturada em')).toEqual(new Date(Date.UTC(2026, 7, 28)))
  })
})

describe('gerarPlanilhaObras', () => {
  test('gera um .xlsx com cabeçalho, uma linha por obra e formatos', async () => {
    const buf = await gerarPlanilhaObras([obra({ loja: 'LOJA X' }), obra({ loja: 'LOJA Y' })])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.worksheets[0]

    expect(ws.name).toBe('Obras')
    expect(ws.rowCount).toBe(3)
    expect(ws.getRow(1).getCell(1).value).toBe('Nº OS')
    expect(ws.getRow(1).font?.bold).toBe(true)
    expect(ws.getRow(3).getCell(2).value).toBe('LOJA Y')
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(ws.autoFilter).toBeTruthy()

    const iData = COLUNAS_EXCEL.findIndex((c) => c.t === 'Aprovação') + 1
    expect(ws.getRow(2).getCell(iData).numFmt).toBe('dd/mm/yyyy')
  })
})

test('nome do arquivo leva a data', () => {
  expect(nomeArquivoExcel('2026-10-14')).toBe('obras-2026-10-14.xlsx')
})
