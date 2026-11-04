// app/(operacoes)/sofia/checklist/_validation.ts
import { TETO_FOTOS, ehPecaValida, ehTamanhoValido, type AcaoAvaria, type TamanhoAvaria, type TipoFoto } from '@/lib/sofia/fotosChecklist'

/** true = OK, false = Problema, null = não respondido ainda. */
export type ChecklistItemStatus = boolean | null

export interface ChecklistItens {
  lataria_ok: ChecklistItemStatus
  vidros_ok: ChecklistItemStatus
  pneus_ok: ChecklistItemStatus
  combustivel_ok: ChecklistItemStatus
  itens_internos_ok: ChecklistItemStatus
  estepe_ok: ChecklistItemStatus
  macaco_ok: ChecklistItemStatus
  triangulo_ok: ChecklistItemStatus
}

export interface FotoUpload {
  path: string
  lat: number | null
  lng: number | null
  /** ausente = deduzido da posição (Interna → interna; demais → obrigatoria) */
  tipo_foto?: TipoFoto
  /** referência local da avaria do formulário (só nas fotos de avaria) */
  avaria_ref?: string
}

export interface AvariaInput {
  ref: string
  peca: string
  tamanho: TamanhoAvaria
  acao: AcaoAvaria | null
  descricao: string | null
}

const TIPOS_FOTO: readonly TipoFoto[] = ['obrigatoria', 'interna', 'extra', 'avaria_peca', 'avaria_dano']

/** tipo_foto efetivo de uma foto (o banco exige o campo; as antigas não mandavam). */
export function tipoDaFoto(posicao: string, foto: FotoUpload): TipoFoto {
  if (foto.tipo_foto) return foto.tipo_foto
  return posicao === FOTO_POSICAO_OPCIONAL ? 'interna' : 'obrigatoria'
}

export const FOTO_POSICOES_OBRIGATORIAS = ['Frente', 'Traseira', 'Lateral Esq.', 'Lateral Dir.'] as const
export const FOTO_POSICAO_OPCIONAL = 'Interna'

export interface ParsedChecklistInput {
  id: string
  tipo: string
  equipe_id: string | null
  veiculo_id: string
  motorista_id: string | null
  equipe_destino_id: string | null
  motorista_destino_id: string | null
  observacoes: string | null
  latitude: number | null
  longitude: number | null
  avaria_identificada: boolean
  avaria_descricao: string | null
  chave_entregue: boolean
  cartao_combustivel_entregue: boolean
  assinatura_motorista: boolean
  itens: ChecklistItens
  itens_problemas: Record<string, string>
  fotos: Record<string, FotoUpload>
  avarias: AvariaInput[]
}

function parseItemStatus(raw: string | null): ChecklistItemStatus {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

/**
 * Parses the raw FormData submitted by the checklist form into a typed,
 * null-safe shape. Fields that are optional in the form (e.g. `observacoes`,
 * `motorista_id`) may legitimately be absent from FormData — `formData.get()`
 * returns `null` in that case, so every string field is read as
 * `string | null` before any string method (like `.trim()`) is called on it.
 *
 * `itens_problemas` e `fotos` chegam como um único campo JSON cada — o
 * formulário monta esses dois mapas em memória (descrição por item marcado
 * "Problema", caminho de storage por posição de foto já enviada) porque não
 * dá pra confiar num conjunto variável de `<input>` nomeados quando o
 * conjunto de fotos é dinâmico.
 */
export function parseChecklistFormData(formData: FormData): ParsedChecklistInput {
  const id = (formData.get('id') as string | null) ?? ''
  const tipo = (formData.get('tipo') as string | null) ?? ''
  const equipe_id = (formData.get('equipe_id') as string | null) || null
  const veiculo_id = (formData.get('veiculo_id') as string | null) ?? ''
  const motorista_id = (formData.get('motorista_id') as string | null) || null
  const equipe_destino_id = (formData.get('equipe_destino_id') as string | null) || null
  const motorista_destino_id = (formData.get('motorista_destino_id') as string | null) || null
  const observacoes = (formData.get('observacoes') as string | null)?.trim() || null
  const latitude = formData.get('latitude') ? Number(formData.get('latitude')) : null
  const longitude = formData.get('longitude') ? Number(formData.get('longitude')) : null
  const avaria_identificada = formData.get('avaria_identificada') === 'true'
  const avaria_descricao = (formData.get('avaria_descricao') as string | null)?.trim() || null
  const chave_entregue = formData.get('chave_entregue') === 'true'
  const cartao_combustivel_entregue = formData.get('cartao_combustivel_entregue') === 'true'
  const assinatura_motorista = formData.get('assinatura_motorista') === 'true'

  const itens: ChecklistItens = {
    lataria_ok: parseItemStatus(formData.get('lataria_ok') as string | null),
    vidros_ok: parseItemStatus(formData.get('vidros_ok') as string | null),
    pneus_ok: parseItemStatus(formData.get('pneus_ok') as string | null),
    combustivel_ok: parseItemStatus(formData.get('combustivel_ok') as string | null),
    itens_internos_ok: parseItemStatus(formData.get('itens_internos_ok') as string | null),
    estepe_ok: parseItemStatus(formData.get('estepe_ok') as string | null),
    macaco_ok: parseItemStatus(formData.get('macaco_ok') as string | null),
    triangulo_ok: parseItemStatus(formData.get('triangulo_ok') as string | null),
  }

  let itens_problemas: Record<string, string> = {}
  try {
    itens_problemas = JSON.parse((formData.get('itens_problemas') as string | null) || '{}')
  } catch {
    itens_problemas = {}
  }

  let fotos: Record<string, FotoUpload> = {}
  try {
    fotos = JSON.parse((formData.get('fotos') as string | null) || '{}')
  } catch {
    fotos = {}
  }

  let avariasBrutas: unknown = []
  try {
    avariasBrutas = JSON.parse((formData.get('avarias') as string | null) || '[]')
  } catch {
    avariasBrutas = null
  }
  const avarias: AvariaInput[] = Array.isArray(avariasBrutas)
    ? avariasBrutas.map((a) => ({
        ref: String(a?.ref ?? ''),
        peca: String(a?.peca ?? '').trim(),
        tamanho: a?.tamanho,
        acao: a?.acao === 'reparo' || a?.acao === 'troca' ? a.acao : null,
        descricao: typeof a?.descricao === 'string' && a.descricao.trim() ? a.descricao.trim() : null,
      }))
    : // JSON inválido: uma avaria impossível, para a validação recusar (nunca ignorar em silêncio)
      [{ ref: '', peca: '', tamanho: '' as TamanhoAvaria, acao: null, descricao: null }]

  return {
    id,
    tipo,
    equipe_id,
    veiculo_id,
    motorista_id,
    equipe_destino_id,
    motorista_destino_id,
    observacoes,
    latitude,
    longitude,
    avaria_identificada,
    avaria_descricao,
    chave_entregue,
    cartao_combustivel_entregue,
    assinatura_motorista,
    itens,
    itens_problemas,
    fotos,
    avarias,
  }
}

/**
 * Validates a parsed checklist input. Returns an error message (in Portuguese,
 * surfaced directly to the user) or `null` when the input is valid.
 */
export function validateChecklistInput(input: ParsedChecklistInput): string | null {
  if (!input.id) return 'Erro interno: identificador do checklist ausente'
  if (!input.tipo || !input.veiculo_id) {
    return 'Tipo e veículo são obrigatórios'
  }
  const exigeEquipe = ['saida', 'retorno', 'devolucao'].includes(input.tipo)
  if (exigeEquipe && !input.equipe_id) {
    return 'Equipe é obrigatória para este tipo de checklist'
  }
  if (input.tipo === 'troca' && !input.equipe_destino_id) {
    return 'Equipe de destino é obrigatória numa troca'
  }
  if (!input.assinatura_motorista) {
    return 'Confirmação do motorista é obrigatória'
  }

  const itemKeys = Object.keys(input.itens) as (keyof ChecklistItens)[]
  if (itemKeys.some((k) => input.itens[k] === null)) {
    return 'Todos os 8 itens de verificação devem ser respondidos'
  }

  const fotosFaltando = FOTO_POSICOES_OBRIGATORIAS.filter((p) => !input.fotos[p]?.path)
  if (fotosFaltando.length > 0) {
    return `Fotos obrigatórias faltando: ${fotosFaltando.join(', ')}`
  }

  return validarFotosEAvarias(input.fotos, input.avarias)
}

/** Teto de 30, tipo_foto válido e cada avaria com peça, tamanho, ≥1 foto da peça e ≥1 da avaria. */
export function validarFotosEAvarias(fotos: Record<string, FotoUpload>, avarias: AvariaInput[]): string | null {
  const entradas = Object.entries(fotos)
  if (entradas.length > TETO_FOTOS) return `Limite de ${TETO_FOTOS} fotos por checklist`

  const refs = new Set<string>()
  for (const a of avarias) {
    if (!a.ref || refs.has(a.ref)) return 'Avaria inválida: registre a avaria de novo'
    refs.add(a.ref)
    if (!ehPecaValida(a.peca)) return 'Avaria sem peça válida'
    if (!ehTamanhoValido(a.tamanho)) return `Avaria (${a.peca}) sem tamanho válido`
  }

  for (const [posicao, f] of entradas) {
    if (!f?.path) return `Foto sem arquivo: ${posicao}`
    const tipo = tipoDaFoto(posicao, f)
    if (!TIPOS_FOTO.includes(tipo)) return `Tipo de foto inválido: ${posicao}`
    const deAvaria = tipo === 'avaria_peca' || tipo === 'avaria_dano'
    if (deAvaria !== !!f.avaria_ref) return `Foto de avaria sem avaria: ${posicao}`
    if (deAvaria && !refs.has(f.avaria_ref as string)) return `Foto de avaria sem avaria: ${posicao}`
  }

  for (const a of avarias) {
    const daAvaria = entradas.filter(([, f]) => f.avaria_ref === a.ref)
    const peca = daAvaria.some(([p, f]) => tipoDaFoto(p, f) === 'avaria_peca')
    const dano = daAvaria.some(([p, f]) => tipoDaFoto(p, f) === 'avaria_dano')
    if (!peca || !dano) {
      const falta = [!peca && 'foto da peça', !dano && 'foto da avaria'].filter(Boolean).join(', ')
      return `Avaria (${a.peca}): falta ${falta}`
    }
  }
  return null
}
