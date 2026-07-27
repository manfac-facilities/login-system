import { comprimirImagem } from '../comprimirImagem'

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 0
  height = 0
  private _src = ''
  set src(v: string) {
    this._src = v
    queueMicrotask(() => this.onload?.())
  }
  get src() {
    return this._src
  }
}

function mockCanvas(outputBlob: Blob) {
  const drawImage = jest.fn()
  const toBlob = jest.fn((cb: (b: Blob | null) => void, _type: string, _quality: number) => cb(outputBlob))
  const canvas = { width: 0, height: 0, getContext: jest.fn(() => ({ drawImage })), toBlob } as unknown as HTMLCanvasElement
  jest.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement)
  return { canvas, drawImage, toBlob }
}

describe('comprimirImagem', () => {
  const originalImage = global.Image
  const originalCreateObjectURL = global.URL.createObjectURL
  const originalRevokeObjectURL = global.URL.revokeObjectURL

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = MockImage as any
    global.URL.createObjectURL = jest.fn(() => 'blob:mock')
    global.URL.revokeObjectURL = jest.fn()
  })

  afterEach(() => {
    global.Image = originalImage
    global.URL.createObjectURL = originalCreateObjectURL
    global.URL.revokeObjectURL = originalRevokeObjectURL
    jest.restoreAllMocks()
  })

  it('redimensiona o maior lado pra 1600px preservando a proporção (imagem larga)', async () => {
    const outputBlob = new Blob(['comprimido'], { type: 'image/jpeg' })
    const { canvas } = mockCanvas(outputBlob)

    class WideImage extends MockImage {
      set src(v: string) {
        this.width = 3200
        this.height = 2400
        queueMicrotask(() => this.onload?.())
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = WideImage as any

    const result = await comprimirImagem(new Blob(['original'], { type: 'image/jpeg' }))
    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(1200)
    expect(result).toBe(outputBlob)
  })

  it('não aumenta imagem já menor que 1600px no maior lado', async () => {
    const outputBlob = new Blob(['comprimido'], { type: 'image/jpeg' })
    const { canvas } = mockCanvas(outputBlob)

    class SmallImage extends MockImage {
      set src(v: string) {
        this.width = 800
        this.height = 600
        queueMicrotask(() => this.onload?.())
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.Image = SmallImage as any

    const result = await comprimirImagem(new Blob(['original'], { type: 'image/jpeg' }))
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
    expect(result).toBe(outputBlob)
  })

  it('exporta como JPEG qualidade 0.85', async () => {
    const outputBlob = new Blob(['comprimido'], { type: 'image/jpeg' })
    const { toBlob } = mockCanvas(outputBlob)

    await comprimirImagem(new Blob(['original'], { type: 'image/jpeg' }))

    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85)
  })
})
