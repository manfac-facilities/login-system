// app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts
import { parseChecklistFormData, validateChecklistInput, FOTO_POSICOES_OBRIGATORIAS } from '../_validation'
import type { ParsedChecklistInput } from '../_validation'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value)
  }
  return fd
}

const FOTOS_OBRIGATORIAS_JSON = JSON.stringify({
  Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
  Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
  'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
  'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
})

describe('parseChecklistFormData', () => {
  it('parses all fields from a fully-filled FormData', () => {
    const fd = buildFormData({
      id: 'checklist-1',
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
      vidros_ok: 'false',
      itens_problemas: JSON.stringify({ vidros_ok: 'trinca no para-brisa' }),
      fotos: FOTOS_OBRIGATORIAS_JSON,
    })

    const parsed = parseChecklistFormData(fd)

    expect(parsed.id).toBe('checklist-1')
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
    expect(parsed.itens.pneus_ok).toBeNull()
    expect(parsed.itens_problemas).toEqual({ vidros_ok: 'trinca no para-brisa' })
    expect(parsed.fotos.Frente.path).toBe('checklist-1/Frente-1.jpg')
  })

  it('does not throw when observacoes is absent from FormData (regression for bug #1)', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    expect(() => parseChecklistFormData(fd)).not.toThrow()
    expect(parseChecklistFormData(fd).observacoes).toBeNull()
  })

  it('treats blank observacoes as null', () => {
    const fd = buildFormData({
      id: 'checklist-1',
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
      id: 'checklist-1',
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
      id: 'checklist-1',
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

  it('treats every unanswered item as null, not false', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
    })
    const parsed = parseChecklistFormData(fd)
    expect(Object.values(parsed.itens).every((v) => v === null)).toBe(true)
  })

  it('defaults itens_problemas and fotos to empty objects when absent or malformed', () => {
    const fd = buildFormData({
      id: 'checklist-1',
      tipo: 'saida',
      equipe_id: 'e1',
      veiculo_id: 'v1',
      assinatura_motorista: 'true',
      itens_problemas: 'not json',
    })
    const parsed = parseChecklistFormData(fd)
    expect(parsed.itens_problemas).toEqual({})
    expect(parsed.fotos).toEqual({})
  })
})

describe('validateChecklistInput', () => {
  function baseInput(overrides: Partial<ParsedChecklistInput> = {}): ParsedChecklistInput {
    return {
      id: 'checklist-1',
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
      itens_problemas: {},
      fotos: {
        Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
        Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
        'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
        'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
      },
      ...overrides,
    }
  }

  it('passes for a valid saida checklist', () => {
    expect(validateChecklistInput(baseInput())).toBeNull()
  })

  it('requires id', () => {
    expect(validateChecklistInput(baseInput({ id: '' }))).toBe(
      'Erro interno: identificador do checklist ausente'
    )
  })

  it('requires tipo', () => {
    expect(validateChecklistInput(baseInput({ tipo: '' }))).toBe(
      'Tipo e veículo são obrigatórios'
    )
  })

  it('requires equipe_id', () => {
    expect(validateChecklistInput(baseInput({ equipe_id: null }))).toBe(
      'Equipe é obrigatória para este tipo de checklist'
    )
  })

  it('requires veiculo_id', () => {
    expect(validateChecklistInput(baseInput({ veiculo_id: '' }))).toBe(
      'Tipo e veículo são obrigatórios'
    )
  })

  it('requires equipe_destino_id when tipo is troca', () => {
    expect(
      validateChecklistInput(baseInput({ tipo: 'troca', equipe_destino_id: null }))
    ).toBe('Equipe de destino é obrigatória numa troca')
  })

  it('passes for troca when equipe_destino_id is present', () => {
    expect(
      validateChecklistInput(baseInput({ tipo: 'troca', equipe_destino_id: 'e2' }))
    ).toBeNull()
  })

  it('requires assinatura_motorista', () => {
    expect(validateChecklistInput(baseInput({ assinatura_motorista: false }))).toBe(
      'Confirmação do motorista é obrigatória'
    )
  })

  it('não exige equipe para recebimento', () => {
    const input = baseInput({ tipo: 'recebimento', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('não exige equipe para finalizacao_contrato', () => {
    const input = baseInput({ tipo: 'finalizacao_contrato', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('exige equipe para devolucao', () => {
    const input = baseInput({ tipo: 'devolucao', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBe('Equipe é obrigatória para este tipo de checklist')
  })

  it('aceita devolucao com equipe preenchida', () => {
    const input = baseInput({ tipo: 'devolucao', equipe_id: 'equipe-1', assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('não exige equipe de origem para troca (só equipe_destino_id)', () => {
    const input = baseInput({ tipo: 'troca', equipe_id: null, equipe_destino_id: 'equipe-2', assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('exige os 8 itens respondidos — bloqueia com 1 item ainda não respondido (achado U-02)', () => {
    const input = baseInput({ itens: { ...baseInput().itens, macaco_ok: null } })
    expect(validateChecklistInput(input)).toBe('Todos os 8 itens de verificação devem ser respondidos')
  })

  it('aceita itens todos marcados Problema (false não é "não respondido")', () => {
    const input = baseInput()
    expect(validateChecklistInput(input)).toBeNull()
  })

  it.each(FOTO_POSICOES_OBRIGATORIAS)(
    'exige a foto obrigatória "%s" (achado U-02)',
    (posicaoFaltando) => {
      const fotos = { ...baseInput().fotos }
      delete fotos[posicaoFaltando]
      const input = baseInput({ fotos })
      expect(validateChecklistInput(input)).toBe(`Fotos obrigatórias faltando: ${posicaoFaltando}`)
    }
  )

  it('não exige a foto Interna (opcional)', () => {
    const input = baseInput() // já não tem "Interna" em fotos
    expect(validateChecklistInput(input)).toBeNull()
  })
})
