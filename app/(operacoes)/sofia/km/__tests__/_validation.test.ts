import { validateKmAtual } from '../_validation'

describe('validateKmAtual', () => {
  it('passes for a valid positive km', () => {
    expect(validateKmAtual(29216)).toBeNull()
  })

  it('passes for km of 0 (brand-new vehicle odometer)', () => {
    expect(validateKmAtual(0)).toBeNull()
  })

  it('rejects NaN (field absent or non-numeric in FormData)', () => {
    expect(validateKmAtual(NaN)).toBe('KM atual é obrigatório')
  })

  it('rejects negative km', () => {
    expect(validateKmAtual(-1)).toBe('KM atual não pode ser negativo')
  })
})
