import { EXCEL, linhasParaExcel, nomeArquivoExcel, rodapeDa, dataExcel } from '../colunas'
import type { AbastLinha, KmLinha, MotLinha, VeicLinha } from '../tipos'

const ab: AbastLinha = {
  id: '1', data: '2026-10-10', placa: 'AAA1A11', modelo: 'Uno', equipe: 'EQ-A', motorista: 'João', litros: 40, valor: 240,
  preco: 6, km: 900, posto: 'Shell', criado: '2026-10-10T13:00:00Z', corrigido: true, contexto: null,
}

describe('planilha', () => {
  it('cabeçalhos iguais aos do mockup aprovado', () => {
    expect(EXCEL.abast.colunas.map((c) => c.t)).toEqual([
      'Data', 'Placa', 'Modelo', 'Equipe no dia', 'Motorista no dia', 'Litros', 'Valor (R$)', 'Preço por litro (R$)',
      'KM no painel', 'Posto', 'Lançado em', 'Corrigido? (sim/não)',
    ])
    expect(EXCEL.km.colunas.map((c) => c.t)).toEqual([
      'Data', 'Equipe', 'Placa', 'Motorista', 'KM informado', 'KM rodado desde o lançamento anterior', 'Observações', 'Lançado em',
    ])
    expect(EXCEL.mot.colunas.map((c) => c.t)).toEqual([
      'Nome', 'Equipe atual', 'CNH', 'Vencimento da CNH', 'Situação da CNH (em dia / vence em até 60 dias / vencida)', 'Contato', 'Ativo (sim/não)',
    ])
    expect(EXCEL.veic.colunas.map((c) => c.t)).toEqual([
      'Placa', 'Modelo', 'Ano', 'Situação (em uso / livre / na oficina / fora da frota)', 'Equipe atual', 'Motorista atual', 'KM atual',
      'KM rodado no mês', 'Franquia de KM/mês', 'Valor da locação mensal (R$)', 'Previsão de volta da oficina', 'Carro substituto',
    ])
  })
  it('abastecimento: números como número, data como Date, sim/não', () => {
    const [linha] = linhasParaExcel('abast', [ab])
    expect(linha[0]).toEqual(new Date(Date.UTC(2026, 9, 10)))
    expect(linha[5]).toBe(40)
    expect(linha[6]).toBe(240)
    expect(linha[10]).toEqual(new Date(Date.UTC(2026, 9, 10, 10, 0))) // 13:00Z = 10:00 em SP
    expect(linha[11]).toBe('sim')
    expect(linha).toHaveLength(EXCEL.abast.colunas.length)
  })
  it('km e motorista/veículo geram uma célula por coluna', () => {
    const km: KmLinha = { id: 'k', data: '2026-10-01', equipe: 'EQ', placa: 'P', motorista: null, km: 10, rodado: null, obs: null, criado: '2026-10-01T10:00:00Z', era: null, veiculoKmAtual: 1, contexto: null }
    const m: MotLinha = { id: 'm', nome: 'A', equipe: null, cnh: null, cnhVenc: '2026-10-01', cnhClasse: 'vencida', cnhDias: -5, contato: null, ativo: false }
    const v: VeicLinha = { id: 'v', placa: 'P', modelo: 'M', ano: null, sit: 'oficina', equipe: null, motorista: null, km: 1, kmMes: null, franquia: null, locacao: 10, retorno: '2026-11-05', substituto: null, historico: [], ultimosKm: [], ultimosAbast: [] }
    expect(linhasParaExcel('km', [km])[0]).toHaveLength(8)
    expect(linhasParaExcel('mot', [m])[0]).toEqual(['A', null, null, new Date(Date.UTC(2026, 9, 1)), 'vencida', null, 'não'])
    expect(linhasParaExcel('veic', [v])[0][3]).toBe('na oficina')
    expect(linhasParaExcel('veic', [v])[0][10]).toEqual(new Date(Date.UTC(2026, 10, 5)))
  })
  it('nome do arquivo', () => {
    expect(nomeArquivoExcel('abast', '2026-10-30')).toBe('frotas-abastecimentos-2026-10-30.xlsx')
    expect(nomeArquivoExcel('km', '2026-10-30')).toBe('frotas-km-diario-2026-10-30.xlsx')
    expect(nomeArquivoExcel('mot', '2026-10-30')).toBe('frotas-motoristas-2026-10-30.xlsx')
    expect(nomeArquivoExcel('veic', '2026-10-30')).toBe('frotas-veiculos-2026-10-30.xlsx')
  })
  it('dataExcel rejeita lixo', () => {
    expect(dataExcel(null)).toBeNull()
    expect(dataExcel('x')).toBeNull()
  })
})

describe('rodapé', () => {
  it('abastecimentos: soma litros, valor e preço médio ponderado', () => {
    const r = rodapeDa('abast', [ab, { ...ab, id: '2', litros: 10, valor: 80 }])
    expect(r.resumo).toBe('2 abastecimentos no filtro')
    expect(r.colunas.litros).toBe('50,0')
    expect(r.colunas.valor).toBe('R$ 320,00')
    expect(r.colunas.preco).toBe('6,4')
  })
  it('singular e vazio', () => {
    expect(rodapeDa('abast', [ab]).resumo).toBe('1 abastecimento no filtro')
    expect(rodapeDa('abast', []).colunas.preco).toBe('—')
  })
})
