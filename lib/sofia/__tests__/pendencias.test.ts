import { mapAutomaticPendencias, calcularKpisPendencias, agruparGargalos } from '../pendencias'

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

  it('flags a multa pendente without signed authorization', () => {
    const result = mapAutomaticPendencias({
      multas: [{ id: '1', status: 'pendente', autorizacao_assinada: false, data: '2026-06-01', descricao: 'Excesso de velocidade' }],
      sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ origem: 'multa', descricao: expect.stringContaining('Excesso de velocidade') })
  })

  it('flags a multa validada with signed authorization but not yet descontada', () => {
    const result = mapAutomaticPendencias({
      multas: [{ id: '1', status: 'validada', autorizacao_assinada: true, data: '2026-06-01', descricao: 'Excesso de velocidade' }],
      sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ origem: 'multa', descricao: expect.stringContaining('Excesso de velocidade') })
  })

  it('falls back to a sensible default and never renders the literal "null" when descricao is null', () => {
    const result = mapAutomaticPendencias({
      multas: [{ id: '1', status: 'pendente', autorizacao_assinada: false, data: '2026-06-01', descricao: null }],
      sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0].descricao).not.toMatch(/\bnull\b/)
    expect(result[0]).toMatchObject({ origem: 'multa', descricao: 'Multa sem tratativa: sem detalhes adicionais' })
  })

  it('does not flag a multa once it is descontada', () => {
    const result = mapAutomaticPendencias({
      multas: [{ id: '1', status: 'descontada', autorizacao_assinada: true, data: '2026-06-01', descricao: 'Excesso de velocidade' }],
      sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toEqual([])
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
