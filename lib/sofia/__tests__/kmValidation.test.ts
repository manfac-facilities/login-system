import { validateKmAtual } from '../kmValidation'

describe('validateKmAtual', () => {
  it('returns error for NaN input', () => {
    expect(validateKmAtual(NaN)).toBe('KM atual é obrigatório')
  })

  it('returns null for valid positive number', () => {
    expect(validateKmAtual(29216)).toBeNull()
  })

  it('returns null for zero (new vehicle)', () => {
    expect(validateKmAtual(0)).toBeNull()
  })

  it('returns error for negative', () => {
    expect(validateKmAtual(-1)).toBe('KM atual não pode ser negativo')
  })
})
