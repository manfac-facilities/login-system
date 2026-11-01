const getPage = jest.fn()
const destroy = jest.fn()
const getDocument = jest.fn()
jest.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: (...a: unknown[]) => getDocument(...a) }))
jest.mock('../montar/_pdf-worker', () => ({ URL_WORKER_PDFJS: 'http://x/worker.mjs' }))

import { PdfIlegivelError, pdfParaImagem } from '../montar/_pdf-para-imagem'

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

it('renderiza a 1ª página em 2400 px de largura, em webp', async () => {
  const r = await pdfParaImagem(arquivo)
  expect(getPage).toHaveBeenCalledWith(1)
  expect(r).toMatchObject({ ext: 'webp', type: 'image/webp', largura: 2400, altura: 1600, paginas: 3 })
  expect(destroy).toHaveBeenCalled()
})

it('cai para png quando o navegador não gera webp', async () => {
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, type) => cb(new Blob(['i'], { type: type === 'image/webp' ? 'image/png' : type })))
  expect(await pdfParaImagem(arquivo)).toMatchObject({ ext: 'png', type: 'image/png' })
})

it('PDF que o pdfjs recusa vira PdfIlegivelError', async () => {
  getDocument.mockReturnValue({ promise: Promise.reject(new Error('PasswordException')), destroy })
  await expect(pdfParaImagem(arquivo)).rejects.toBeInstanceOf(PdfIlegivelError)
})
