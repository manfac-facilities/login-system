/**
 * @jest-environment node
 *
 * Leitura do .xlsx da Ticketlog. Fixture anonimizada gerada da amostra real
 * de 27/10/2026 (39 colunas; nomes, matrícula, cartões, placa e códigos
 * trocados por fictícios). Casos de erro montados aqui com exceljs.
 */
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { lerTicketlog } from '../ticketlog'
import { ErroExtrato } from '../tipos'

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'ticketlog-anonimizado.xlsx'))

const CAB = ['CODIGO TRANSACAO', 'DATA TRANSACAO', 'NOME MOTORISTA', 'NUMERO CARTAO', 'VALOR EMISSAO', 'SERVICO',
  'LITROS', 'VL/LITRO', 'HODOMETRO OU HORIMETRO', 'NOME ESTABELECIMENTO', 'CIDADE', 'PLACA']
const LINHA: unknown[] = [111, new Date(Date.UTC(2026, 9, 5, 14, 3, 9)), 'FULANO - EQUIPE 1', '6000000000000009', 50.5,
  'Abastecimento', 10.123, 4.989, 1234, 'POSTO X', 'RIO DE JANEIRO', 'ZZZ9Z99']

async function xlsx(linhas: unknown[][], aba = 'Transações'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(aba)
  for (const l of linhas) ws.addRow(l)
  return Buffer.from(await wb.xlsx.writeBuffer())
}
function com(i: number, valor: unknown) {
  const l = [...LINHA]
  l[i] = valor
  return l
}

describe('lerTicketlog — fixture anonimizada', () => {
  it('lê as 5 transações, com o cartão repetido em 2', async () => {
    const linhas = await lerTicketlog(FIXTURE)
    expect(linhas).toHaveLength(5)
    expect(linhas.filter((l) => l.identificador === '6000000000000001')).toHaveLength(2)
    expect(new Set(linhas.map((l) => l.identificador)).size).toBe(4)
  })

  it('primeira linha: data/hora de uso, valor e campos de tela; sem placa nem motorista', async () => {
    const [l] = await lerTicketlog(FIXTURE)
    expect(l).toEqual({
      codigo_transacao: '900000001',
      data_uso: '2026-10-01',
      hora_uso: '05:17:44',
      identificador: '6000000000000001',
      placa: null,
      valor: '69.99',
      servico: 'Abastecimento',
      tipo_movimento: null,
      litros: '13.230',
      valor_litro: '5.2900',
      hodometro: '39115.0',
      estabelecimento: 'POSTO TESTE 1',
      cidade: 'CASIMIRO DE ABREU',
    })
  })

  it('valor inteiro 140 vira "140.00"', async () => {
    const linhas = await lerTicketlog(FIXTURE)
    expect(linhas.find((l) => l.codigo_transacao === '900000002')!.valor).toBe('140.00')
  })

  it('nunca devolve nome de motorista, matrícula nem placa', async () => {
    const tudo = JSON.stringify(await lerTicketlog(FIXTURE))
    expect(tudo).not.toMatch(/MOTORISTA|RESPONSAVEL|AAA0A00/)
  })
})

describe('lerTicketlog — formatos de célula', () => {
  it('cabeçalho em outra ordem e com acento/caixa diferentes', async () => {
    const cab = CAB.map((c) => (c === 'CODIGO TRANSACAO' ? 'Código Transação' : c))
    const [l] = await lerTicketlog(await xlsx([cab, LINHA]))
    expect(l.codigo_transacao).toBe('111')
    expect(l.data_uso).toBe('2026-10-05')
    expect(l.hora_uso).toBe('14:03:09')
    expect(l.litros).toBe('10.123')
    expect(l.valor_litro).toBe('4.9890')
  })

  it('data como texto "05/10/2026 14:03:09" e valor como texto "50,50"', async () => {
    const [l] = await lerTicketlog(await xlsx([CAB, com(4, '50,50').map((v, i) => (i === 1 ? '05/10/2026 14:03:09' : v))]))
    expect(l.data_uso).toBe('2026-10-05')
    expect(l.hora_uso).toBe('14:03:09')
    expect(l.valor).toBe('50.50')
  })

  it('cartão gravado como número pelo Excel', async () => {
    const [l] = await lerTicketlog(await xlsx([CAB, com(3, 6035740454231900)]))
    expect(l.identificador).toBe('6035740454231900')
  })

  it('linhas vazias no fim são ignoradas', async () => {
    expect(await lerTicketlog(await xlsx([CAB, LINHA, [], [null, null]]))).toHaveLength(1)
  })
})

describe('lerTicketlog — erros claros', () => {
  it('não é .xlsx', async () => {
    await expect(lerTicketlog(Buffer.from('ID Transacao;Placa\n1;2'))).rejects.toThrow(/\.xlsx/)
  })

  it('sem a aba "Transações" (lista as abas que existem)', async () => {
    await expect(lerTicketlog(await xlsx([CAB, LINHA], 'Planilha1'))).rejects.toThrow(/Transações.*Planilha1/)
  })

  it('falta coluna obrigatória', async () => {
    const cab = CAB.map((c) => (c === 'NUMERO CARTAO' ? 'CARTAO' : c))
    await expect(lerTicketlog(await xlsx([cab, LINHA]))).rejects.toThrow(ErroExtrato)
    await expect(lerTicketlog(await xlsx([cab, LINHA]))).rejects.toThrow(/NUMERO CARTAO/)
  })

  it('só cabeçalho', async () => {
    await expect(lerTicketlog(await xlsx([CAB]))).rejects.toThrow(/nenhuma transação/)
  })

  it('valor negativo, com 3 casas ou vazio', async () => {
    await expect(lerTicketlog(await xlsx([CAB, com(4, -50)]))).rejects.toThrow(/Linha 2/)
    await expect(lerTicketlog(await xlsx([CAB, com(4, 50.505)]))).rejects.toThrow(/casas/)
    await expect(lerTicketlog(await xlsx([CAB, com(4, null)]))).rejects.toThrow(/VALOR EMISSAO/)
  })

  it('data inválida', async () => {
    await expect(lerTicketlog(await xlsx([CAB, com(1, 'ontem')]))).rejects.toThrow(/DATA TRANSACAO/)
  })

  it('linha com dados mas sem código de transação', async () => {
    await expect(lerTicketlog(await xlsx([CAB, com(0, null)]))).rejects.toThrow(/CODIGO TRANSACAO/)
  })

  it('cartão em notação científica / com letras', async () => {
    await expect(lerTicketlog(await xlsx([CAB, com(3, '6,03E+15')]))).rejects.toThrow(/NUMERO CARTAO/)
  })

  it('mesmo código com dados diferentes', async () => {
    await expect(lerTicketlog(await xlsx([CAB, LINHA, com(4, 99)]))).rejects.toThrow(/111/)
  })

  it('mesmo código com dados idênticos conta uma vez', async () => {
    expect(await lerTicketlog(await xlsx([CAB, LINHA, LINHA]))).toHaveLength(1)
  })
})
