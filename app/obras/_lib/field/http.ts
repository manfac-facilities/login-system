/**
 * Transporte HTTP da API do Field Control: autenticação, montagem de query,
 * espaçamento de 1 req/s e política de erro.
 *
 * TODA chamada à API passa por aqui. É de propósito: o limitador só garante o
 * ritmo se ninguém tiver um atalho para o `fetch`. Se um dia aparecer um
 * `fetch(` solto em outro arquivo desta pasta, o rate limit deixou de valer.
 *
 * Base documentada: https://carchost.fieldcontrol.com.br
 * (docs/cliente/2026-08-31-sistema-controle-de-obras/api-field-control-levantamento.md)
 */

import { criarLimitador, type Limitador } from './limitador'
import { ErroDaApiField, ErroDeParametroInvalido, ErroDeRateLimit } from './erros'

export const BASE_URL_FIELD = 'https://carchost.fieldcontrol.com.br'

/**
 * A doc exige `User-Agent` em TODA requisição: sem ele, a chamada "pode
 * disparar regras que bloqueiam bots ou tráfego não autenticado". O valor
 * identifica quem somos, para o suporte do Field conseguir achar a origem do
 * tráfego se um dia precisar.
 */
export const USER_AGENT_PADRAO = 'ManfacHubObras/1.0 (+https://hub.manfac.com.br)'
const ESPERA_MAXIMA_429_MS = 30_000

/**
 * Forma mínima de resposta de que precisamos. Declarada estruturalmente para o
 * `fetch` real do Node servir sem adaptador, e para o teste poder devolver um
 * objeto de três campos em vez de fabricar um `Response`.
 */
export type RespostaHttp = {
  status: number
  headers: { get(nome: string): string | null }
  json(): Promise<unknown>
  text(): Promise<string>
}

export type BuscarHttp = (
  url: string,
  init: { method: string; headers: Record<string, string> },
) => Promise<RespostaHttp>

/** Operadores de comparação aceitos pelo `q`, conforme a tabela de filtros. */
export type OperadorQ = '>=' | '<=' | '>' | '<'

export type FiltroQ = {
  campo: string
  operador?: OperadorQ
  valor: string
}

/**
 * Monta o valor do parâmetro `q`.
 *
 * A sintaxe é literal da documentação e tem uma assimetria que parece erro de
 * digitação mas não é: igualdade vai com aspas (`service_id:"MTox"`) e
 * comparação vai com o operador ANTES dos dois-pontos e SEM aspas
 * (`created_at>=:2024-02-01`). Copiado dos dois exemplos oficiais; não
 * "corrija" isso sem testar com a chave real.
 */
export function montarQ(filtros: FiltroQ[]): string {
  return filtros
    .map((f) => (f.operador ? `${f.campo}${f.operador}:${f.valor}` : `${f.campo}:"${f.valor}"`))
    .join(' ')
}

export type ParametrosDeBusca = {
  q?: string
  limit?: number
  offset?: number
  sort?: string
}

export type OpcoesDoHttp = {
  /** Chave estática do header `X-Api-Key`. Quem a fornece é quem chama. */
  chaveApi: string
  baseUrl?: string
  userAgent?: string
  /** Injeção do `fetch`. Em teste, sempre um dublê — nunca a rede. */
  buscar?: BuscarHttp
  /** Limitador compartilhado. Se não vier, cada cliente cria o seu. */
  limitador?: Limitador
  agora?: () => number
  dormir?: (ms: number) => Promise<void>
  /** Quantas vezes REPETIR depois de um 429. Padrão 3. */
  repeticoesEm429?: number
  /** Primeira espera de backoff, em ms. Padrão 2000. */
  backoffBaseMs?: number
}

export type HttpField = {
  get<T>(caminho: string, parametros?: ParametrosDeBusca): Promise<T>
}

function dormirDeVerdade(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** `Retry-After` em segundos, quando existir e for um número são. */
function retryAfterMs(resposta: RespostaHttp): number | null {
  const bruto = resposta.headers.get('retry-after')
  if (!bruto) return null
  const segundos = Number(bruto)
  if (!Number.isFinite(segundos) || segundos < 0) return null
  return segundos * 1000
}

/** Corpo de erro é "melhor esforço": 4xx/5xx nem sempre devolve JSON válido. */
async function corpoDe(resposta: RespostaHttp): Promise<unknown> {
  try {
    return await resposta.json()
  } catch {
    try {
      return await resposta.text()
    } catch {
      return null
    }
  }
}

export function criarHttpField(opcoes: OpcoesDoHttp): HttpField {
  const baseUrl = (opcoes.baseUrl ?? BASE_URL_FIELD).replace(/\/+$/, '')
  const userAgent = opcoes.userAgent ?? USER_AGENT_PADRAO
  const dormir = opcoes.dormir ?? dormirDeVerdade
  const repeticoesEm429 = opcoes.repeticoesEm429 ?? 3
  const backoffBaseMs = opcoes.backoffBaseMs ?? 2000

  const buscar: BuscarHttp =
    opcoes.buscar ??
    ((url, init) => fetch(url, init) as unknown as Promise<RespostaHttp>)

  const limitador =
    opcoes.limitador ?? criarLimitador({ intervaloMs: 1000, agora: opcoes.agora, dormir })

  /**
   * POR QUE A QUERY É MONTADA À MÃO, e não com `url.searchParams.set`:
   * `URLSearchParams` serializa espaço como `+`, e `+` só significa espaço em
   * `application/x-www-form-urlencoded` — que é regra de CORPO de formulário,
   * não de query string. Um servidor que decodifique a query com
   * `decodeURIComponent` recebe um `+` literal, e o filtro composto
   * (`service_id:"..." updated_at>=:...`) chega quebrado. O modo de falhar é o
   * pior possível: em vez de erro, o servidor pode simplesmente IGNORAR o
   * filtro e devolver tudo — varredura silenciosamente errada.
   *
   * `encodeURIComponent` gera `%20`, que é inequívoco nos dois contextos. A
   * documentação do Field mostra o `q` cru (`?q=service_id:"MTox"`) sem dizer
   * como decodifica, então escolhemos a codificação que não depende de saber.
   */
  function montarUrl(caminho: string, parametros: ParametrosDeBusca): string {
    const partes: string[] = []
    if (parametros.q) partes.push(`q=${encodeURIComponent(parametros.q)}`)
    if (parametros.limit !== undefined) partes.push(`limit=${parametros.limit}`)
    if (parametros.offset !== undefined) partes.push(`offset=${parametros.offset}`)
    if (parametros.sort) partes.push(`sort=${encodeURIComponent(parametros.sort)}`)

    const url = new URL(baseUrl + caminho)
    url.search = partes.join('&')
    return url.toString()
  }

  async function get<T>(caminho: string, parametros: ParametrosDeBusca = {}): Promise<T> {
    const url = montarUrl(caminho, parametros)
    // Contexto do erro é o CAMINHO, nunca a URL inteira: a query pode carregar
    // filtro com dado do cliente, e mensagem de erro costuma virar log.
    const contexto = caminho

    let tentativa = 0
    for (;;) {
      const resposta = await limitador.enfileirar(() =>
        buscar(url, {
          method: 'GET',
          headers: {
            'X-Api-Key': opcoes.chaveApi,
            'User-Agent': userAgent,
            Accept: 'application/json',
          },
        }),
      )

      if (resposta.status >= 200 && resposta.status < 300) {
        return (await resposta.json()) as T
      }

      if (resposta.status === 429) {
        const corpo = await corpoDe(resposta)
        if (tentativa >= repeticoesEm429) {
          throw new ErroDeRateLimit(corpo, contexto, tentativa + 1)
        }
        /**
         * BACKOFF ESCOLHIDO: exponencial 2 s → 4 s → 8 s, com teto de 3
         * repetições (~14 s no pior caso).
         *
         * POR QUE 2 s de base e não 1 s: 1 s é exatamente a janela que acabou
         * de nos recusar. Voltar nela é apostar que a janela é fixa e que o
         * relógio do servidor concorda com o nosso — duas coisas que a
         * documentação não promete (ela não documenta `Retry-After`, burst,
         * nem se o limite é por chave ou por conta). 2 s dá uma janela inteira
         * de folga.
         * POR QUE EXPONENCIAL: 429 repetido significa que há OUTRO consumidor
         * na mesma chave; insistir no mesmo ritmo só prolonga a disputa.
         * POR QUE TETO E NÃO INFINITO: uma varredura que nunca desiste trava
         * sem ninguém ficar sabendo. Melhor falhar alto e ser reagendada.
         *
         * Se um dia vier `Retry-After`, ele ganha do nosso palpite até 30 s.
         * Acima disso, a sincronização não pode bloquear vários ciclos.
         */
        const esperaMs = Math.min(
          retryAfterMs(resposta) ?? backoffBaseMs * 2 ** tentativa,
          ESPERA_MAXIMA_429_MS,
        )
        await dormir(esperaMs)
        tentativa += 1
        continue
      }

      const corpo = await corpoDe(resposta)
      if (resposta.status === 422) throw new ErroDeParametroInvalido(corpo, contexto)
      throw new ErroDaApiField(resposta.status, corpo, contexto)
    }
  }

  return { get }
}
