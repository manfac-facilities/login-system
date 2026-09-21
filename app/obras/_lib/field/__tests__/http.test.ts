/**
 * Testes do transporte HTTP: cabeçalhos, montagem de query, espaçamento e a
 * política de erro (429 com backoff, 422 sem repetição).
 *
 * NENHUM TESTE DESTA PASTA TOCA A REDE. O `fetch` é sempre injetado — não é
 * `global.fetch = jest.fn()`, é parâmetro. Se um dia alguém apagar a injeção, o
 * teste quebra em vez de sair batendo em `carchost.fieldcontrol.com.br`.
 */

import { criarHttpField, montarQ } from '../http'
import { ErroDaApiField, ErroDeParametroInvalido, ErroDeRateLimit } from '../erros'

/** Relógio de mentira compartilhado pelo limitador e pelo backoff. */
function relogioVirtual(inicio = 0) {
  let t = inicio
  return {
    agora: () => t,
    dormir: async (ms: number) => {
      t += ms
    },
  }
}

type RespostaFalsa = {
  status: number
  headers: { get(nome: string): string | null }
  json(): Promise<unknown>
  text(): Promise<string>
}

function resposta(status: number, corpo: unknown, cabecalhos: Record<string, string> = {}): RespostaFalsa {
  return {
    status,
    headers: {
      get: (nome: string) => cabecalhos[nome.toLowerCase()] ?? null,
    },
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  }
}

/** `fetch` de mentira que devolve as respostas na ordem e guarda as chamadas. */
function fetchFalso(...respostas: RespostaFalsa[]) {
  const chamadas: Array<{ url: string; init: { method?: string; headers?: Record<string, string> } }> = []
  let i = 0
  const buscar = async (url: string, init: { method?: string; headers?: Record<string, string> }) => {
    chamadas.push({ url, init })
    const r = respostas[Math.min(i, respostas.length - 1)]
    i += 1
    return r
  }
  return { buscar, chamadas }
}

const CHAVE = 'chave-de-teste-sem-valor-real'

describe('montarQ', () => {
  it('usa aspas na igualdade, como no exemplo da documentação', () => {
    expect(montarQ([{ campo: 'service_id', valor: 'MTox' }])).toBe('service_id:"MTox"')
  })

  it('põe o operador ANTES dos dois-pontos e sem aspas, como a doc mostra em created_at', () => {
    expect(montarQ([{ campo: 'updated_at', operador: '>=', valor: '2026-09-01' }])).toBe(
      'updated_at>=:2026-09-01',
    )
  })

  it('separa múltiplos filtros por espaço dentro do mesmo q', () => {
    expect(
      montarQ([
        { campo: 'service_id', valor: 'MTox' },
        { campo: 'updated_at', operador: '>=', valor: '2026-09-01' },
      ]),
    ).toBe('service_id:"MTox" updated_at>=:2026-09-01')
  })
})

describe('criarHttpField', () => {
  it('manda X-Api-Key e User-Agent em toda requisição', async () => {
    const rede = fetchFalso(resposta(200, { items: [], totalCount: 0 }))
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    await http.get('/orders')

    expect(rede.chamadas[0].init.headers).toMatchObject({
      'X-Api-Key': CHAVE,
      'User-Agent': expect.stringContaining('Manfac'),
    })
  })

  it('monta a URL com q, limit, offset e sort', async () => {
    const rede = fetchFalso(resposta(200, { items: [], totalCount: 0 }))
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    await http.get('/orders', { q: 'service_id:"MTox"', limit: 100, offset: 200, sort: 'id' })

    const url = new URL(rede.chamadas[0].url)
    expect(url.origin + url.pathname).toBe('https://carchost.fieldcontrol.com.br/orders')
    expect(url.searchParams.get('q')).toBe('service_id:"MTox"')
    expect(url.searchParams.get('limit')).toBe('100')
    expect(url.searchParams.get('offset')).toBe('200')
    expect(url.searchParams.get('sort')).toBe('id')
  })

  it('omite os parâmetros que não foram informados', async () => {
    const rede = fetchFalso(resposta(200, {}))
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    await http.get('/services')

    expect(rede.chamadas[0].url).toBe('https://carchost.fieldcontrol.com.br/services')
  })

  it('devolve o corpo já desembrulhado do JSON', async () => {
    const rede = fetchFalso(resposta(200, { items: [{ id: 'a' }], totalCount: 1 }))
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    await expect(http.get('/orders')).resolves.toEqual({ items: [{ id: 'a' }], totalCount: 1 })
  })

  it('espaça duas requisições em 1 segundo — o transporte inteiro passa pelo limitador', async () => {
    const relogio = relogioVirtual()
    const rede = fetchFalso(resposta(200, {}))
    const instantes: number[] = []
    const buscar = async (url: string, init: { method?: string; headers?: Record<string, string> }) => {
      instantes.push(relogio.agora())
      return rede.buscar(url, init)
    }
    const http = criarHttpField({ chaveApi: CHAVE, buscar, ...relogio })

    await Promise.all([http.get('/orders'), http.get('/orders'), http.get('/services')])

    expect(instantes).toEqual([0, 1000, 2000])
  })

  it('repete depois de um 429 e devolve o resultado da tentativa que deu certo', async () => {
    const rede = fetchFalso(resposta(429, { message: 'Too many requests' }), resposta(200, { totalCount: 7 }))
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    await expect(http.get('/orders')).resolves.toEqual({ totalCount: 7 })
    expect(rede.chamadas).toHaveLength(2)
  })

  it('espera o backoff exponencial entre as repetições de 429', async () => {
    const relogio = relogioVirtual()
    const instantes: number[] = []
    const rede = fetchFalso(resposta(429, {}), resposta(429, {}), resposta(200, {}))
    const buscar = async (url: string, init: { method?: string; headers?: Record<string, string> }) => {
      instantes.push(relogio.agora())
      return rede.buscar(url, init)
    }
    const http = criarHttpField({ chaveApi: CHAVE, buscar, backoffBaseMs: 2000, ...relogio })

    await http.get('/orders')

    // 0 → espera 2s de backoff (já cobre o 1s do limitador) → 2000
    //   → espera 4s                                        → 6000
    expect(instantes).toEqual([0, 2000, 6000])
  })

  it('respeita Retry-After quando o servidor mandar um, mesmo não sendo documentado', async () => {
    const relogio = relogioVirtual()
    const instantes: number[] = []
    const rede = fetchFalso(resposta(429, {}, { 'retry-after': '5' }), resposta(200, {}))
    const buscar = async (url: string, init: { method?: string; headers?: Record<string, string> }) => {
      instantes.push(relogio.agora())
      return rede.buscar(url, init)
    }
    const http = criarHttpField({ chaveApi: CHAVE, buscar, backoffBaseMs: 2000, ...relogio })

    await http.get('/orders')

    expect(instantes).toEqual([0, 5000])
  })

  it('limita Retry-After excessivo para não paralisar vários ciclos de sincronização', async () => {
    const relogio = relogioVirtual()
    const instantes: number[] = []
    const rede = fetchFalso(resposta(429, {}, { 'retry-after': '3600' }), resposta(200, {}))
    const buscar = async (url: string, init: { method?: string; headers?: Record<string, string> }) => {
      instantes.push(relogio.agora())
      return rede.buscar(url, init)
    }
    const http = criarHttpField({ chaveApi: CHAVE, buscar, ...relogio })

    await http.get('/orders')

    expect(instantes).toEqual([0, 30_000])
  })

  it('desiste depois do teto de repetições e lança ErroDeRateLimit', async () => {
    const rede = fetchFalso(resposta(429, {}))
    const http = criarHttpField({
      chaveApi: CHAVE,
      buscar: rede.buscar,
      repeticoesEm429: 2,
      ...relogioVirtual(),
    })

    await expect(http.get('/orders')).rejects.toBeInstanceOf(ErroDeRateLimit)
    expect(rede.chamadas).toHaveLength(3) // a original + 2 repetições
  })

  it('lança ErroDeParametroInvalido no 422 e NÃO repete — repetir parâmetro inválido só queima o limite', async () => {
    const rede = fetchFalso(resposta(422, { message: 'limit deve ser <= 100', field: 'limit' }))
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    await expect(http.get('/orders', { limit: 500 })).rejects.toBeInstanceOf(ErroDeParametroInvalido)
    expect(rede.chamadas).toHaveLength(1)
  })

  it('guarda status e corpo no erro para quem for depurar', async () => {
    const rede = fetchFalso(resposta(401, { message: 'chave inválida' }))
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    const erro = await http.get('/orders').catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ErroDaApiField)
    expect((erro as ErroDaApiField).status).toBe(401)
    expect((erro as ErroDaApiField).corpo).toEqual({ message: 'chave inválida' })
  })

  it('não deixa a chave da API vazar na mensagem do erro', async () => {
    const rede = fetchFalso(resposta(500, { message: 'boom' }))
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    const erro = await http.get('/orders').catch((e: unknown) => e)

    expect(String(erro)).not.toContain(CHAVE)
  })
})

describe('criarHttpField — bordas do corpo e da URL', () => {
  it('não morre quando o corpo do erro não é JSON válido', async () => {
    const rede = fetchFalso({
      status: 500,
      headers: { get: () => null },
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      },
      text: async () => 'Gateway timeout',
    })
    const http = criarHttpField({ chaveApi: CHAVE, buscar: rede.buscar, ...relogioVirtual() })

    const erro = await http.get('/orders').catch((e: unknown) => e)

    expect((erro as ErroDaApiField).corpo).toBe('Gateway timeout')
  })

  it('aceita baseUrl com barra no fim sem gerar // no caminho', async () => {
    const rede = fetchFalso(resposta(200, {}))
    const http = criarHttpField({
      chaveApi: CHAVE,
      baseUrl: 'https://exemplo.invalido/',
      buscar: rede.buscar,
      ...relogioVirtual(),
    })

    await http.get('/orders')

    expect(rede.chamadas[0].url).toBe('https://exemplo.invalido/orders')
  })
})
