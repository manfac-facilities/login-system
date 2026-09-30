/**
 * O NOME DO CLIENTE da OS ("DPSP", "D1000") — spec de 29/09/2026,
 * `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-cliente-da-obra-2026-09-29.md`.
 *
 * Na listagem de `/orders` o cliente vem só como `customer.id`; o nome custa
 * `GET /customers/:id` (formato conferido na API real em 29/09/2026: o corpo
 * traz `name` no nível raiz). Mesmo padrão de `loja.ts`: a chamada passa pelo
 * `HttpField`, então entra na fila de 1 req/s, e o cache por id faz a
 * varredura custar UMA chamada por cliente distinto — hoje são ~4 na conta.
 */

import type { HttpField } from './http'
import type { CadastroDeClienteField, OrdemField } from './tipos'

/** Recebe a OS crua e devolve o nome do cliente, ou `null` se não der para saber. */
export type ResolvedorDeCliente = (ordem: OrdemField) => Promise<string | null>

export function criarResolvedorDeCliente(http: HttpField): ResolvedorDeCliente {
  /** Cache por id do cliente, vivo enquanto o cliente HTTP viver. `null` também fica. */
  const cache = new Map<string, string | null>()

  return async (ordem) => {
    const idCliente = ordem.customer?.id
    if (!idCliente) return null

    const emCache = cache.get(idCliente)
    if (emCache !== undefined) return emCache

    let cliente: CadastroDeClienteField | null
    try {
      cliente = await http.get<CadastroDeClienteField>(`/customers/${idCliente}`)
    } catch {
      // Igual à loja: falha não derruba a varredura e NÃO entra no cache. A
      // sincronização preenche campo vazio, então a próxima rodada tenta de novo.
      return null
    }
    const nome = typeof cliente?.name === 'string' && cliente.name.trim() !== '' ? cliente.name.trim() : null
    cache.set(idCliente, nome)
    return nome
  }
}
