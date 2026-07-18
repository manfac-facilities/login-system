export interface ChecklistItens {
  lataria_ok: boolean
  vidros_ok: boolean
  pneus_ok: boolean
  combustivel_ok: boolean
  itens_internos_ok: boolean
  estepe_ok: boolean
  macaco_ok: boolean
  triangulo_ok: boolean
}

export interface ParsedChecklistInput {
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
}

/**
 * Parses the raw FormData submitted by the checklist form into a typed,
 * null-safe shape. Fields that are optional in the form (e.g. `observacoes`,
 * `motorista_id`) may legitimately be absent from FormData — `formData.get()`
 * returns `null` in that case, so every string field is read as
 * `string | null` before any string method (like `.trim()`) is called on it.
 */
export function parseChecklistFormData(formData: FormData): ParsedChecklistInput {
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
    lataria_ok: formData.get('lataria_ok') === 'true',
    vidros_ok: formData.get('vidros_ok') === 'true',
    pneus_ok: formData.get('pneus_ok') === 'true',
    combustivel_ok: formData.get('combustivel_ok') === 'true',
    itens_internos_ok: formData.get('itens_internos_ok') === 'true',
    estepe_ok: formData.get('estepe_ok') === 'true',
    macaco_ok: formData.get('macaco_ok') === 'true',
    triangulo_ok: formData.get('triangulo_ok') === 'true',
  }

  return {
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
  }
}

/**
 * Validates a parsed checklist input. Returns an error message (in Portuguese,
 * surfaced directly to the user) or `null` when the input is valid.
 */
export function validateChecklistInput(input: ParsedChecklistInput): string | null {
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
  return null
}
