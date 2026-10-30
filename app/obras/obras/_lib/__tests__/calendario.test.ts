import { diasUteisEntre, ehDiaUtil, proximoDiaUtil, somarDiasUteis } from '../calendario'
import { FERIADOS_MACAE as F } from './fixtures/feriados'

describe('calendario', () => {
  it('ehDiaUtil', () => {
    expect(ehDiaUtil('2026-10-30', F)).toBe(true)
    expect(ehDiaUtil('2026-10-31', F)).toBe(false) // sábado
    expect(ehDiaUtil('2026-11-01', F)).toBe(false) // domingo
    expect(ehDiaUtil('2026-11-02', F)).toBe(false) // Finados
  })
  it('proximoDiaUtil', () => {
    expect(proximoDiaUtil('2026-10-30', F)).toBe('2026-10-30')
    expect(proximoDiaUtil('2026-10-31', F)).toBe('2026-11-03')
  })
  it('somarDiasUteis', () => {
    expect(somarDiasUteis('2026-10-30', 1, F)).toBe('2026-11-03')
    expect(somarDiasUteis('2026-10-30', 0, F)).toBe('2026-10-30')
    expect(somarDiasUteis('2026-10-26', 5, F)).toBe('2026-11-03')
  })
  it('diasUteisEntre', () => {
    expect(diasUteisEntre('2026-10-26', '2026-10-30', F)).toBe(5)
    expect(diasUteisEntre('2026-10-30', '2026-11-03', F)).toBe(2)
    expect(diasUteisEntre('2026-11-05', '2026-11-04', F)).toBe(0)
  })
})
