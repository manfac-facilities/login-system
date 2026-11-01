/**
 * Planta em PDF: renderiza a 1ª página num canvas, no navegador, e devolve uma
 * imagem. O servidor só recebe imagem (mesmo fluxo e caminho canônico de sempre).
 * O pdfjs só é carregado (import dinâmico) quando o arquivo é PDF.
 */

export const LARGURA_MAXIMA_PDF = 2400

export class PdfIlegivelError extends Error {
  constructor() {
    super('pdf ilegível')
  }
}

export type PlantaDoPdf = {
  blob: Blob
  /** Extensão canônica do caminho no bucket (webp, ou png quando o navegador não gera webp). */
  ext: 'webp' | 'png'
  type: 'image/webp' | 'image/png'
  largura: number
  altura: number
  paginas: number
}

const paraBlob = (canvas: HTMLCanvasElement, type: string, qualidade?: number) =>
  new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, qualidade))

export async function pdfParaImagem(arquivo: Blob): Promise<PlantaDoPdf> {
  try {
    const [pdfjs, { URL_WORKER_PDFJS }] = await Promise.all([import('pdfjs-dist'), import('./_pdf-worker')])
    pdfjs.GlobalWorkerOptions.workerSrc = URL_WORKER_PDFJS
    const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) })
    const doc = await tarefa.promise
    try {
      if (doc.numPages < 1) throw new PdfIlegivelError()
      const pagina = await doc.getPage(1)
      const base = pagina.getViewport({ scale: 1 })
      const viewport = pagina.getViewport({ scale: LARGURA_MAXIMA_PDF / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new PdfIlegivelError()
      await pagina.render({ canvas, canvasContext: ctx, viewport }).promise
      let blob = await paraBlob(canvas, 'image/webp', 0.9)
      let type: 'image/webp' | 'image/png' = 'image/webp'
      if (!blob || blob.type !== 'image/webp') {
        blob = await paraBlob(canvas, 'image/png')
        type = 'image/png'
      }
      if (!blob) throw new PdfIlegivelError()
      return { blob, type, ext: type === 'image/webp' ? 'webp' : 'png', largura: canvas.width, altura: canvas.height, paginas: doc.numPages }
    } finally {
      void tarefa.destroy()
    }
  } catch {
    // senha, arquivo corrompido, sem página, sem canvas: a tela mostra uma só mensagem
    throw new PdfIlegivelError()
  }
}
