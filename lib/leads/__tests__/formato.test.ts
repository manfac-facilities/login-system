import { formatarData, linkWhatsApp, estaCompleto } from '../formato'

describe('formatarData', () => {
  it('formata em pt-BR com hora', () => {
    expect(formatarData('2026-08-21T17:32:00.000Z')).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
  })
})

describe('linkWhatsApp', () => {
  it('tira a pontuação do telefone', () => {
    expect(linkWhatsApp('(21) 99999-0000')).toBe('https://wa.me/5521999990000')
  })

  it('não duplica o 55 quando já vem no número', () => {
    expect(linkWhatsApp('+55 21 99999-0000')).toBe('https://wa.me/5521999990000')
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
