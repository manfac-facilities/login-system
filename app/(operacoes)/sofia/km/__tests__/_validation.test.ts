import { validateKmInput } from '../_validation'

describe('validateKmInput', () => {
  it('passes for a valid km_inicial with no km_final', () => {
    expect(validateKmInput({ km_inicial: 100, km_final: null })).toBeNull()
  })

  it('passes for a valid km_inicial and km_final', () => {
    expect(validateKmInput({ km_inicial: 100, km_final: 150 })).toBeNull()
  })

  it('requires km_inicial when it is NaN (field absent/non-numeric in FormData)', () => {
    expect(validateKmInput({ km_inicial: NaN, km_final: null })).toBe(
      'KM inicial é obrigatório'
    )
  })

  it('accepts km_inicial of 0 (regression for bug #1 — brand-new vehicle odometer)', () => {
    expect(validateKmInput({ km_inicial: 0, km_final: null })).toBeNull()
  })

  it('rejects km_final less than km_inicial', () => {
    expect(validateKmInput({ km_inicial: 100, km_final: 50 })).toBe(
      'KM final não pode ser menor que o KM inicial'
    )
  })

  it('rejects km_final of 0 when km_inicial is greater than 0 (regression for bug #2)', () => {
    expect(validateKmInput({ km_inicial: 100, km_final: 0 })).toBe(
      'KM final não pode ser menor que o KM inicial'
    )
  })

  it('accepts km_final of 0 when km_inicial is also 0', () => {
    expect(validateKmInput({ km_inicial: 0, km_final: 0 })).toBeNull()
  })

  it('passes when km_final equals km_inicial', () => {
    expect(validateKmInput({ km_inicial: 100, km_final: 100 })).toBeNull()
  })
})
