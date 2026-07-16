import { isNavActive } from '../nav'

describe('isNavActive', () => {
  it('"Início" ativo somente na home', () => {
    expect(isNavActive('/', '/')).toBe(true)
    expect(isNavActive('/servicos', '/')).toBe(false)
    expect(isNavActive('/contato', '/')).toBe(false)
  })

  it('rota exata ativa', () => {
    expect(isNavActive('/servicos', '/servicos')).toBe(true)
  })

  it('sub-rota ativa o item pai', () => {
    expect(isNavActive('/servicos/hvac', '/servicos')).toBe(true)
  })

  it('prefixo parcial não ativa', () => {
    expect(isNavActive('/servicos-outra', '/servicos')).toBe(false)
  })
})
