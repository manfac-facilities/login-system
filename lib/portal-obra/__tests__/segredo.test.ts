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

it('segredo ausente é logado uma vez por processo, não a cada chamada', () => {
  const erro = jest.spyOn(console, 'error').mockImplementation(() => {})
  const antes = process.env.PORTAL_OBRA_SEGREDO
  delete process.env.PORTAL_OBRA_SEGREDO
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { segredoPortal } = require('../segredo') as typeof import('../segredo')
    expect(segredoPortal()).toBeNull()
    expect(segredoPortal()).toBeNull()
    expect(segredoPortal()).toBeNull()
  })
  expect(erro).toHaveBeenCalledTimes(1)
  process.env.PORTAL_OBRA_SEGREDO = antes
  erro.mockRestore()
})
