const LADO_MAXIMO = 1600
const QUALIDADE_JPEG = 0.85

/**
 * Redimensiona o maior lado da imagem pra no máximo 1600px (sem ampliar
 * imagens menores) e reexporta como JPEG qualidade 0.85 via canvas.
 * Usada uniformemente nos dois caminhos do CameraCapture (câmera e galeria)
 * e no anexo de imagem em Documentos — antes só a captura por câmera
 * comprimia, a escolha por galeria subia o arquivo original sem tratamento
 * (achado U-08 da auditoria).
 */
export async function comprimirImagem(file: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Falha ao carregar imagem para compressão'))
      image.src = objectUrl
    })

    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height))
    const largura = Math.round(img.width * escala)
    const altura = Math.round(img.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D não disponível')
    ctx.drawImage(img, 0, 0, largura, altura)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar blob comprimido'))),
        'image/jpeg',
        QUALIDADE_JPEG
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
