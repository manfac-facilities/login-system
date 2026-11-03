const getPage = jest.fn()
const destroy = jest.fn()
const getDocument = jest.fn()
jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: (...a: unknown[]) => getDocument(...a) }))
jest.mock('../montar/_pdf-worker', () => ({ URL_WORKER_PDFJS: 'http://x/worker.mjs' }))

import { PdfIlegivelError, pdfParaImagem, webpParaJpeg } from '../montar/_pdf-para-imagem'

const arquivo = { arrayBuffer: async () => new ArrayBuffer(4) } as unknown as Blob

beforeEach(() => {
  jest.clearAllMocks()
  const render = jest.fn(() => ({ promise: Promise.resolve() }))
  getPage.mockResolvedValue({
    getViewport: ({ scale }: { scale: number }) => ({ width: 1200 * scale, height: 800 * scale }),
    render,
  })
  getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 3, getPage }), destroy })
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D)
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type) => cb(new Blob(['i'], { type })))
})

it('renderiza a 1ª página em 2400 px de largura, em jpeg 0,9 (o react-pdf não lê webp)', async () => {
  const r = await pdfParaImagem(arquivo)
  expect(getPage).toHaveBeenCalledWith(1)
  expect(r).toMatchObject({ ext: 'jpg', type: 'image/jpeg', largura: 2400, altura: 1600, paginas: 3 })
  expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9)
  expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalledWith(expect.any(Function), 'image/webp', expect.anything())
  expect(destroy).toHaveBeenCalled()
})

it('cai para png quando o navegador não gera jpeg', async () => {
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type) => cb(new Blob(['i'], { type: type === 'image/jpeg' ? 'image/png' : type })))
  expect(await pdfParaImagem(arquivo)).toMatchObject({ ext: 'png', type: 'image/png' })
})

it('PDF que o pdfjs recusa vira PdfIlegivelError', async () => {
  getDocument.mockReturnValue({ promise: Promise.reject(new Error('PasswordException')), destroy })
  await expect(pdfParaImagem(arquivo)).rejects.toBeInstanceOf(PdfIlegivelError)
})

it('PDF recusado ainda destrói a tarefa do pdfjs (não deixa worker preso)', async () => {
  getDocument.mockReturnValue({ promise: Promise.reject(new Error('PasswordException')), destroy })
  await expect(pdfParaImagem(arquivo)).rejects.toBeInstanceOf(PdfIlegivelError)
  expect(destroy).toHaveBeenCalled()
})

it('página muito alta fica abaixo de 16 Mpx (Safari do iPad desenha em branco acima disso)', async () => {
  getPage.mockResolvedValue({
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 3000 * scale }),
    render: jest.fn(() => ({ promise: Promise.resolve() })),
  })
  const r = await pdfParaImagem(arquivo)
  expect(r.largura * r.altura).toBeLessThanOrEqual(16_000_000)
  expect(r.largura).toBeLessThan(2400)
})

describe('webpParaJpeg (planta enviada direto em WEBP)', () => {
  const OrigImage = global.Image
  const drawImage = jest.fn()
  const comImagem = (w: number, h: number) => {
    global.Image = class {
      naturalWidth = w
      naturalHeight = h
      onload: () => void = () => {}
      onerror: () => void = () => {}
      set src(_: string) { queueMicrotask(() => this.onload()) }
    } as unknown as typeof Image
  }
  beforeEach(() => {
    drawImage.mockClear()
    Object.assign(URL, { createObjectURL: jest.fn(() => 'blob:x'), revokeObjectURL: jest.fn() })
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: jest.fn(), drawImage, fillStyle: '' } as unknown as CanvasRenderingContext2D)
  })
  afterEach(() => {
    global.Image = OrigImage
  })

  it('vira jpeg 0,9 do mesmo tamanho (imagem pequena não é ampliada)', async () => {
    comImagem(1600, 900)
    const r = await webpParaJpeg(new Blob(['w'], { type: 'image/webp' }))
    expect(r).toMatchObject({ ext: 'jpg', type: 'image/jpeg', largura: 1600, altura: 900 })
    expect(r.blob.type).toBe('image/jpeg')
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 900)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
  })

  it('respeita os tetos do PDF: 2400 px de largura e 16 Mpx de área', async () => {
    comImagem(6000, 3000)
    expect(await webpParaJpeg(new Blob(['w']))).toMatchObject({ largura: 2400, altura: 1200 })
    comImagem(2000, 12000)
    const alta = await webpParaJpeg(new Blob(['w']))
    expect(alta.largura * alta.altura).toBeLessThanOrEqual(16_000_000)
  })

  it('cai para png quando o navegador não gera jpeg', async () => {
    comImagem(800, 600)
    jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type) => cb(new Blob(['i'], { type: type === 'image/jpeg' ? 'image/png' : type })))
    expect(await webpParaJpeg(new Blob(['w']))).toMatchObject({ ext: 'png', type: 'image/png' })
  })
})
