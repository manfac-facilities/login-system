import { render } from '@testing-library/react'
import { MainForaDoShellObra } from '../fora-do-shell-obra'

let caminho = '/obras/base'
jest.mock('next/navigation', () => ({ usePathname: () => caminho }))

describe('MainForaDoShellObra', () => {
  it('fora da obra embrulha em <main>', () => {
    caminho = '/obras/base'
    const { container } = render(<MainForaDoShellObra><p>x</p></MainForaDoShellObra>)
    expect(container.querySelectorAll('main')).toHaveLength(1)
  })

  it('dentro da obra não cria <main> (o ShellObra já tem o dele)', () => {
    caminho = '/obras/obras/abc/cronograma'
    const { container } = render(<MainForaDoShellObra><main id="conteudo-obra">x</main></MainForaDoShellObra>)
    expect(container.querySelectorAll('main')).toHaveLength(1)
  })
})
