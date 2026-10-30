import { dentroDoShellObra } from '../fora-do-shell-obra'

describe('dentroDoShellObra', () => {
  it.each([
    ['/obras/obras/abc', true],
    ['/obras/obras/abc/cronograma', true],
    ['/obras/obras', false],
    ['/obras/obras/', false],
    ['/obras/base', false],
    ['/obras/obra/abc', false],
  ])('%s → %s', (p, esperado) => {
    expect(dentroDoShellObra(p)).toBe(esperado)
  })
})
