import { formatarData, linkWhatsApp, estaCompleto } from '../formato'

describe('formatarData', () => {
  it('formata em pt-BR com hora, no fuso de São Paulo', () => {
    // 17:32 UTC = 14:32 em America/Sao_Paulo (UTC-3). Um toMatch genérico de
    // dígitos passaria igual se o timeZone sumisse e a hora saísse errada.
    expect(formatarData('2026-08-21T17:32:00.000Z')).toBe('21/08/2026 14:32')
  })
})

describe('linkWhatsApp', () => {
  it('tira a pontuação do telefone', () => {
    expect(linkWhatsApp('(21) 99999-0000')).toBe('https://wa.me/5521999990000')
  })

  it('não duplica o 55 quando já vem no número', () => {
    expect(linkWhatsApp('+55 21 99999-0000')).toBe('https://wa.me/5521999990000')
  })

  it('não confunde o DDD 55 (Santa Maria/RS) com o código do país', () => {
    expect(linkWhatsApp('(55) 99999-0000')).toBe('https://wa.me/5555999990000')
  })
})

describe('estaCompleto', () => {
  it('lead com etapa 2 é completo', () => {
    expect(estaCompleto({ etapa2_em: '2026-08-21T17:32:00.000Z' })).toBe(true)
  })

  it('lead sem etapa 2 é parcial — é o que hoje se perde', () => {
    expect(estaCompleto({ etapa2_em: null })).toBe(false)
  })
})
