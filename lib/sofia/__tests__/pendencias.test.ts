import {
  mapAutomaticPendencias,
  calcularKpisPendencias,
  agruparGargalos,
  pendenciaDaMulta,
  type MultaPendenciaInput,
} from '../pendencias'

describe('mapAutomaticPendencias', () => {
  it('revisão atrasada por KM cita a placa, quanto passou e guarda o KM previsto como prazo', () => {
    const result = mapAutomaticPendencias({
      multas: [], sinistros: [], documentosVencendo: [], termosNaoAssinados: [],
      revisoesAtrasadas: [{ id: 'a', placa: 'QXB-7J58', proxima_data: null, proxima_km: 60000, km_passados: 1230, motivo: 'km' }],
    })
    expect(result).toEqual([{
      descricao: 'Manutenção atrasada por KM: QXB-7J58 — passou 1.230 km do previsto',
      origem: 'manutencao', prazo: null, prazoKm: 60000,
    }])
  })

  it('revisão atrasada por data cita a placa e a data prevista, sem prazoKm', () => {
    const result = mapAutomaticPendencias({
      multas: [], sinistros: [], documentosVencendo: [], termosNaoAssinados: [],
      revisoesAtrasadas: [{ id: 'b', placa: 'SGU-2C93', proxima_data: '2026-10-15', proxima_km: 30150, km_passados: null, motivo: 'data' }],
    })
    expect(result).toEqual([{
      descricao: 'Manutenção atrasada por data: SGU-2C93 — prevista para 15/10/2026',
      origem: 'manutencao', prazo: '2026-10-15',
    }])
  })

  const M = (etapa: string, extra: Record<string, unknown> = {}) => ({
    id: '1',
    etapa: etapa as MultaPendenciaInput['etapa'],
    prazo_indicacao: '2026-12-03',
    placa: 'QRT4F21',
    tipo_infracao: 'Excesso de velocidade (até 20%)',
    descricao: 'detalhe',
    ...extra,
  })
  const vazio = { sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [] }

  it.each([
    ['registrada', 'Confirmar o condutor: QRT4F21, excesso de velocidade (até 20%)', 'a_fazer', '2026-12-03'],
    ['condutor', 'Aguardando aceite do termo pelo motorista: QRT4F21, excesso de velocidade (até 20%)', 'a_fazer', '2026-12-03'],
    ['termo', 'Indicar o condutor ao órgão até 03/12/2026: QRT4F21, excesso de velocidade (até 20%)', 'a_fazer', '2026-12-03'],
    ['indicado', 'Aguardando validação do gestor da equipe: QRT4F21, excesso de velocidade (até 20%)', 'a_fazer', null],
    ['validada', 'Lançar o boleto da locadora: QRT4F21, excesso de velocidade (até 20%)', 'a_fazer', null],
    ['cobrada', 'Solicitar o desconto: QRT4F21, excesso de velocidade (até 20%)', 'a_fazer', null],
    ['solicitado', 'Multa enviada para desconto, aguardando autorização: QRT4F21, excesso de velocidade (até 20%)', 'aguardando_terceiros', null],
    ['autorizado', 'Desconto autorizado, aguardando o RH descontar em folha: QRT4F21, excesso de velocidade (até 20%)', 'aguardando_terceiros', null],
  ])('multa na etapa %s', (etapa, descricao, grupo, prazo) => {
    expect(mapAutomaticPendencias({ multas: [M(etapa)], ...vazio })).toEqual([{ descricao, origem: 'multa', grupo, prazo }])
  })

  it.each(['descontada', 'contestada'])('multa %s não aparece', (etapa) => {
    expect(mapAutomaticPendencias({ multas: [M(etapa)], ...vazio })).toEqual([])
    expect(pendenciaDaMulta(M(etapa))).toBeNull()
  })

  it('termo sem prazo usa o texto sem data e prazo nulo', () => {
    expect(pendenciaDaMulta(M('termo', { prazo_indicacao: null }))).toEqual({
      descricao: 'Indicar o condutor ao órgão: QRT4F21, excesso de velocidade (até 20%)',
      origem: 'multa',
      prazo: null,
      grupo: 'a_fazer',
    })
  })

  it('fallback sem placa e sem tipo nunca mostra "null"', () => {
    const p = pendenciaDaMulta(M('registrada', { placa: null, tipo_infracao: null }))!
    expect(p.descricao).toBe('Confirmar o condutor: veículo sem placa, detalhe')
    const q = pendenciaDaMulta(M('registrada', { placa: null, tipo_infracao: null, descricao: null }))!
    expect(q.descricao).toBe('Confirmar o condutor: veículo sem placa, sem detalhes adicionais')
    expect(q.descricao).not.toMatch(/null/)
  })

  it('returns nothing when there is nothing pending', () => {
    const result = mapAutomaticPendencias({
      multas: [], sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toEqual([])
  })
})

describe('calcularKpisPendencias', () => {
  const hoje = '2026-06-17'

  it('counts open items, overdue items, in-progress items, and items resolved today', () => {
    const todas = [
      { prazo: '2026-06-01', status: 'aberta', updated_at: '2026-06-10' }, // overdue, open
      { prazo: '2026-07-01', status: 'em_andamento', updated_at: '2026-06-10' }, // not overdue, in progress
      { prazo: '2026-06-01', status: 'concluida', updated_at: '2026-06-17' }, // resolved today
      { prazo: null, status: 'concluida', updated_at: '2026-06-01' }, // resolved, but not today
    ]

    const result = calcularKpisPendencias(todas, hoje)

    expect(result.totalPendente).toBe(2)
    expect(result.urgenciaAlta).toBe(1)
    expect(result.aguardandoTerceiros).toBe(1)
    expect(result.resolvidosHoje).toBe(1)
  })

  it('revisão atrasada só por KM (prazoKm, sem data) conta como urgência alta', () => {
    const todas = [
      { prazo: null, prazoKm: 60000, status: 'aberta', updated_at: '' },
      { prazo: '2026-07-01', status: 'aberta', updated_at: '' }, // futuro, não urgente
    ]
    expect(calcularKpisPendencias(todas, hoje).urgenciaAlta).toBe(1)
  })

  it('computes 0 efficiency when nothing was resolved today and nothing is open', () => {
    const result = calcularKpisPendencias([], hoje)
    expect(result.eficiencia).toBe(0)
  })

  it('computes efficiency as resolved-today over (resolved-today + still-open)', () => {
    const todas = [
      { prazo: null, status: 'concluida', updated_at: hoje },
      { prazo: null, status: 'aberta', updated_at: '2026-06-01' },
    ]
    const result = calcularKpisPendencias(todas, hoje)
    expect(result.eficiencia).toBe(50)
  })
})

describe('agruparGargalos', () => {
  it('groups pendencias by origem with count and percentage of the total', () => {
    const todas = [
      { origem: 'sinistro' },
      { origem: 'sinistro' },
      { origem: 'documento' },
      { origem: 'manutencao' },
    ]

    const result = agruparGargalos(todas)

    expect(result).toEqual([
      { origem: 'sinistro', count: 2, pct: 50 },
      { origem: 'documento', count: 1, pct: 25 },
      { origem: 'manutencao', count: 1, pct: 25 },
    ])
  })

  it('returns an empty array when there are no pendencias', () => {
    expect(agruparGargalos([])).toEqual([])
  })
})
