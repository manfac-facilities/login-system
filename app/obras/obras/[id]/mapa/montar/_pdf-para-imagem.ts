/**
 * Planta em PDF: renderiza a 1ª página num canvas, no navegador, e devolve uma
 * imagem. O servidor só recebe imagem (mesmo fluxo e caminho canônico de sempre).
 * O pdfjs só é carregado (import dinâmico) quando o arquivo é PDF.
 *
 * A imagem sai em JPEG (ou PNG, se o navegador não gerar JPEG), nunca em WEBP:
 * o react-pdf da prancha de faseamento só lê JPEG e PNG. Pelo mesmo motivo, a
 * planta enviada direto em WEBP passa por `webpParaJpeg` antes de subir.
 */

export const LARGURA_MAXIMA_PDF = 2400
/** Teto de área do canvas: o Safari do iPad/iPhone não desenha acima de ~16,7 Mpx (sai em branco). */
export const AREA_MAXIMA_PDF = 16_000_000

export class PdfIlegivelError extends Error {
  constructor() {
    super('pdf ilegível')
  }
}

export type ImagemDaPlanta = {
  blob: Blob
  /** Extensão canônica do caminho no bucket (jpg, ou png quando o navegador não gera JPEG). */
  ext: 'jpg' | 'png'
  type: 'image/jpeg' | 'image/png'
  largura: number
  altura: number
}

export type PlantaDoPdf = ImagemDaPlanta & { paginas: number }

const paraBlob = (canvas: HTMLCanvasElement, type: string, qualidade?: number) =>
  new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, qualidade))

/** Escala que respeita a largura máxima e o teto de área do canvas. */
export const escalaDaPlanta = (largura: number, altura: number) =>
  Math.min(LARGURA_MAXIMA_PDF / largura, Math.sqrt(AREA_MAXIMA_PDF / (largura * altura)))

/** Canvas → JPEG 0,9 (ou PNG, se o navegador não gerar JPEG). Null se nenhum dos dois sair. */
async function canvasParaImagem(canvas: HTMLCanvasElement): Promise<ImagemDaPlanta | null> {
  let blob = await paraBlob(canvas, 'image/jpeg', 0.9)
  let type: ImagemDaPlanta['type'] = 'image/jpeg'
  if (!blob || blob.type !== 'image/jpeg') {
    blob = await paraBlob(canvas, 'image/png')
    type = 'image/png'
  }
  if (!blob) return null
  return { blob, type, ext: type === 'image/jpeg' ? 'jpg' : 'png', largura: canvas.width, altura: canvas.height }
}

/**
 * Planta enviada em WEBP → JPEG (ou PNG), com os mesmos tetos de largura e área
 * do PDF (só reduz, nunca amplia). Fundo branco: o JPEG não tem transparência.
 */
export async function webpParaJpeg(arquivo: Blob): Promise<ImagemDaPlanta> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = new Image()
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok()
      img.onerror = () => erro(new Error('imagem'))
      img.src = url
    })
    const escala = Math.min(1, escalaDaPlanta(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(img.naturalWidth * escala))
    canvas.height = Math.max(1, Math.floor(img.naturalHeight * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const r = await canvasParaImagem(canvas)
    if (!r) throw new Error('canvas')
    return r
  } finally {
    URL.revokeObjectURL(url)
  }
}

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
      const viewport = pagina.getViewport({ scale: escalaDaPlanta(base.width, base.height) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new PdfIlegivelError()
      await pagina.render({ canvas, canvasContext: ctx, viewport }).promise
      const r = await canvasParaImagem(canvas)
      if (!r) throw new PdfIlegivelError()
      return { ...r, paginas: doc.numPages }
    } finally {
      void tarefa.destroy()
    }
  } catch {
    // senha, arquivo corrompido, sem página, sem canvas: a tela mostra uma só mensagem
    throw new PdfIlegivelError()
  }
}
