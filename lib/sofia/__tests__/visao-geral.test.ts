import {
  frotaPorSituacao,
  diaUtilCobrado,
  equipesSemKm,
  classificarCnh,
  somarCustosDoMes,
  agruparExtratosPorCentroCusto,
  montarAcoes,
} from '../visao-geral'

const v = (id: string, status: 'ativo' | 'inativo' | 'manutencao') => ({ id, status })

describe('frotaPorSituacao', () => {
  it('separa em uso, livre, oficina e fora; disponibilidade ignora inativos', () => {
    const r = frotaPorSituacao(
      [v('a', 'ativo'), v('b', 'ativo'), v('c', 'manutencao'), v('d', 'inativo'), v('e', 'ativo')],
      [{ veiculo_id: 'a' }, { veiculo_id: 'e' }]
    )
    expect(r).toMatchObject({ uso: 2, livre: 1, oficina: 1, fora: 1, base: 4, disponiveis: 3, disponibilidadePct: 75 })
  })
  it('sem veículos ativos: 0%, sem dividir por zero', () => {
    expect(frotaPorSituacao([v('d', 'inativo')], []).disponibilidadePct).toBe(0)
    expect(frotaPorSituacao([], []).base).toBe(0)
  })
  it('responsável em carro na oficina não vira "em uso"', () => {
    expect(frotaPorSituacao([v('c', 'manutencao')], [{ veiculo_id: 'c' }])).toMatchObject({ uso: 0, oficina: 1 })
  })
})

describe('diaUtilCobrado', () => {
  it('sexta cobre quinta; segunda cobre sexta', () => {
    expect(diaUtilCobrado('2026-10-30')).toBe('2026-10-29')
    expect(diaUtilCobrado('2026-11-02')).toBe('2026-10-30')
  })
  it('sábado e domingo não cobram', () => {
    expect(diaUtilCobrado('2026-10-31')).toBeNull()
    expect(diaUtilCobrado('2026-11-01')).toBeNull()
  })
})

describe('equipesSemKm', () => {
  it('equipe ativa com carro ativo e sem lançamento no dia', () => {
    const r = equipesSemKm({
      equipes: [
        { id: 'e1', codigo: 'EQ1', ativo: true },
        { id: 'e2', codigo: 'EQ2', ativo: true },
        { id: 'e3', codigo: 'EQ3', ativo: false },
        { id: 'e4', codigo: 'EQ4', ativo: true },
      ],
      responsabilidades: [
        { veiculo_id: 'a', equipe_id: 'e1' },
        { veiculo_id: 'b', equipe_id: 'e2' },
        { veiculo_id: 'c', equipe_id: 'e3' },
        { veiculo_id: 'd', equipe_id: null },
      ],
      veiculos: [v('a', 'ativo'), v('b', 'ativo'), v('c', 'ativo'), v('d', 'ativo')],
      kmDoDia: [{ equipe_id: 'e1' }],
    })
    expect(r.map((e) => e.codigo)).toEqual(['EQ2'])
  })
})

describe('classificarCnh', () => {
  it('vencida e vencendo em 30 dias; ignora inativo e sem data', () => {
    const r = classificarCnh(
      [
        { id: '1', nome: 'A', ativo: true, cnh_vencimento: '2026-10-01' },
        { id: '2', nome: 'B', ativo: true, cnh_vencimento: '2026-11-20' },
        { id: '3', nome: 'C', ativo: true, cnh_vencimento: '2026-12-01' },
        { id: '4', nome: 'D', ativo: false, cnh_vencimento: '2026-10-01' },
        { id: '5', nome: 'E', ativo: true, cnh_vencimento: null },
      ],
      '2026-10-30'
    )
    expect(r.vencidas.map((m) => m.id)).toEqual(['1'])
    expect(r.vencendo.map((m) => m.id)).toEqual(['2'])
  })
})

describe('somarCustosDoMes', () => {
  it('mesma regra da tela Custos', () => {
    const r = somarCustosDoMes({
      veiculos: [{ valor_locacao_mensal: 1000 }, { valor_locacao_mensal: null }],
      multas: [{ valor: 200, valor_descontado: 50 }],
      sinistros: [{ valor_dano: 500, valor_descontado: null }],
      revisoes: [{ valor: 300 }, { valor: null }],
      abastecimentos: [{ valor: 100 }],
    })
    expect(r.itens).toEqual({ locacao: 1000, abastecimento: 100, revisoes: 300, sinistros: 500, multas: 150 })
    expect(r.total).toBe(2050)
  })
})

describe('agruparExtratosPorCentroCusto', () => {
  it('soma por centro e plataforma em centavos; sem centro vai por último', () => {
    const r = agruparExtratosPorCentroCusto([
      { plataforma: 'ticketlog', valor: '10.10', centro_custo_codigo: 'B', centro_custo_nome: 'Beta' },
      { plataforma: 'veloe', valor: 5.2, centro_custo_codigo: 'B', centro_custo_nome: 'Beta' },
      { plataforma: 'ticketlog', valor: 1, centro_custo_codigo: null, centro_custo_nome: null },
      { plataforma: 'ticketlog', valor: 2, centro_custo_codigo: 'A', centro_custo_nome: 'Alfa' },
    ])
    expect(r.linhas.map((l) => l.codigo)).toEqual(['A', 'B', null])
    expect(r.linhas[1]).toMatchObject({ ticketlogCentavos: 1010, veloeCentavos: 520, totalCentavos: 1530 })
    expect(r.totalCentavos).toBe(1530 + 100 + 200)
  })
})

describe('montarAcoes', () => {
  const base = {
    revisoesAtrasadas: [] as { placa: string | null; motivo: 'km' | 'data' }[],
    revisoesBreve: [] as { placa: string | null; km_restantes: number }[],
    equipesSemKm: [] as { codigo: string }[],
    diaKm: null as string | null,
    documentos: [] as { placa: string | null; tipo: string; vencimento: string }[],
    cnhVencidas: [] as { nome: string }[],
    cnhVencendo: [] as { nome: string }[],
    multasSemTratativa: 0,
    sinistrosAbertos: 0,
    veiculosOficinaAtrasados: [] as string[],
  }
  it('sem nada, lista vazia', () => {
    expect(montarAcoes(base)).toEqual([])
  })
  it('só entram itens com número maior que zero', () => {
    const r = montarAcoes({
      ...base,
      revisoesAtrasadas: [{ placa: 'AAA', motivo: 'km' }, { placa: 'BBB', motivo: 'data' }],
      equipesSemKm: [{ codigo: 'EQ2' }],
      diaKm: '2026-10-29',
      cnhVencidas: [{ nome: 'Ana' }],
    })
    expect(r.map((a) => a.id)).toEqual(['revisoes-atrasadas', 'sem-km', 'cnh'])
    expect(r[0].descricao).toContain('1 por KM (AAA)')
    expect(r[1].titulo).toBe('Equipes sem KM diário de ontem (29/10)')
    expect(r[2]).toMatchObject({ n: 1, urgente: true })
  })
})
