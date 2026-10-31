/**
 * @jest-environment node
 */
const mockTimingSafeEqual = jest.fn()
jest.mock('node:crypto', () => {
  const real = jest.requireActual('node:crypto')
  return { ...real, timingSafeEqual: (...a: [Buffer, Buffer]) => { mockTimingSafeEqual(...a); return real.timingSafeEqual(...a) } }
})

import { hashesIguais, hmacHex } from '../segredo'

const S = 's'.repeat(40)

it('compara hashes com crypto.timingSafeEqual', () => {
  const a = hmacHex(S, 'codigo', 'x')
  expect(hashesIguais(a, a)).toBe(true)
  expect(hashesIguais(a, hmacHex(S, 'codigo', 'y'))).toBe(false)
  expect(mockTimingSafeEqual).toHaveBeenCalledTimes(2)
})

it('formato fora de hex-64 → false sem comparar', () => {
  mockTimingSafeEqual.mockClear()
  expect(hashesIguais('abc', 'abc')).toBe(false)
  expect(hashesIguais(null, undefined)).toBe(false)
  expect(mockTimingSafeEqual).not.toHaveBeenCalled()
})

it('propósito separa código de sessão', () => {
  expect(hmacHex(S, 'codigo', 'v')).not.toBe(hmacHex(S, 'sessao', 'v'))
})
