import {
  PECAS_AVARIA,
  TETO_FOTOS,
  cabeMaisFoto,
  contarFotos,
  ehPecaValida,
  ehTamanhoValido,
  posicaoAvaria,
  posicaoExtra,
  rotuloTamanho,
  validarAvariaRascunho,
} from '../fotosChecklist'

describe('contarFotos e teto', () => {
  it('soma obrigatórias, interna, extras e fotos de avaria', () => {
    expect(
      contarFotos({
        obrigatorias: 4,
        interna: 1,
        extras: 3,
        avarias: [
          { fotosPeca: 1, fotosDano: 2 },
          { fotosPeca: [1, 2], fotosDano: [1] },
        ],
      })
    ).toBe(4 + 1 + 3 + 3 + 3)
  })
  it('teto é 30: com 29 cabe mais uma, com 30 não', () => {
    expect(TETO_FOTOS).toBe(30)
    expect(cabeMaisFoto(29)).toBe(true)
    expect(cabeMaisFoto(30)).toBe(false)
  })
})

describe('validarAvariaRascunho', () => {
  it('tudo faltando lista na ordem do mockup', () => {
    expect(validarAvariaRascunho({ peca: '', tamanho: '', fotosPeca: 0, fotosDano: 0 })).toBe(
      'Falta: peça, tamanho, foto da peça, foto da avaria'
    )
  })
  it('só a foto da avaria faltando', () => {
    expect(validarAvariaRascunho({ peca: 'Retrovisor', tamanho: 'media', fotosPeca: [1], fotosDano: [] })).toBe(
      'Falta: foto da avaria'
    )
  })
  it('tamanho fora da lista conta como faltando', () => {
    expect(validarAvariaRascunho({ peca: 'Retrovisor', tamanho: 'enorme', fotosPeca: 1, fotosDano: 1 })).toBe(
      'Falta: tamanho'
    )
  })
  it('completa → null', () => {
    expect(validarAvariaRascunho({ peca: 'Retrovisor', tamanho: 'grande', fotosPeca: 1, fotosDano: 1 })).toBeNull()
  })
})

describe('listas e posições', () => {
  it('9 peças do mockup e validação', () => {
    expect(PECAS_AVARIA).toHaveLength(9)
    expect(ehPecaValida('Para-brisa')).toBe(true)
    expect(ehPecaValida('Capô')).toBe(false)
    expect(ehTamanhoValido('media')).toBe(true)
    expect(ehTamanhoValido('média')).toBe(false)
    expect(rotuloTamanho('pequena')).toBe('Pequena (até 5 cm)')
    expect(rotuloTamanho(null)).toBe('tamanho não informado')
  })
  it('posições gravadas', () => {
    expect(posicaoExtra(2)).toBe('Extra 2')
    expect(posicaoAvaria(1, 'peca', 1)).toBe('Avaria 1 peça 1')
    expect(posicaoAvaria(2, 'dano', 3)).toBe('Avaria 2 dano 3')
  })
})
