/**
 * Testes do resolvedor do NOME DO CLIENTE da OS (spec de 29/09/2026,
 * `spec-cliente-da-obra-2026-09-29.md`). Mesmo padrão do resolvedor de loja:
 * uma chamada por cliente distinto, cache por id, falha vira `null` sem cache.
 */

import { criarResolvedorDeCliente } from '../cliente-da-obra'
import type { HttpField } from '../http'
import type { OrdemField } from '../tipos'

function httpFalso(responder: (caminho: string) => unknown) {
  const caminhos: string[] = []
  const http: HttpField = {
    get: async <T,>(caminho: string): Promise<T> => {
      caminhos.push(caminho)
      return responder(caminho) as T
    },
  }
  return { http, caminhos }
}

function ordem(idCliente: string | null): OrdemField {
  return { id: 'o1', identifier: 'OS-1', customer: idCliente === null ? null : { id: idCliente } }
}

describe('criarResolvedorDeCliente', () => {
  it('devolve o name de GET /customers/:id', async () => {
    const rede = httpFalso(() => ({ id: 'c1', name: 'DPSP' }))
    const resolver = criarResolvedorDeCliente(rede.http)

    await expect(resolver(ordem('c1'))).resolves.toBe('DPSP')
    expect(rede.caminhos).toEqual(['/customers/c1'])
  })

  it('faz UM GET por cliente distinto na mesma varredura', async () => {
    const nomes: Record<string, string> = { '/customers/c1': 'DPSP', '/customers/c2': 'D1000' }
    const rede = httpFalso((caminho) => ({ name: nomes[caminho] }))
    const resolver = criarResolvedorDeCliente(rede.http)

    const resultado = []
    for (const id of ['c1', 'c2', 'c1', 'c1', 'c2']) resultado.push(await resolver(ordem(id)))

    expect(resultado).toEqual(['DPSP', 'D1000', 'DPSP', 'DPSP', 'D1000'])
    expect(rede.caminhos).toEqual(['/customers/c1', '/customers/c2'])
  })

  it('OS sem customer devolve null sem chamar a API', async () => {
    const rede = httpFalso(() => ({ name: 'X' }))
    const resolver = criarResolvedorDeCliente(rede.http)

    await expect(resolver(ordem(null))).resolves.toBeNull()
    expect(rede.caminhos).toEqual([])
  })

  it('nome vazio ou só espaço vira null, e fica em cache', async () => {
    const rede = httpFalso(() => ({ name: '   ' }))
    const resolver = criarResolvedorDeCliente(rede.http)

    await expect(resolver(ordem('c1'))).resolves.toBeNull()
    await expect(resolver(ordem('c1'))).resolves.toBeNull()
    expect(rede.caminhos).toHaveLength(1)
  })

  it('apara espaços do nome', async () => {
    const rede = httpFalso(() => ({ name: '  DPSP ' }))
    await expect(criarResolvedorDeCliente(rede.http)(ordem('c1'))).resolves.toBe('DPSP')
  })

  it('falha na chamada vira null SEM cache: a próxima OS do mesmo cliente tenta de novo', async () => {
    let falhar = true
    const rede = httpFalso(() => {
      if (falhar) {
        falhar = false
        throw new Error('500')
      }
      return { name: 'DPSP' }
    })
    const resolver = criarResolvedorDeCliente(rede.http)

    await expect(resolver(ordem('c1'))).resolves.toBeNull()
    await expect(resolver(ordem('c1'))).resolves.toBe('DPSP')
    expect(rede.caminhos).toHaveLength(2)
  })
})
