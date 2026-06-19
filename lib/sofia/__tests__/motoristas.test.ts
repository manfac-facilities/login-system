import { classificarCnh, cnhStatus } from '../motoristas'

describe('classificarCnh', () => {
  const hoje = new Date('2026-06-17T00:00:00Z')

  it('classifies a missing CNH date as sem_cnh', () => {
    expect(classificarCnh(null, hoje)).toBe('sem_cnh')
  })

  it('classifies a past due date as vencidas', () => {
    expect(classificarCnh('2026-01-01', hoje)).toBe('vencidas')
  })

  it('classifies a date within 30 days as vencidas (urgent)', () => {
    expect(classificarCnh('2026-06-25', hoje)).toBe('vencidas')
  })

  it('classifies a date between 31 and 60 days out as atencao', () => {
    expect(classificarCnh('2026-08-01', hoje)).toBe('atencao')
  })

  it('classifies a date more than 60 days out as regulares', () => {
    expect(classificarCnh('2027-01-01', hoje)).toBe('regulares')
  })
})

describe('cnhStatus', () => {
  it('labels a missing CNH date', () => {
    expect(cnhStatus(null).label).toBe('Sem CNH')
  })

  it('labels an expired CNH as VENCIDA', () => {
    expect(cnhStatus('2020-01-01').label).toBe('VENCIDA')
  })
})
