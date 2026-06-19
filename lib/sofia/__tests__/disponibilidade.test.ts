import { motivoParado, formatarTempoDesde } from '../disponibilidade'

describe('motivoParado', () => {
  it('returns null for a vehicle that is active and has an assigned driver', () => {
    expect(motivoParado({ status: 'ativo', temResponsavelAtivo: true })).toBeNull()
  })

  it('returns manutencao for a vehicle under maintenance', () => {
    expect(motivoParado({ status: 'manutencao', temResponsavelAtivo: true })).toBe('manutencao')
  })

  it('returns sem_motorista for an active vehicle with no current driver/team assigned', () => {
    expect(motivoParado({ status: 'ativo', temResponsavelAtivo: false })).toBe('sem_motorista')
  })

  it('returns outro for an inactive vehicle that is not under maintenance', () => {
    expect(motivoParado({ status: 'inativo', temResponsavelAtivo: true })).toBe('outro')
  })
})

describe('formatarTempoDesde', () => {
  const agora = new Date('2026-06-17T12:00:00Z')

  it('formats an elapsed time under a day as hours', () => {
    expect(formatarTempoDesde('2026-06-17T07:00:00Z', agora)).toBe('5h')
  })

  it('formats an elapsed time of a day or more as days and hours', () => {
    expect(formatarTempoDesde('2026-06-15T08:00:00Z', agora)).toBe('2d 4h')
  })

  it('formats an elapsed time under an hour as minutes', () => {
    expect(formatarTempoDesde('2026-06-17T11:50:00Z', agora)).toBe('10min')
  })
})
