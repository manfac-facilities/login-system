import {
  MAX_LINHAS,
  contar,
  lerCsv,
  lerData,
  lerKm,
  lerValor,
  linhasParaGravar,
  mapeamentoValido,
  normalizarPlaca,
  sugerirMapeamento,
  validarLinhas,
  type ContextoImportacao,
} from '../revisaoImportacao'

const HOJE = '2026-11-03'

// Mesmos dados do mockup aprovado (SHEET e VEIC/REV de exemplo).
const SHEET = [
  ['PCX0Q74', '4.980', '2026-09-10', 'Auto Center Beta', 'Primeira revisão'],
  ['KPN7J18', '9.980', '2026-10-11', 'Oficina Prime Car', ''],
  ['ZZZ9Z99', '15.000', '2026-08-02', 'Mecânica Rota 40', ''],
  ['MRT6M41', 'dez mil', '2026-07-22', 'Auto Center Beta', ''],
  ['FKR2B41', '30.050', '2026-06-20', 'Concessionária Norte', 'Troca de correia'],
  ['GHT1D63', '79.900', '2026-10-30', 'Mecânica Rota 40', 'Digitado errado?'],
  ['JLM2G96', '20.350', '2026-09-01', 'Auto Center Beta', ''],
  ['LQS8L30', '52.000', '2027-01-05', 'Oficina Prime Car', ''],
  ['FKR3C52', '40.200', '2026-03-14', 'Oficina Prime Car', ''],
  ['KPN4H07', '30.080', '2026-05-02', 'Oficina da locadora', ''],
]
const veic = (id: string, placa: string, km: number) => ({ id, placa, km_atual: km, intervalo_revisao_km: null })
const CTX: ContextoImportacao = {
  hoje: HOJE,
  veiculos: [
    veic('pcx', 'PCX0Q74', 5200), veic('kpn7', 'KPN7J18', 12560), veic('mrt6', 'MRT6M41', 18300),
    veic('fkr2', 'FKR2B41', 41230), veic('ght1', 'GHT1D63', 69640), veic('jlm2', 'JLM2G96', 24400),
    veic('lqs8', 'LQS8L30', 71700), veic('fkr3', 'FKR3C52', 59320), veic('kpn4', 'KPN4H07', 49100),
  ],
  existentes: [
    { veiculo_id: 'kpn7', km_realizada: 9980 },
    { veiculo_id: 'fkr2', km_realizada: 40120 }, { veiculo_id: 'fkr2', km_realizada: 30120 },
    { veiculo_id: 'jlm2', km_realizada: 20350 }, { veiculo_id: 'jlm2', km_realizada: 10350 },
    { veiculo_id: 'fkr3', km_realizada: 50410 }, { veiculo_id: 'fkr3', km_realizada: 40410 },
  ],
}
const MAPA = sugerirMapeamento(['Placa do carro', 'KM', 'Data feita', 'Oficina', 'Obs.'])

describe('sugerirMapeamento / mapeamentoValido', () => {
  it('sugere pelos cabeçalhos do mockup', () => {
    expect(MAPA).toEqual(['placa', 'km', 'data', 'oficina', 'obs'])
  })
  it('reconhece fornecedor, valor, peças; o resto é ignorado; cada campo uma vez', () => {
    expect(sugerirMapeamento(['Fornecedor', 'Valor (R$)', 'Peças trocadas', 'Motorista', 'Placa', 'placa 2'])).toEqual([
      'oficina', 'valor', 'pecas', 'ign', 'placa', 'ign',
    ])
  })
  it('sem Data → inválido; com repetição → inválido', () => {
    expect(mapeamentoValido(['placa', 'km', 'oficina'])).toBe(false)
    expect(mapeamentoValido(['placa', 'km', 'data', 'ign', 'ign'])).toBe(true)
    expect(mapeamentoValido(['placa', 'km', 'data', 'km'])).toBe(false)
  })
})

describe('leitores de valor', () => {
  it('placa', () => {
    expect(normalizarPlaca(' abc-1d23 ')).toBe('ABC1D23')
  })
  it('KM', () => {
    expect(lerKm('30.050')).toBe(30050)
    expect(lerKm('30050')).toBe(30050)
    expect(lerKm('30050,0')).toBe(30050)
    expect(lerKm(30050)).toBe(30050)
    expect(lerKm('dez mil')).toBeNull()
    expect(lerKm('')).toBeNull()
    expect(lerKm(-5)).toBeNull()
  })
  it('data', () => {
    expect(lerData('20/06/2026')).toBe('2026-06-20')
    expect(lerData('2026-06-20')).toBe('2026-06-20')
    expect(lerData(new Date(Date.UTC(2026, 5, 20)))).toBe('2026-06-20')
    expect(lerData('31/02/2026')).toBeNull()
    expect(lerData('ontem')).toBeNull()
  })
  it('valor', () => {
    expect(lerValor('1.234,56')).toBe(1234.56)
    expect(lerValor('R$ 380,00')).toBe(380)
    expect(lerValor(980.5)).toBe(980.5)
    expect(lerValor('')).toBeNull()
  })
})

describe('lerCsv', () => {
  it('separador ; com aspas', () => {
    expect(lerCsv('Placa;KM;Obs\n"ABC1D23";"30.050";"troca; óleo ""5W30"""\n')).toEqual([
      ['Placa', 'KM', 'Obs'],
      ['ABC1D23', '30.050', 'troca; óleo "5W30"'],
    ])
  })
  it('separador , e BOM', () => {
    expect(lerCsv('﻿Placa,KM\r\nABC1D23,"30050,0"\r\n')).toEqual([['Placa', 'KM'], ['ABC1D23', '30050,0']])
  })
})

describe('validarLinhas', () => {
  const res = validarLinhas(SHEET, MAPA, CTX)

  it('dá os mesmos resultados do mockup', () => {
    expect(res.map((r) => [r.placa, r.resultado])).toEqual([
      ['PCX0Q74', 'ok'], ['KPN7J18', 'dup'], ['ZZZ9Z99', 'erro'], ['MRT6M41', 'erro'], ['FKR2B41', 'ok'],
      ['GHT1D63', 'aviso'], ['JLM2G96', 'dup'], ['LQS8L30', 'erro'], ['FKR3C52', 'ok'], ['KPN4H07', 'ok'],
    ])
    expect(contar(res)).toEqual({ ok: 4, aviso: 1, erro: 3, dup: 2 })
  })

  it('motivos com os textos da spec', () => {
    expect(res[2].motivo).toBe('Placa não cadastrada')
    expect(res[3].motivo).toBe('KM inválido ("dez mil")')
    expect(res[7].motivo).toBe('Data no futuro')
    expect(res[1].motivo).toBe('Já existe (mesma placa e KM): ignorada')
    expect(res[5].motivo).toBe('KM maior que o atual do carro (69.640): conferir')
    expect(res[0]).toMatchObject({ linha: 2, km: 4980, data: '2026-09-10', oficina: 'Auto Center Beta', obs: 'Primeira revisão', veiculo_id: 'pcx' })
  })

  it('data inválida', () => {
    expect(validarLinhas([['PCX0Q74', '100', '32/13/2026']], ['placa', 'km', 'data'], CTX)[0].motivo).toBe('Data inválida')
  })

  it('repetida dentro do arquivo → dup na segunda', () => {
    const r = validarLinhas([['PCX0Q74', '4000', '2026-01-01'], ['pcx-0q74', '4.000', '02/01/2026']], ['placa', 'km', 'data'], CTX)
    expect(r.map((x) => x.resultado)).toEqual(['ok', 'dup'])
  })

  it('linha toda vazia é pulada, mantendo o número da linha das outras', () => {
    const r = validarLinhas([['', '', ''], ['PCX0Q74', '4000', '2026-01-01']], ['placa', 'km', 'data'], CTX)
    expect(r).toHaveLength(1)
    expect(r[0].linha).toBe(3)
  })

  it('linhasParaGravar: aviso só se marcado', () => {
    expect(linhasParaGravar(res, false).map((r) => r.placa)).toEqual(['PCX0Q74', 'FKR2B41', 'FKR3C52', 'KPN4H07'])
    expect(linhasParaGravar(res, true)).toHaveLength(5)
  })

  it('limite de linhas', () => {
    expect(MAX_LINHAS).toBe(2000)
  })
})
