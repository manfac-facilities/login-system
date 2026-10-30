import {
  classeCnh, montarAbastecimentos, montarKm, montarMotoristas, montarVeiculos, rodadoPorLancamento,
  type EntradaMontagem,
} from '../montar'

const base = (): EntradaMontagem => ({
  hoje: '2026-10-30',
  equipes: [{ id: 'eA', codigo: 'EQ-A' }, { id: 'eB', codigo: 'EQ-B' }],
  motoristas: [
    { id: 'm1', nome: 'Zeca', cnh: '1', cnh_vencimento: '2026-10-01', contato: null, equipe_id: 'eA', ativo: true },
    { id: 'm2', nome: 'Ana', cnh: '2', cnh_vencimento: '2026-11-20', contato: '21', equipe_id: null, ativo: false },
    { id: 'm3', nome: 'Beto', cnh: '3', cnh_vencimento: '2027-05-01', contato: null, equipe_id: null, ativo: true },
  ],
  veiculos: [
    { id: 'v1', placa: 'AAA1A11', modelo: 'Uno', ano: 2022, km_atual: 1500, km_contratual_mensal: 3000, valor_locacao_mensal: 1000, status: 'ativo', equipe_id: 'eB', previsao_retorno_oficina: null, substituto_id: null },
    { id: 'v2', placa: 'BBB2B22', modelo: 'Gol', ano: null, km_atual: 10, km_contratual_mensal: null, valor_locacao_mensal: null, status: 'manutencao', equipe_id: null, previsao_retorno_oficina: '2026-11-05', substituto_id: 'v1' },
    { id: 'v3', placa: 'CCC3C33', modelo: 'Palio', ano: 2020, km_atual: 5, km_contratual_mensal: null, valor_locacao_mensal: null, status: 'ativo', equipe_id: null, previsao_retorno_oficina: null, substituto_id: null },
  ],
  responsabilidade: [
    { veiculo_id: 'v1', equipe_id: 'eA', motorista_id: 'm1', inicio: '2026-01-01', fim: '2026-09-15', created_at: '2026-01-01T00:00:00Z' },
    { veiculo_id: 'v1', equipe_id: 'eB', motorista_id: 'm2', inicio: '2026-09-15', fim: null, created_at: '2026-09-15T00:00:00Z' },
  ],
  abastecimentos: [
    { id: 'a1', veiculo_id: 'v1', data: '2026-08-10', litros: 40, valor: 240, km: 900, posto: 'Shell', created_at: '2026-08-10T10:00:00Z' },
    { id: 'a2', veiculo_id: 'v1', data: '2026-10-10', litros: 0, valor: 100, km: null, posto: null, created_at: '2026-10-10T10:00:00Z' },
  ],
  km: [
    { id: 'k1', veiculo_id: 'v1', equipe_id: 'eB', motorista_id: 'm2', data: '2026-09-29', km_atual: 1000, observacoes: null, created_at: '2026-09-29T10:00:00Z' },
    { id: 'k2', veiculo_id: 'v1', equipe_id: 'eB', motorista_id: 'm2', data: '2026-10-01', km_atual: 1200, observacoes: 'ok', created_at: '2026-10-01T10:00:00Z' },
    { id: 'k3', veiculo_id: 'v1', equipe_id: 'eB', motorista_id: null, data: '2026-10-02', km_atual: 1500, observacoes: null, created_at: '2026-10-02T10:00:00Z' },
  ],
  corrigidosAbast: new Set(['a2']),
  correcoesKm: [{ registro_id: 'k2', created_at: '2026-10-05T00:00:00Z', dados: { antes: { km_atual: 1100 } } }],
  comContexto: false,
})

describe('classeCnh', () => {
  it('classifica por dias', () => {
    expect(classeCnh(null, '2026-10-30').classe).toBe('sem')
    expect(classeCnh('2026-10-29', '2026-10-30')).toEqual({ classe: 'vencida', dias: -1 })
    expect(classeCnh('2026-10-30', '2026-10-30').classe).toBe('vencendo')
    expect(classeCnh('2026-12-29', '2026-10-30').classe).toBe('vencendo') // 60 dias
    expect(classeCnh('2026-12-30', '2026-10-30').classe).toBe('em_dia')
  })
})

describe('montarAbastecimentos', () => {
  it('resolve equipe e motorista pela data e ordena mais novo primeiro', () => {
    const r = montarAbastecimentos(base())
    expect(r.map((x) => x.id)).toEqual(['a2', 'a1'])
    expect(r[1]).toMatchObject({ equipe: 'EQ-A', motorista: 'Zeca', placa: 'AAA1A11', preco: 6, corrigido: false })
    expect(r[0]).toMatchObject({ equipe: 'EQ-B', motorista: 'Ana', preco: null, corrigido: true })
  })
  it('sem histórico na data: equipe e motorista nulos', () => {
    const e = base()
    e.responsabilidade = []
    expect(montarAbastecimentos(e)[0].equipe).toBeNull()
  })
  it('contexto só com comContexto', () => {
    const e = base()
    expect(montarAbastecimentos(e)[0].contexto).toBeNull()
    e.comContexto = true
    expect(montarAbastecimentos(e)[0].contexto).not.toBeNull()
  })
})

describe('KM', () => {
  it('rodou desde o anterior; primeiro é null', () => {
    const m = rodadoPorLancamento(base().km)
    expect(m.get('k1')).toBeNull()
    expect(m.get('k2')).toBe(200)
    expect(m.get('k3')).toBe(300)
  })
  it('linhas com era (corrigido) e ordem desc', () => {
    const r = montarKm(base())
    expect(r.map((x) => x.id)).toEqual(['k3', 'k2', 'k1'])
    expect(r[1]).toMatchObject({ era: 1100, equipe: 'EQ-B', motorista: 'Ana', rodado: 200 })
    expect(r[0].motorista).toBeNull()
  })
})

describe('montarMotoristas', () => {
  it('ordena por nome e classifica CNH', () => {
    const r = montarMotoristas(base())
    expect(r.map((m) => m.nome)).toEqual(['Ana', 'Beto', 'Zeca'])
    expect(r.map((m) => m.cnhClasse)).toEqual(['vencendo', 'em_dia', 'vencida'])
    expect(r[2].equipe).toBe('EQ-A')
  })
})

describe('montarVeiculos', () => {
  it('situação, equipe/motorista atuais, km do mês e histórico', () => {
    const r = montarVeiculos(base())
    expect(r.map((v) => [v.placa, v.sit])).toEqual([['AAA1A11', 'uso'], ['BBB2B22', 'oficina'], ['CCC3C33', 'livre']])
    expect(r[0]).toMatchObject({ equipe: 'EQ-B', motorista: 'Ana', kmMes: 500, franquia: 3000 })
    expect(r[0].historico.map((h) => h.equipe)).toEqual(['EQ-B', 'EQ-A'])
    expect(r[0].ultimosKm[0]).toEqual({ data: '2026-10-02', km: 1500 })
    expect(r[1]).toMatchObject({ substituto: 'AAA1A11', retorno: '2026-11-05', kmMes: null })
  })
})
