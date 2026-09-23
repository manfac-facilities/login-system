/**
 * Testes das funções puras de app/obras/_lib/ficha-campos.ts.
 *
 * Cobre a tabela §7.1 da spec
 * (docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ficha-editavel-2026-09-18.md)
 * e mais os casos de digitação real do parser de valor, que a spec cita mas não
 * tabula: `R$ 1.234,56`, `1234,5`, `1234`, vazio e texto inválido.
 *
 * Nada é mockado: ficha-campos.ts não importa React, Supabase nem process.env —
 * é o mesmo padrão de __tests__/tipos.test.ts. `hoje` é sempre passado
 * explicitamente (2026-08-31, o HOJE do mockup) para o teste não depender do
 * relógio da máquina.
 */

import {
  MOTIVOS_REMARCACAO,
  MOTIVO_OUTRO,
  ehMotivoOutro,
  moedaParaTexto,
  normalizarMotivo,
  numeroBR,
  precisaRemarcar,
  validarAutorizacao,
  validarCronograma,
  validarDataFechamentoOS,
  validarIdentificacao,
  type DadosAutorizacao,
  type DadosCronograma,
  type DadosIdentificacao,
} from '../_lib/ficha-campos'
import { BLOQUEIOS, ORIGENS, TIPOS_OBRA, entradaDaObra } from '../_lib/tipos'

const HOJE = '2026-08-31'

function aut(over: Partial<DadosAutorizacao> = {}): DadosAutorizacao {
  return { origem: '', libPor: '', libEm: '', aprovadaEm: '', ...over }
}

function ide(over: Partial<DadosIdentificacao> = {}): DadosIdentificacao {
  return { tipo: '', valor: '', analista: '', mauUso: false, ...over }
}

function cro(over: Partial<DadosCronograma> = {}): DadosCronograma {
  return { resp: '', equipe: '', prioridade: '', inicio: '', duracao: '', ...over }
}

// ============================================================
// numeroBR — o parser de valor em pt-BR
// ============================================================

describe('numeroBR', () => {
  it('converte os formatos da spec', () => {
    expect(numeroBR('18.450,00')).toBe(18450)
    expect(numeroBR('4380')).toBe(4380)
    expect(numeroBR('0,50')).toBe(0.5)
  })

  it('aguenta o que o usuário digita de verdade', () => {
    expect(numeroBR('1.234,56')).toBe(1234.56)
    expect(numeroBR('R$ 1.234,56')).toBe(1234.56)
    expect(numeroBR('r$1.234,56')).toBe(1234.56)
    expect(numeroBR('1234,5')).toBe(1234.5)
    expect(numeroBR('1234')).toBe(1234)
    expect(numeroBR('  4.380,00  ')).toBe(4380)
    expect(numeroBR('1.234.567,89')).toBe(1234567.89)
    expect(numeroBR('0')).toBe(0)
  })

  it('trata o ponto como decimal quando ele não é agrupamento de milhar válido', () => {
    // '1234.56' não é agrupamento pt-BR (o grupo depois do ponto tem 2 dígitos):
    // quem digitou queria 1234 reais e 56 centavos, não 123456 reais.
    expect(numeroBR('1234.56')).toBe(1234.56)
    expect(numeroBR('18.450')).toBe(18450) // agrupamento válido: dezoito mil
    expect(numeroBR('1.2345')).toBe(1.2345) // agrupamento inválido: ponto decimal
  })

  it('devolve null para vazio e undefined para inválido — não são a mesma coisa', () => {
    expect(numeroBR('')).toBeNull()
    expect(numeroBR('   ')).toBeNull()
    expect(numeroBR('R$')).toBeNull()
    expect(numeroBR(null)).toBeNull()
    expect(numeroBR(undefined)).toBeNull()

    expect(numeroBR('abc')).toBeUndefined()
    expect(numeroBR('-1')).toBeUndefined()
    expect(numeroBR('-5')).toBeUndefined()
    expect(numeroBR('12,34,56')).toBeUndefined()
    expect(numeroBR('12 34')).toBeUndefined()
    expect(numeroBR(',')).toBeUndefined()
    expect(numeroBR('1e3')).toBeUndefined()
  })
})

describe('moedaParaTexto', () => {
  it('formata para o input de edição, sem o R$', () => {
    expect(moedaParaTexto(18450)).toBe('18.450,00')
    expect(moedaParaTexto(0.5)).toBe('0,50')
    expect(moedaParaTexto(0)).toBe('0,00')
  })

  it('vazio vira string vazia — o input nasce em branco, nunca com "null"', () => {
    expect(moedaParaTexto(null)).toBe('')
    expect(moedaParaTexto(undefined)).toBe('')
    expect(moedaParaTexto(Number.NaN)).toBe('')
  })

  it('ida e volta não perde centavo', () => {
    for (const texto of ['18.450,00', '4.380,00', '0,50', '1.234.567,89', '999,99']) {
      expect(moedaParaTexto(numeroBR(texto))).toBe(texto)
    }
  })
})

// ============================================================
// normalizarMotivo — só para comparar, nunca para gravar
// ============================================================

describe('normalizarMotivo', () => {
  it('colapsa espaço e ignora caixa', () => {
    expect(normalizarMotivo('  Falta   de  Material ')).toBe(normalizarMotivo('falta de material'))
  })

  it('ignora acento', () => {
    expect(normalizarMotivo('Contratação')).toBe(normalizarMotivo('contratacao'))
    expect(normalizarMotivo('Contratação de prestador')).toBe('contratacao de prestador')
  })

  it('vazio e nulo viram string vazia', () => {
    expect(normalizarMotivo('')).toBe('')
    expect(normalizarMotivo(null)).toBe('')
    expect(normalizarMotivo(undefined)).toBe('')
  })

  it('a lista de motivos é a do Diário, com "Outro" no lugar de "Sem bloqueio"', () => {
    expect(MOTIVOS_REMARCACAO).toEqual([
      'Clima',
      'Cliente / loja',
      'Disponibilidade de equipe',
      'Contratação de prestador',
      'Falta de material',
      'Outro',
    ])
    // A grafia é a de BLOQUEIOS, não a do texto do mockup ("Cliente/loja").
    for (const m of MOTIVOS_REMARCACAO) {
      if (m !== MOTIVO_OUTRO) expect(BLOQUEIOS).toContain(m)
    }
    expect(MOTIVOS_REMARCACAO).not.toContain('Sem bloqueio')
  })

  it('ehMotivoOutro reconhece "Outro" sem depender de caixa', () => {
    expect(ehMotivoOutro('Outro')).toBe(true)
    expect(ehMotivoOutro(' outro ')).toBe(true)
    expect(ehMotivoOutro('Clima')).toBe(false)
    expect(ehMotivoOutro('')).toBe(false)
  })
})

// ============================================================
// validarAutorizacao
// ============================================================

describe('validarAutorizacao', () => {
  it('não acusa nada quando está tudo certo', () => {
    const e = validarAutorizacao(
      aut({ origem: 'Telefone', libPor: 'LEANDRO', libEm: '2026-08-20', aprovadaEm: '2026-08-25' }),
      { hoje: HOJE }
    )
    expect(e).toEqual({})
  })

  it('acusa data de liberação sem nome (R8)', () => {
    const e = validarAutorizacao(aut({ libEm: '2026-08-20' }), { hoje: HOJE })
    expect(e.libEm).toBe('Tem data da liberação sem nome. Escolha quem liberou ou apague a data.')
  })

  it('aceita nome sem data — a action grava hoje (R8)', () => {
    const e = validarAutorizacao(aut({ libPor: 'LEANDRO' }), { hoje: HOJE })
    expect(e).toEqual({})
  })

  it('acusa liberação e aprovação no futuro', () => {
    const e = validarAutorizacao(
      aut({ libPor: 'LEANDRO', libEm: '2026-09-01', aprovadaEm: '2026-09-01' }),
      { hoje: HOJE }
    )
    expect(e.libEm).toBe('A data da liberação não pode ser depois de hoje.')
    expect(e.aprovadaEm).toBe('A data de aprovação não pode ser depois de hoje.')
  })

  it('aceita as datas de hoje', () => {
    const e = validarAutorizacao(aut({ libPor: 'LEANDRO', libEm: HOJE, aprovadaEm: HOJE }), {
      hoje: HOJE,
    })
    expect(e).toEqual({})
  })

  it('aceita toda origem da lista e recusa a de fora (D3)', () => {
    for (const o of ORIGENS) {
      expect(validarAutorizacao(aut({ origem: o }), { hoje: HOJE })).toEqual({})
    }
    expect(validarAutorizacao(aut({ origem: 'Pombo-correio' }), { hoje: HOJE }).origem).toBe(
      'Origem inválida'
    )
  })

  it('preserva origem antiga fora da lista quando já era o valor gravado (risco 6)', () => {
    const e = validarAutorizacao(aut({ origem: 'EMAIL DPSP' }), {
      hoje: HOJE,
      origemAtual: 'EMAIL DPSP',
    })
    expect(e).toEqual({})
  })

  it('recusa data malformada em vez de comparar texto solto', () => {
    const e = validarAutorizacao(aut({ libPor: 'LEANDRO', libEm: '20/08/2026' }), { hoje: HOJE })
    expect(e.libEm).toBe('Data inválida.')
  })

  // Item 4 da revisão de 20/09: ano '0226' (dedo escorregou no '2') está no
  // formato ISO — passava direto e deixava a obra "vermelha para sempre" (o
  // cálculo de dias em aberto explode). 31 de fevereiro também está no
  // formato, mas não é uma data de calendário real — antes ia pro banco e
  // estourava lá.
  it('item 4 — recusa ano fora de faixa plausível, com mensagem amigável', () => {
    const e = validarAutorizacao(aut({ libPor: 'LEANDRO', libEm: '0226-08-20' }), { hoje: HOJE })
    expect(e.libEm).toBe('Data inválida.')
  })

  it('item 4 — recusa data de calendário inexistente (31 de fevereiro)', () => {
    const e = validarAutorizacao(aut({ libPor: 'LEANDRO', libEm: '2026-02-31' }), { hoje: HOJE })
    expect(e.libEm).toBe('Data inválida.')
  })

  it('item 4 — a mesma checagem vale para a data de aprovação', () => {
    const e = validarAutorizacao(aut({ aprovadaEm: '2026-02-30' }), { hoje: HOJE })
    expect(e.aprovadaEm).toBe('Data inválida.')
  })
})

// ============================================================
// validarIdentificacao
// ============================================================

describe('validarIdentificacao', () => {
  it('não acusa nada quando está tudo certo', () => {
    expect(validarIdentificacao(ide({ tipo: 'CIVIL', valor: '18.450,00', analista: 'LEANDRO' }))).toEqual({})
  })

  it('aceita valor vazio — campo em branco não é erro (R5)', () => {
    expect(validarIdentificacao(ide({ valor: '' }))).toEqual({})
  })

  it('recusa valor que não é número em reais', () => {
    expect(validarIdentificacao(ide({ valor: 'abc' })).valor).toBe(
      'Valor precisa ser um número em reais, como 18.450,00.'
    )
    expect(validarIdentificacao(ide({ valor: '-5' })).valor).toBe(
      'Valor precisa ser um número em reais, como 18.450,00.'
    )
  })

  it('aceita todo tipo da lista e recusa o de fora, preservando o já gravado', () => {
    for (const t of TIPOS_OBRA) {
      expect(validarIdentificacao(ide({ tipo: t }))).toEqual({})
    }
    expect(validarIdentificacao(ide({ tipo: 'MARCENARIA' })).tipo).toBe('Tipo inválido')
    expect(validarIdentificacao(ide({ tipo: 'MARCENARIA' }), { tipoAtual: 'MARCENARIA' })).toEqual({})
  })
})

// ============================================================
// validarCronograma
// ============================================================

describe('validarCronograma', () => {
  it('não acusa nada quando está tudo certo', () => {
    const e = validarCronograma(
      cro({ resp: 'YURI', equipe: 'MANFAC-7', prioridade: 'Urgente', inicio: '2026-09-17', duracao: '6' }),
      { inicioAtual: '2026-09-17' }
    )
    expect(e).toEqual({})
  })

  it('acusa duração 0 e 181, aceita 1 e 180', () => {
    const msg = 'A duração precisa ficar entre 1 e 180 dias'
    expect(validarCronograma(cro({ duracao: '0' })).duracao).toBe(msg)
    expect(validarCronograma(cro({ duracao: '181' })).duracao).toBe(msg)
    expect(validarCronograma(cro({ duracao: '1' })).duracao).toBeUndefined()
    expect(validarCronograma(cro({ duracao: '180' })).duracao).toBeUndefined()
    expect(validarCronograma(cro({ duracao: '' })).duracao).toBeUndefined()
    expect(validarCronograma(cro({ duracao: '6,5' })).duracao).toBe(msg)
    expect(validarCronograma(cro({ duracao: 'muitos' })).duracao).toBe(msg)
  })

  it('recusa prioridade fora da lista e aceita vazia', () => {
    expect(validarCronograma(cro({ prioridade: 'Altíssima' })).prioridade).toBe('Prioridade inválida')
    expect(validarCronograma(cro({ prioridade: '' })).prioridade).toBeUndefined()
    expect(validarCronograma(cro({ prioridade: 'Normal' })).prioridade).toBeUndefined()
  })

  it('exige motivo quando o início muda e havia início (R9)', () => {
    const e = validarCronograma(cro({ inicio: '2026-09-20' }), { inicioAtual: '2026-09-17' })
    expect(e.motivo).toBe('Escolha um motivo para remarcar.')
    expect(precisaRemarcar('2026-09-17', '2026-09-20')).toBe(true)
  })

  it('NÃO exige motivo quando o início estava vazio (R9)', () => {
    const e = validarCronograma(cro({ inicio: '2026-09-20' }), { inicioAtual: null })
    expect(e).toEqual({})
    expect(precisaRemarcar(null, '2026-09-20')).toBe(false)
    expect(precisaRemarcar('', '2026-09-20')).toBe(false)
  })

  it('NÃO exige motivo quando o início não mudou (R12)', () => {
    expect(validarCronograma(cro({ inicio: '2026-09-17', duracao: '9' }), { inicioAtual: '2026-09-17' })).toEqual({})
    expect(precisaRemarcar('2026-09-17', '2026-09-17')).toBe(false)
  })

  it('apagar um início que existia também é remarcação', () => {
    const e = validarCronograma(cro({ inicio: '' }), { inicioAtual: '2026-09-17' })
    expect(e.motivo).toBe('Escolha um motivo para remarcar.')
  })

  it('exige descrição com "Outro" e recusa 2 caracteres (R10)', () => {
    const base = { inicioAtual: '2026-09-17' }
    const msg = 'Descreva o outro motivo (pelo menos 3 letras).'
    expect(validarCronograma(cro({ inicio: '2026-09-20', motivo: 'Outro' }), base).detalhe).toBe(msg)
    expect(
      validarCronograma(cro({ inicio: '2026-09-20', motivo: 'Outro', detalhe: 'ab' }), base).detalhe
    ).toBe(msg)
    expect(
      validarCronograma(cro({ inicio: '2026-09-20', motivo: 'Outro', detalhe: '  a b  ' }), base).detalhe
    ).toBe(msg)
    expect(
      validarCronograma(cro({ inicio: '2026-09-20', motivo: 'Outro', detalhe: 'obra embargada' }), base)
    ).toEqual({})
  })

  it('não pede descrição para motivo que não é "Outro" (R10)', () => {
    const e = validarCronograma(cro({ inicio: '2026-09-20', motivo: 'Clima' }), {
      inicioAtual: '2026-09-17',
    })
    expect(e).toEqual({})
  })

  it('recusa início malformado', () => {
    expect(validarCronograma(cro({ inicio: '17/09/2026' })).inicio).toBe('Data inválida.')
  })

  // Item 4 da revisão de 20/09: mesma checagem de ano plausível e data de
  // calendário real vale para o início planejado, que também é `date` no
  // banco.
  it('item 4 — recusa ano fora de faixa plausível no início', () => {
    expect(validarCronograma(cro({ inicio: '0226-09-20' })).inicio).toBe('Data inválida.')
  })

  it('item 4 — recusa data de calendário inexistente no início', () => {
    expect(validarCronograma(cro({ inicio: '2026-02-31' })).inicio).toBe('Data inválida.')
  })
})

// ============================================================
// Constantes e helper acrescentados a _lib/tipos.ts
// ============================================================

describe('constantes novas de tipos.ts', () => {
  it('ORIGENS são as cinco opções provisórias da decisão D3', () => {
    expect(ORIGENS).toEqual([
      'Sistema do cliente',
      'E-mail do cliente',
      'Telefone',
      'WhatsApp',
      'Outro',
    ])
  })

  it('TIPOS_OBRA são os do mockup', () => {
    expect(TIPOS_OBRA).toEqual(['CIVIL', 'ELÉTRICA', 'HIDRÁULICA', 'PINTURA', 'SERRALHERIA', 'Outro'])
  })

  it('entradaDaObra é o dia de São Paulo do created_at (R23)', () => {
    // 23h de SP = 02h UTC do dia seguinte. A entrada é o dia de SP.
    expect(entradaDaObra({ created_at: '2026-09-11T02:30:00Z' })).toBe('2026-09-10')
    expect(entradaDaObra({ created_at: '2026-09-10T15:00:00Z' })).toBe('2026-09-10')
    expect(entradaDaObra({ created_at: '' })).toBeNull()
  })
})

describe('validarDataFechamentoOS', () => {
  const HOJE_F = '2026-09-22'
  const CTX = { hoje: HOJE_F, relatorio: '2026-09-18', aprovacao: '2026-09-20' }

  it('vazio pede a data', () => {
    expect(validarDataFechamentoOS('', CTX)).toBe('Informe a data de fechamento da OS.')
    expect(validarDataFechamentoOS('   ', CTX)).toBe('Informe a data de fechamento da OS.')
  })
  it('data que não existe no calendário é inválida', () => {
    expect(validarDataFechamentoOS('2026-02-30', CTX)).toBe('Data inválida.')
  })
  it('recusa data futura', () => {
    expect(validarDataFechamentoOS('2026-09-23', CTX)).toBe('A data não pode ser posterior a hoje.')
  })
  it('aceita hoje e a própria data de referência', () => {
    expect(validarDataFechamentoOS(HOJE_F, CTX)).toBeUndefined()
    expect(validarDataFechamentoOS('2026-09-20', CTX)).toBeUndefined()
  })
  it('caminho com desvio: a referência é a aprovação (a maior das duas)', () => {
    expect(validarDataFechamentoOS('2026-09-19', CTX)).toBe(
      'A data não pode ser anterior à aprovação da OS (20/09/2026).'
    )
  })
  it('caminho direto: OS aprovada antes do relatório — a referência é o relatório', () => {
    const direto = { hoje: HOJE_F, relatorio: '2026-09-18', aprovacao: '2026-09-14' }
    expect(validarDataFechamentoOS('2026-09-15', direto)).toBe(
      'A data não pode ser anterior ao relatório de entrega (18/09/2026).'
    )
  })
  it('sem relatório nem aprovação, só a recusa de futuro vale', () => {
    const vazio = { hoje: HOJE_F, relatorio: null, aprovacao: null }
    expect(validarDataFechamentoOS('2020-01-01', vazio)).toBeUndefined()
    expect(validarDataFechamentoOS('2026-09-23', vazio)).toBe('A data não pode ser posterior a hoje.')
  })
})
