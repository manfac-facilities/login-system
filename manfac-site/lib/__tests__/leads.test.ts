import { validarEtapa1, TEXTO_CONSENTIMENTO } from '../leads'

const valido = {
  path: 'Obra ou reforma' as const,
  nome: 'Maria Souza',
  email: 'maria@empresa.com.br',
  telefone: '(21) 99999-0000',
  consentimento: true,
}

describe('validarEtapa1', () => {
  it('aceita um lead completo', () => {
    expect(validarEtapa1(valido)).toEqual({ ok: true })
  })

  it('rejeita sem consentimento — é o que dá sentido ao checkbox', () => {
    const r = validarEtapa1({ ...valido, consentimento: false })
    expect(r.ok).toBe(false)
  })

  it('rejeita nome vazio ou só espaços', () => {
    expect(validarEtapa1({ ...valido, nome: '   ' }).ok).toBe(false)
  })

  it('rejeita e-mail sem formato plausível', () => {
    expect(validarEtapa1({ ...valido, email: 'maria@' }).ok).toBe(false)
    expect(validarEtapa1({ ...valido, email: 'maria.empresa.com' }).ok).toBe(false)
  })

  it('rejeita telefone com poucos dígitos', () => {
    expect(validarEtapa1({ ...valido, telefone: '9999' }).ok).toBe(false)
  })

  it('aceita telefone com qualquer pontuação, contando só dígitos', () => {
    expect(validarEtapa1({ ...valido, telefone: '+55 21 9 9999-0000' }).ok).toBe(true)
  })

  it('devolve mensagem em português quando falha', () => {
    const r = validarEtapa1({ ...valido, consentimento: false })
    // Comparação explícita (não só `if (r.ok)`): sem strictNullChecks neste
    // tsconfig, o narrowing por truthiness do discriminante não estreita o
    // tipo — `=== true` é a forma que o compilador realmente estreita aqui.
    if (r.ok === true) throw new Error('deveria ter falhado')
    expect(r.erro.length).toBeGreaterThan(10)
  })

  it('expõe o texto de consentimento aprovado', () => {
    expect(TEXTO_CONSENTIMENTO).toContain('Autorizo a Manfac Engenharia')
  })
})
