/**
 * @jest-environment node
 *
 * Leitura do .csv da Veloe. Fixture anonimizada gerada das amostras reais de
 * 27/10/2026 (nomes, CPF/CNPJ, tags, placas e IDs trocados por fictícios).
 */
import fs from 'node:fs'
import path from 'node:path'
import { lerVeloe } from '../veloe'
import { ErroExtrato } from '../tipos'

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'veloe-anonimizado.csv'))
const CABECALHO = FIXTURE.toString('latin1').split(/\r?\n/)[0]
const LINHA_OK = FIXTURE.toString('latin1').split(/\r?\n/)[1]

function csv(...linhas: string[]) {
  return Buffer.from(linhas.join('\r\n') + '\r\n', 'latin1')
}
function trocaCampo(linha: string, nomeColuna: string, valor: string) {
  const i = CABECALHO.split(';').indexOf(nomeColuna)
  const c = linha.split(';')
  c[i] = valor
  return c.join(';')
}

describe('lerVeloe — fixture anonimizada', () => {
  const linhas = lerVeloe(FIXTURE)

  it('lê as 6 transações', () => {
    expect(linhas).toHaveLength(6)
  })

  it('REENVIO DENTRO SLA é cobrança real, não duplicata', () => {
    const reenvio = linhas.find((l) => l.servico === 'REENVIO DENTRO SLA')
    expect(reenvio).toEqual({
      codigo_transacao: '2500000001',
      data_uso: '2026-10-27',
      hora_uso: '06:11:43',
      identificador: '1000000001',
      placa: 'TST0A00',
      valor: '2.71',
      servico: 'REENVIO DENTRO SLA',
      tipo_movimento: 'Debito',
      litros: null,
      valor_litro: null,
      hodometro: null,
      estabelecimento: 'ESTABELECIMENTO TESTE 1',
      cidade: null,
    })
  })

  it('estadia: valor inteiro "22" vira 22.00 e a data/hora são as de ENTRADA', () => {
    const estadia = linhas.find((l) => l.servico === 'Estadia Dentro SLA')!
    expect(estadia.valor).toBe('22.00')
    expect(estadia.data_uso).toBe('2026-10-27')
    expect(estadia.hora_uso).toBe('13:38:19') // não a de fim (13:59:19) nem a de processamento
  })

  it('usa a data de UTILIZAÇÃO, não a de processamento', () => {
    const l = linhas.find((x) => x.codigo_transacao === '2500000004')!
    expect(l.data_uso).toBe('2026-10-16') // processada em 17/10
    expect(l.valor).toBe('30.60')
    expect(linhas.find((x) => x.codigo_transacao === '2500000003')!.data_uso).toBe('2026-10-22') // processada em 23/10
  })

  it('tag repetida aparece em mais de uma transação', () => {
    expect(linhas.filter((l) => l.identificador === '1000000001')).toHaveLength(2)
  })

  it('nunca devolve nome de motorista nem CPF/CNPJ', () => {
    const tudo = JSON.stringify(linhas)
    expect(tudo).not.toMatch(/MOTORISTA/)
    expect(tudo).not.toMatch(/E\+13/)
    expect(tudo).not.toMatch(/EMPRESA TESTE/)
  })
})

describe('lerVeloe — formato', () => {
  it('aceita UTF-8 com BOM e cabeçalho acentuado', () => {
    const cab = CABECALHO.replace('Data de Utilizacao', 'Data de Utilização').replace('ID Transacao;', 'ID Transação;')
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`${cab}\n${LINHA_OK}\n`, 'utf8')])
    expect(lerVeloe(buf)).toHaveLength(1)
  })

  it('valor com milhar "1.234,56" vira 1234.56', () => {
    expect(lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'Valor Cobrado', '1.234,56')))[0].valor).toBe('1234.56')
  })

  it('ignora linhas em branco no fim', () => {
    expect(lerVeloe(Buffer.from(`${CABECALHO}\r\n${LINHA_OK}\r\n\r\n;;;\r\n`, 'latin1'))).toHaveLength(1)
  })

  it('repetição idêntica no mesmo arquivo conta uma vez só', () => {
    expect(lerVeloe(csv(CABECALHO, LINHA_OK, LINHA_OK))).toHaveLength(1)
  })
})

describe('lerVeloe — erros claros', () => {
  it('falta coluna obrigatória', () => {
    const cab = CABECALHO.replace('VeloeTag', 'Tag')
    expect(() => lerVeloe(csv(cab, LINHA_OK))).toThrow(ErroExtrato)
    expect(() => lerVeloe(csv(cab, LINHA_OK))).toThrow(/VeloeTag/)
  })

  it('arquivo vazio ou só cabeçalho', () => {
    expect(() => lerVeloe(Buffer.from(''))).toThrow(/vazio/)
    expect(() => lerVeloe(csv(CABECALHO))).toThrow(/nenhuma transação/)
  })

  it('arquivo de outra plataforma (cabeçalho da Ticketlog)', () => {
    expect(() => lerVeloe(csv('CODIGO TRANSACAO;DATA TRANSACAO;NUMERO CARTAO', '1;2;3'))).toThrow(/Veloe/)
  })

  it('linha com número de colunas diferente do cabeçalho', () => {
    expect(() => lerVeloe(csv(CABECALHO, LINHA_OK + ';extra'))).toThrow(/Linha 2/)
  })

  it('tipo de movimento diferente de Débito (ex.: crédito/estorno) não é aceito', () => {
    expect(() => lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'Tipo do Movimento', 'Credito')))).toThrow(/Credito/)
  })

  it('valor negativo, com 3 casas, vazio ou ambíguo', () => {
    expect(() => lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'Valor Cobrado', '-2,71')))).toThrow(/Linha 2/)
    expect(() => lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'Valor Cobrado', '2,715')))).toThrow(/casas/)
    expect(() => lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'Valor Cobrado', '')))).toThrow(/Valor Cobrado/)
    expect(() => lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'Valor Cobrado', '2.71')))).toThrow(/Valor Cobrado/)
  })

  it('data ou hora inválida', () => {
    expect(() => lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'Data de Utilizacao', '31/02/2026')))).toThrow(/Data de Utiliza/)
    expect(() => lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'Hora de Untrada', '25:00:00')))).toThrow(/Hora/)
  })

  it('tag ou ID estragado pelo Excel (notação científica)', () => {
    expect(() => lerVeloe(csv(CABECALHO, trocaCampo(LINHA_OK, 'VeloeTag', '1,00E+09')))).toThrow(/VeloeTag/)
  })

  it('mesmo ID com conteúdo diferente no arquivo', () => {
    const outra = trocaCampo(LINHA_OK, 'Valor Cobrado', '9,99')
    expect(() => lerVeloe(csv(CABECALHO, LINHA_OK, outra))).toThrow(/2500000001/)
  })
})
