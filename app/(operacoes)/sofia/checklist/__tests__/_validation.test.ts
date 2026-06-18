import { parseChecklistFormData, validateChecklistInput } from '../_validation'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value)
  }
  return fd
}

describe('parseChecklistFormData', () => {
  it('parses all fields from a fully-filled FormData', () => {
    const fd = buildFormData({
      tipo: 'troca',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      motorista_id: 'm1',
      equipe_destino_id: 'e2',
      motorista_destino_id: 'm2',
      observacoes: '  tudo certo  ',
      latitude: '-23.5',
      longitude: '-46.6',
      avaria_identificada: 'true',
      avaria_descricao: '  arranhão na porta  ',
      chave_entregue: 'true',
      cartao_combustivel_entregue: 'true',
      assinatura_motorista: 'true',
      lataria_ok: 'true',
    })

    const parsed = parseChecklistFormData(fd)

    expect(parsed.tipo).toBe('troca')
    expect(parsed.equipe_id).toBe('e1')
    expect(parsed.veiculo_id).toBe('v1')
    expect(parsed.motorista_id).toBe('m1')
    expect(parsed.equipe_destino_id).toBe('e2')
    expect(parsed.motorista_destino_id).toBe('m2')
    expect(parsed.observacoes).toBe('tudo certo')
    expect(parsed.latitude).toBe(-23.5)
    expect(parsed.longitude).toBe(-46.6)
    expect(parsed.avaria_identificada).toBe(true)
    expect(parsed.avaria_descricao).toBe('arranhão na porta')
    expect(parsed.chave_entregue).toBe(true)
    expect(parsed.cartao_combustivel_entregue).toBe(true)
    expect(parsed.assinatura_motorista).toBe(true)
    expect(parsed.itens.lataria_ok).toBe(true)
    expect(parsed.itens.vidros_ok).toBe(false)
  })

  it('does not throw when observacoes is absent from FormData (regression for bug #1)', () => {
    const fd = buildFormData({
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    // formData.get('observacoes') returns null when the field is absent.
    expect(() => parseChecklistFormData(fd)).not.toThrow()
    expect(parseChecklistFormData(fd).observacoes).toBeNull()
  })

  it('treats blank observacoes as null', () => {
    const fd = buildFormData({
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
      observacoes: '   ',
    })
    expect(parseChecklistFormData(fd).observacoes).toBeNull()
  })

  it('defaults optional relational fields to null when absent', () => {
    const fd = buildFormData({
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    const parsed = parseChecklistFormData(fd)
    expect(parsed.motorista_id).toBeNull()
    expect(parsed.equipe_destino_id).toBeNull()
    expect(parsed.motorista_destino_id).toBeNull()
    expect(parsed.latitude).toBeNull()
    expect(parsed.longitude).toBeNull()
    expect(parsed.avaria_descricao).toBeNull()
  })

  it('treats missing boolean flags as false', () => {
    const fd = buildFormData({
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    const parsed = parseChecklistFormData(fd)
    expect(parsed.avaria_identificada).toBe(false)
    expect(parsed.chave_entregue).toBe(false)
    expect(parsed.cartao_combustivel_entregue).toBe(false)
  })
})

describe('validateChecklistInput', () => {
  const base = {
    tipo: 'saida',
    equipe_id: 'e1',
    veiculo_id: 'v1',
    motorista_id: null,
    equipe_destino_id: null,
    motorista_destino_id: null,
    observacoes: null,
    latitude: null,
    longitude: null,
    avaria_identificada: false,
    avaria_descricao: null,
    chave_entregue: false,
    cartao_combustivel_entregue: false,
    assinatura_motorista: true,
    itens: {
      lataria_ok: false,
      vidros_ok: false,
      pneus_ok: false,
      combustivel_ok: false,
      itens_internos_ok: false,
      estepe_ok: false,
      macaco_ok: false,
      triangulo_ok: false,
    },
  }

  it('passes for a valid saida checklist', () => {
    expect(validateChecklistInput(base)).toBeNull()
  })

  it('requires tipo', () => {
    expect(validateChecklistInput({ ...base, tipo: '' })).toBe(
      'Tipo, equipe e veículo são obrigatórios'
    )
  })

  it('requires equipe_id', () => {
    expect(validateChecklistInput({ ...base, equipe_id: '' })).toBe(
      'Tipo, equipe e veículo são obrigatórios'
    )
  })

  it('requires veiculo_id', () => {
    expect(validateChecklistInput({ ...base, veiculo_id: '' })).toBe(
      'Tipo, equipe e veículo são obrigatórios'
    )
  })

  it('requires equipe_destino_id when tipo is troca', () => {
    expect(
      validateChecklistInput({ ...base, tipo: 'troca', equipe_destino_id: null })
    ).toBe('Equipe de destino é obrigatória numa troca')
  })

  it('passes for troca when equipe_destino_id is present', () => {
    expect(
      validateChecklistInput({ ...base, tipo: 'troca', equipe_destino_id: 'e2' })
    ).toBeNull()
  })

  it('requires assinatura_motorista', () => {
    expect(validateChecklistInput({ ...base, assinatura_motorista: false })).toBe(
      'Confirmação do motorista é obrigatória'
    )
  })
})
