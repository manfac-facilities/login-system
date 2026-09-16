/**
 * O critério de entrada da carga, em um lugar só.
 *
 * Fonte: `docs/cliente/2026-08-31-sistema-controle-de-obras/feedback-20-criterio-final-da-carga.md`
 * — fala do cliente em 15/09/2026: "puxar as atividades spot com status pendente,
 * agendado, em andamento". O João esclareceu que "status" na fala dele é a
 * SITUAÇÃO da atividade (o campo estruturado do Field), não o texto livre.
 *
 * Este critério já mudou três vezes num só dia. Por isso ele mora sozinho: mudar
 * de ideia tem que ser editar uma lista, não caçar `if` pelo código.
 */

import {
  SITUACOES_ACEITAS,
  entraNaCarga,
  motivoDaRecusa,
  nomeDaSituacao,
} from '../_criterio-de-entrada'

describe('quem entra na carga', () => {
  it('aceita exatamente as três situações que o cliente pediu', () => {
    expect([...SITUACOES_ACEITAS]).toEqual(['pending', 'scheduled', 'in-progress'])
  })

  it.each(['pending', 'scheduled', 'in-progress'])('entra: %s', (situacao) => {
    expect(entraNaCarga(situacao)).toBe(true)
  })

  it.each(['done', 'canceled', 'reported', 'on-route', 'paused'])('não entra: %s', (situacao) => {
    expect(entraNaCarga(situacao)).toBe(false)
  })

  it('não entra quando a situação não veio', () => {
    expect(entraNaCarga(null)).toBe(false)
  })

  it('não entra quando a situação é desconhecida — a API pode ganhar valores novos', () => {
    expect(entraNaCarga('em-orbita')).toBe(false)
  })

  it('não se perde com espaço ou maiúscula vindos da API', () => {
    expect(entraNaCarga('  In-Progress ')).toBe(true)
    expect(entraNaCarga('DONE')).toBe(false)
  })
})

describe('o motivo que aparece na tela', () => {
  it('diz a situação em português e o que o filtro aceita', () => {
    const motivo = motivoDaRecusa('done')
    expect(motivo).toContain('concluída')
    expect(motivo).toContain('pendente')
    expect(motivo).toContain('agendada')
    expect(motivo).toContain('em andamento')
  })

  it('distingue situação ausente de situação recusada', () => {
    expect(motivoDaRecusa(null)).toContain('sem situação')
    expect(motivoDaRecusa(null)).not.toContain('concluída')
  })

  it('mostra o valor cru quando a situação é desconhecida, para dar o que investigar', () => {
    expect(motivoDaRecusa('em-orbita')).toContain('em-orbita')
  })

  it('nunca devolve motivo vazio, seja qual for a entrada', () => {
    for (const situacao of ['done', 'canceled', 'reported', 'on-route', 'paused', 'zzz', null]) {
      expect(motivoDaRecusa(situacao).trim().length).toBeGreaterThan(10)
    }
  })
})

describe('nome da situação em português', () => {
  it.each([
    ['pending', 'pendente'],
    ['scheduled', 'agendada'],
    ['in-progress', 'em andamento'],
    ['done', 'concluída'],
    ['canceled', 'cancelada'],
    ['reported', 'reportada'],
    ['on-route', 'a caminho'],
    ['paused', 'pausada'],
  ])('%s vira %s', (situacao, esperado) => {
    expect(nomeDaSituacao(situacao)).toBe(esperado)
  })

  it('devolve o valor cru quando não conhece o nome', () => {
    expect(nomeDaSituacao('em-orbita')).toBe('em-orbita')
  })
})
