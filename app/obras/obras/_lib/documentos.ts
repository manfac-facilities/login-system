/**
 * Documentos da obra (Leva 5 §3.1): pastas fixas, tipos e tamanho aceitos,
 * nome de arquivo saneado e caminho no bucket privado `obras-docs`
 * (`<obra_id>/<uuid>-<nome>`, o mesmo formato que o trigger do banco confere).
 */

export const PASTAS = [
  { valor: 'projetos', rotulo: 'Projetos' },
  { valor: 'laudos', rotulo: 'Laudos' },
  { valor: 'art', rotulo: 'ART' },
  { valor: 'layout', rotulo: 'Layout' },
  { valor: 'termos', rotulo: 'Termos' },
  { valor: 'outros', rotulo: 'Outros' },
] as const
export type Pasta = (typeof PASTAS)[number]['valor']

export const BUCKET_DOCS = 'obras-docs'
export const TAMANHO_MAXIMO_DOC = 25 * 1024 * 1024
export const EXTENSOES_DOC = ['pdf', 'jpg', 'png', 'dwg', 'xlsx', 'docx'] as const
export const ACCEPT_DOC = '.pdf,.jpg,.jpeg,.png,.dwg,.xlsx,.docx'
/** URL assinada de download: curta (o portal exige ≤ 5 min). */
export const VALIDADE_URL_DOC_S = 60

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

export const pastaValida = (p: unknown): p is Pasta => PASTAS.some((x) => x.valor === p)

export function extensaoDe(nome: string): string {
  const i = nome.lastIndexOf('.')
  const e = i >= 0 ? nome.slice(i + 1).toLowerCase() : ''
  return e === 'jpeg' ? 'jpg' : e
}

/** Só [A-Za-z0-9._-], 1..200, sem acento nem barra; mantém a extensão. */
export function nomeSaneado(nome: string): string {
  const base = (nome ?? '').split(/[\\/]/).pop() ?? ''
  const limpo = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '')
  if (!limpo) return 'arquivo'
  if (limpo.length <= 200) return limpo
  const i = limpo.lastIndexOf('.')
  const ext = i > 0 && limpo.length - i <= 10 ? limpo.slice(i) : ''
  return limpo.slice(0, 200 - ext.length) + ext
}

/** Erro em português ou null. */
export function validarArquivoDoc(a: { nome: string; tamanho: number }): string | null {
  if (!Number.isFinite(a.tamanho) || a.tamanho <= 0) return 'Arquivo vazio'
  if (a.tamanho > TAMANHO_MAXIMO_DOC) return 'O arquivo passa de 25 MB'
  if (!(EXTENSOES_DOC as readonly string[]).includes(extensaoDe(a.nome))) {
    return 'Tipo não aceito: use PDF, JPG, PNG, DWG, XLSX ou DOCX'
  }
  return null
}

export const montarPathDoc = (obraId: string, uuid: string, nome: string) => `${obraId}/${uuid}-${nomeSaneado(nome)}`

export const pathDocValido = (obraId: string, path: unknown): path is string =>
  typeof path === 'string' &&
  new RegExp(`^${obraId.replace(/[^0-9a-f-]/gi, '')}/${UUID}-[A-Za-z0-9._-]{1,200}$`, 'i').test(path) &&
  /^[0-9a-f-]{36}$/i.test(obraId)
