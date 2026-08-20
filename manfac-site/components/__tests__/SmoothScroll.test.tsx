import { render } from '@testing-library/react'

// O Lenis é substituído por um dublê para que o teste observe se ele chegou a
// ser instanciado — é essa a decisão que importa aqui, não o que ele faz depois.
const destroy = vi.fn()
const construir = vi.fn()

vi.mock('lenis', () => ({
  default: class {
    constructor(opts: unknown) {
      construir(opts)
    }
    destroy = destroy
  },
}))

import SmoothScroll from '../SmoothScroll'

function mockReducedMotion(reduzido: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduzido && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('SmoothScroll', () => {
  beforeEach(() => {
    construir.mockClear()
    destroy.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sobe o Lenis quando não há preferência por menos movimento', () => {
    mockReducedMotion(false)
    render(<SmoothScroll />)
    expect(construir).toHaveBeenCalledTimes(1)
  })

  it('nem instancia o Lenis com prefers-reduced-motion: reduce', () => {
    mockReducedMotion(true)
    render(<SmoothScroll />)
    expect(construir).not.toHaveBeenCalled()
  })

  it('destrói a instância ao desmontar, para não empilhar entre páginas', () => {
    mockReducedMotion(false)
    const { unmount } = render(<SmoothScroll />)
    unmount()
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
