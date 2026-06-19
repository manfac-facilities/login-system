import { ultimoTipoPorVeiculo, statusEquipe } from '../equipes'

describe('ultimoTipoPorVeiculo', () => {
  it('keeps the most recent checklist tipo per vehicle when rows are ordered newest-first', () => {
    const checklists = [
      { veiculo_id: 'v1', tipo: 'saida' as const, created_at: '2026-06-10' },
      { veiculo_id: 'v1', tipo: 'retorno' as const, created_at: '2026-06-01' },
      { veiculo_id: 'v2', tipo: 'troca' as const, created_at: '2026-06-05' },
    ]

    const result = ultimoTipoPorVeiculo(checklists)

    expect(result.get('v1')).toBe('saida')
    expect(result.get('v2')).toBe('troca')
  })
})

describe('statusEquipe', () => {
  it('returns inativa when the team itself is deactivated, regardless of vehicle state', () => {
    expect(statusEquipe({ ativo: false, veiculoStatus: 'ativo', ultimoTipo: 'saida' })).toBe('inativa')
  })

  it('returns manutencao when the assigned vehicle is in maintenance', () => {
    expect(statusEquipe({ ativo: true, veiculoStatus: 'manutencao', ultimoTipo: 'retorno' })).toBe('manutencao')
  })

  it('returns em_rota when the vehicle last left and has not returned', () => {
    expect(statusEquipe({ ativo: true, veiculoStatus: 'ativo', ultimoTipo: 'saida' })).toBe('em_rota')
  })

  it('returns disponivel when the vehicle last returned', () => {
    expect(statusEquipe({ ativo: true, veiculoStatus: 'ativo', ultimoTipo: 'retorno' })).toBe('disponivel')
  })

  it('returns disponivel when there is no checklist history at all', () => {
    expect(statusEquipe({ ativo: true, veiculoStatus: 'ativo', ultimoTipo: undefined })).toBe('disponivel')
  })

  it('returns disponivel when the team has no vehicle assigned', () => {
    expect(statusEquipe({ ativo: true, veiculoStatus: undefined, ultimoTipo: undefined })).toBe('disponivel')
  })
})
