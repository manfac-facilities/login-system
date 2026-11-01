/**
 * Planta em PDF: renderiza a 1ª página num canvas, no navegador, e devolve uma
 * imagem. O servidor só recebe imagem (mesmo fluxo e caminho canônico de sempre).
 * O pdfjs só é carregado (import dinâmico) quando o arquivo é PDF.
 */

export const LARGURA_MAXIMA_PDF = 2400
/** Teto de área do canvas: o Safari do iPad/iPhone não desenha acima de ~16,7 Mpx (sai em branco). */
export const AREA_MAXIMA_PDF = 16_000_000

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
    try {
      const doc = await tarefa.promise
      if (doc.numPages < 1) throw new PdfIlegivelError()
      const pagina = await doc.getPage(1)
      const base = pagina.getViewport({ scale: 1 })
      const escala = Math.min(
        LARGURA_MAXIMA_PDF / base.width,
        Math.sqrt(AREA_MAXIMA_PDF / (base.width * base.height)),
      )
      const viewport = pagina.getViewport({ scale: escala })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
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
