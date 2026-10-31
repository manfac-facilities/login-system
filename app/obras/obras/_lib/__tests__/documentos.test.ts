import { montarPathDoc, nomeSaneado, pastaValida, pathDocValido, validarArquivoDoc } from '../documentos'

const OBRA = '11111111-1111-4111-8111-111111111111'
const UUID = '22222222-2222-4222-8222-222222222222'

describe('nome do arquivo', () => {
  it('troca acento, espaço e símbolo; tira diretório e ponto inicial', () => {
    expect(nomeSaneado('Projeto Elétrico (rev 2).pdf')).toBe('Projeto_Eletrico_rev_2_.pdf')
    expect(nomeSaneado('../../etc/passwd')).toBe('passwd')
    expect(nomeSaneado('C:\\x\\laudo final.PDF')).toBe('laudo_final.PDF')
    expect(nomeSaneado('.hidden.png')).toBe('hidden.png')
    expect(nomeSaneado('日本語')).toBe('arquivo')
    expect(nomeSaneado('')).toBe('arquivo')
  })
  it('nunca passa de 200 e mantém a extensão', () => {
    const n = nomeSaneado('a'.repeat(300) + '.pdf')
    expect(n).toHaveLength(200)
    expect(n.endsWith('.pdf')).toBe(true)
    expect(n).toMatch(/^[A-Za-z0-9._-]{1,200}$/)
  })
  it('o path montado casa com o formato do banco', () => {
    expect(pathDocValido(OBRA, montarPathDoc(OBRA, UUID, 'Meu Laudo.pdf'))).toBe(true)
  })
})

describe('path', () => {
  it('só da própria obra, uuid e nome limpo', () => {
    expect(pathDocValido(OBRA, `${OBRA}/${UUID}-a.pdf`)).toBe(true)
    expect(pathDocValido(OBRA, `33333333-3333-4333-8333-333333333333/${UUID}-a.pdf`)).toBe(false)
    expect(pathDocValido(OBRA, `${OBRA}/${UUID}-../a.pdf`)).toBe(false)
    expect(pathDocValido(OBRA, `${OBRA}/x-a.pdf`)).toBe(false)
    expect(pathDocValido(OBRA, 42)).toBe(false)
    expect(pathDocValido('.*', `${OBRA}/${UUID}-a.pdf`)).toBe(false)
  })
})

describe('validação do arquivo', () => {
  it('tipos e tamanho', () => {
    expect(validarArquivoDoc({ nome: 'a.pdf', tamanho: 1000 })).toBeNull()
    expect(validarArquivoDoc({ nome: 'a.JPEG', tamanho: 1000 })).toBeNull()
    expect(validarArquivoDoc({ nome: 'a.dwg', tamanho: 25 * 1024 * 1024 })).toBeNull()
    expect(validarArquivoDoc({ nome: 'a.pdf', tamanho: 25 * 1024 * 1024 + 1 })).toMatch(/25 MB/)
    expect(validarArquivoDoc({ nome: 'a.exe', tamanho: 10 })).toMatch(/Tipo não aceito/)
    expect(validarArquivoDoc({ nome: 'semextensao', tamanho: 10 })).toMatch(/Tipo não aceito/)
    expect(validarArquivoDoc({ nome: 'a.pdf', tamanho: 0 })).toMatch(/vazio/)
  })
  it('pastas fixas', () => {
    expect(pastaValida('laudos')).toBe(true)
    expect(pastaValida('fotos')).toBe(false)
  })
})
