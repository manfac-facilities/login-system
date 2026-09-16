/**
 * Testes do ponto de variação da "loja".
 *
 * O QUE ESTE ARQUIVO DEFENDE: que as DUAS estratégias funcionam e que trocar
 * entre elas é configuração, não reescrita. O padrão ('localizacao', escolha do
 * cliente em 16/09/2026) é defendido em `cliente.test.ts`.
 */

import { criarResolvedorDeLoja, textoDoEndereco } from '../loja'
import type { HttpField } from '../http'
import type { OrdemField } from '../tipos'

/** `HttpField` de mentira que registra os caminhos pedidos. */
function httpFalso(porCaminho: Record<string, unknown>) {
  const caminhos: string[] = []
  const http: HttpField = {
    get: async <T,>(caminho: string): Promise<T> => {
      caminhos.push(caminho)
      return porCaminho[caminho] as T
    },
  }
  return { http, caminhos }
}

function ordem(over: Partial<OrdemField> = {}): OrdemField {
  return {
    id: 'MTox',
    identifier: '0226-014989',
    description: 'Forro do estoque caiu',
    customer: { id: 'cli-1' },
    location: { id: 'loc-1' },
    address: {
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    ...over,
  }
}

describe('textoDoEndereco', () => {
  it('monta logradouro, bairro e cidade/UF', () => {
    expect(
      textoDoEndereco({
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      }),
    ).toBe('Av. Paulista, 1000 - Bela Vista - São Paulo/SP')
  })

  it('não deixa buraco quando um pedaço do endereço falta', () => {
    expect(textoDoEndereco({ street: 'Rua das Flores', city: 'Santos', state: 'SP' })).toBe(
      'Rua das Flores - Santos/SP',
    )
  })

  it('trata string vazia e espaço em branco como ausência', () => {
    expect(textoDoEndereco({ street: '  ', number: '', city: 'Santos', state: 'SP' })).toBe('Santos/SP')
  })

  it('aceita número vindo como number, que é como a API às vezes manda', () => {
    expect(textoDoEndereco({ street: 'Rua A', number: 12 })).toBe('Rua A, 12')
  })

  it('devolve null quando não sobra nada de endereço', () => {
    expect(textoDoEndereco(null)).toBeNull()
    expect(textoDoEndereco({})).toBeNull()
  })
})

describe('criarResolvedorDeLoja — estratégia "endereco"', () => {
  it('usa o address embutido e NÃO faz chamada nenhuma', async () => {
    const rede = httpFalso({})
    const resolver = criarResolvedorDeLoja('endereco', rede.http)

    await expect(resolver(ordem())).resolves.toBe('Av. Paulista, 1000 - Bela Vista - São Paulo/SP')
    expect(rede.caminhos).toEqual([])
  })

  it('devolve null quando a OS veio sem endereço', async () => {
    const rede = httpFalso({})
    const resolver = criarResolvedorDeLoja('endereco', rede.http)

    await expect(resolver(ordem({ address: null }))).resolves.toBeNull()
  })
})

describe('criarResolvedorDeLoja — estratégia "localizacao"', () => {
  it('busca o nome da localização do cliente', async () => {
    const rede = httpFalso({ '/customers/cli-1/locations/loc-1': { id: 'loc-1', name: 'DP BAIRRO DE FATIMA' } })
    const resolver = criarResolvedorDeLoja('localizacao', rede.http)

    await expect(resolver(ordem())).resolves.toBe('DP BAIRRO DE FATIMA')
    expect(rede.caminhos).toEqual(['/customers/cli-1/locations/loc-1'])
  })

  it('guarda a localização em cache — duas OS da mesma loja custam UMA chamada', async () => {
    const rede = httpFalso({ '/customers/cli-1/locations/loc-1': { id: 'loc-1', name: 'DP BAIRRO DE FATIMA' } })
    const resolver = criarResolvedorDeLoja('localizacao', rede.http)

    await resolver(ordem({ identifier: 'A' }))
    await resolver(ordem({ identifier: 'B' }))

    expect(rede.caminhos).toHaveLength(1)
  })

  it('devolve null, sem chamada, quando a OS não tem location — e NÃO cai no endereço', async () => {
    const rede = httpFalso({})
    const resolver = criarResolvedorDeLoja('localizacao', rede.http)

    await expect(resolver(ordem({ location: null }))).resolves.toBeNull()
    expect(rede.caminhos).toEqual([])
  })

  it('devolve null quando falta o customer, porque a URL da localização não existe sem ele', async () => {
    const rede = httpFalso({})
    const resolver = criarResolvedorDeLoja('localizacao', rede.http)

    await expect(resolver(ordem({ customer: null }))).resolves.toBeNull()
    expect(rede.caminhos).toEqual([])
  })

  it('devolve null quando a localização existe mas veio sem nome', async () => {
    const rede = httpFalso({ '/customers/cli-1/locations/loc-1': { id: 'loc-1', name: null } })
    const resolver = criarResolvedorDeLoja('localizacao', rede.http)

    await expect(resolver(ordem())).resolves.toBeNull()
  })
it('falha na chamada da localização devolve null sem derrubar — e sem cache, para tentar de novo', async () => {
    const caminhos: string[] = []
    let falhar = true
    const http: HttpField = {
      get: async <T,>(caminho: string): Promise<T> => {
        caminhos.push(caminho)
        if (falhar) throw new Error('404 localização apagada')
        return { id: 'loc-1', name: 'DP LEBLON 6' } as T
      },
    }
    const resolver = criarResolvedorDeLoja('localizacao', http)

    await expect(resolver(ordem())).resolves.toBeNull()
    falhar = false
    await expect(resolver(ordem())).resolves.toBe('DP LEBLON 6')
    expect(caminhos).toHaveLength(2)
  })
})

