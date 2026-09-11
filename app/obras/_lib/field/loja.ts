/**
 * O PONTO DE VARIAÇÃO DA "LOJA" — leia isto antes de mexer.
 *
 * O cliente pediu "localização da loja" e a API do Field Control tem DOIS
 * caminhos que respondem a esse nome. A pergunta foi feita e **ainda não foi
 * respondida** (`docs/onboarding-duda/02-FRENTES-DO-DUDA.md` §F1, e o
 * levantamento da API §3):
 *
 *   'endereco'    → o objeto `address`, que já vem embutido em `/orders`.
 *                   CUSTO ZERO: nenhuma chamada extra.
 *   'localizacao' → o `name` do recurso "Localização" do cliente. Na listagem
 *                   vem só o `id`; pegar o nome custa UMA CHAMADA POR LOJA —
 *                   caro contra o limite de 1 req/s, e por isso o cache aqui
 *                   embaixo não é otimização, é requisito.
 *
 * A ARQUITETURA NÃO ESCOLHE. As duas estratégias estão implementadas e a
 * escolha é um campo de configuração. Quando o cliente responder, a mudança é
 * de uma linha — `estrategiaDeLoja` em `cliente.ts`. Não apague a estratégia
 * perdedora junto: a resposta pode mudar quando ele vir o resultado na tela.
 *
 * UMA DECISÃO QUE TOMEI SEM A SPEC, e que precisa de revisão: na estratégia
 * 'localizacao', OS sem `location` devolve `null` — NÃO cai de volta no
 * endereço. O fallback pareceria gentil e seria pior: a coluna `loja` passaria
 * a misturar nome de loja com endereço postal, sem ninguém conseguir dizer
 * qual linha é qual. `null` é visível; dado heterogêneo em silêncio, não.
 */

import type { HttpField } from './http'
import type { EnderecoField, LocalizacaoField, OrdemField } from './tipos'

export type EstrategiaDeLoja = 'endereco' | 'localizacao'

/** Recebe a OS crua e devolve o texto da loja, ou `null` se não der para saber. */
export type ResolvedorDeLoja = (ordem: OrdemField) => Promise<string | null>

/** Texto só conta se tiver conteúdo — `''` e `'   '` são ausência, não valor. */
function pedaco(valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim()
  return texto === '' ? null : texto
}

/**
 * `address` estruturado → uma linha legível.
 *
 * O formato é `Rua, número - Bairro - Cidade/UF`, e cada pedaço some sozinho
 * quando falta, para não sobrar vírgula órfã nem `undefined` na tela de quem
 * vai ler isso depois. `zipCode`, `complement` e `coords` ficam de fora de
 * propósito: a coluna `loja` é rótulo de identificação, não endereço de entrega.
 */
export function textoDoEndereco(endereco: EnderecoField | null | undefined): string | null {
  if (!endereco) return null

  const logradouro = [pedaco(endereco.street), pedaco(endereco.number)].filter(Boolean).join(', ')
  const cidadeUf = [pedaco(endereco.city), pedaco(endereco.state)].filter(Boolean).join('/')
  const linha = [logradouro, pedaco(endereco.neighborhood), cidadeUf].filter(Boolean).join(' - ')

  return linha === '' ? null : linha
}

export function criarResolvedorDeLoja(estrategia: EstrategiaDeLoja, http: HttpField): ResolvedorDeLoja {
  if (estrategia === 'endereco') {
    return async (ordem) => textoDoEndereco(ordem.address)
  }

  /**
   * Cache por id de localização, vivo enquanto o cliente viver.
   *
   * Uma varredura de 80 OS espalhadas por 10 lojas faz 10 chamadas em vez de
   * 80 — 70 segundos a menos de relógio, no ritmo de 1 req/s. O valor `null`
   * também é cacheado: loja que não tem nome não vai passar a ter no meio da
   * mesma varredura, e reperguntar custaria o mesmo segundo.
   */
  const cache = new Map<string, string | null>()

  return async (ordem) => {
    const idLocal = ordem.location?.id
    const idCliente = ordem.customer?.id
    // Sem um dos dois não existe URL possível: o recurso mora sob o cliente.
    if (!idLocal || !idCliente) return null

    const chave = `${idCliente}/${idLocal}`
    const emCache = cache.get(chave)
    if (emCache !== undefined) return emCache

    const local = await http.get<LocalizacaoField>(`/customers/${idCliente}/locations/${idLocal}`)
    const nome = pedaco(local?.name)
    cache.set(chave, nome)
    return nome
  }
}
