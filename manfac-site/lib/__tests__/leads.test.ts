import { validarEtapa1, validarEtapa2, TEXTO_CONSENTIMENTO } from '../leads'

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

  it('rejeita path fora dos 3 caminhos válidos', () => {
    // registrarLeadAction é endpoint público não autenticado e DemandPath
    // some na compilação — sem esta checagem em runtime, dava para gravar
    // qualquer string em site_leads.path, a coluna que responde "qual
    // demanda converte mais".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = validarEtapa1({ ...valido, path: 'Qualquer coisa' as any })
    expect(r.ok).toBe(false)
  })

  it('rejeita nome acima de 120 caracteres', () => {
    expect(validarEtapa1({ ...valido, nome: 'A'.repeat(121) }).ok).toBe(false)
  })

  it('aceita nome no limite de 120 caracteres', () => {
    expect(validarEtapa1({ ...valido, nome: 'A'.repeat(120) }).ok).toBe(true)
  })

  it('rejeita e-mail acima de 254 caracteres', () => {
    const emailGigante = `${'a'.repeat(250)}@x.com`
    expect(validarEtapa1({ ...valido, email: emailGigante }).ok).toBe(false)
  })

  it('rejeita telefone acima de 30 caracteres', () => {
    expect(validarEtapa1({ ...valido, telefone: '9'.repeat(31) }).ok).toBe(false)
  })
})

describe('validarEtapa2', () => {
  it('aceita tudo vazio — a etapa inteira é opcional', () => {
    expect(validarEtapa2({})).toEqual({ ok: true })
  })

  it('aceita campos dentro do limite', () => {
    expect(
      validarEtapa2({ empresa: 'Rede X', cargo: 'Gerente', localidade: 'RJ', unidades: '51 a 200', resumo: 'ok' })
    ).toEqual({ ok: true })
  })

  it('rejeita empresa/cargo/localidade/unidades acima de 200 caracteres', () => {
    expect(validarEtapa2({ empresa: 'A'.repeat(201) }).ok).toBe(false)
    expect(validarEtapa2({ cargo: 'A'.repeat(201) }).ok).toBe(false)
    expect(validarEtapa2({ localidade: 'A'.repeat(201) }).ok).toBe(false)
    expect(validarEtapa2({ unidades: 'A'.repeat(201) }).ok).toBe(false)
  })

  it('rejeita resumo acima de 2000 caracteres', () => {
    expect(validarEtapa2({ resumo: 'A'.repeat(2001) }).ok).toBe(false)
  })

  it('aceita resumo no limite de 2000 caracteres', () => {
    expect(validarEtapa2({ resumo: 'A'.repeat(2000) }).ok).toBe(true)
  })
})
