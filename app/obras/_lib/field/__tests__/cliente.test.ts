/**
 * Testes do cliente: resolução do tipo de OS, paginação, varredura incremental
 * e normalização.
 *
 * A maioria dos casos injeta um `HttpField` de mentira, porque o assunto aqui é
 * a LÓGICA de varredura, não o transporte — esse já tem a suíte dele. O último
 * bloco fecha o circuito injetando o `fetch` em vez do http, para provar que a
 * varredura inteira (tipo de OS + páginas) respeita o 1 req/s de ponta a ponta.
 *
 * Nenhum teste desta pasta faz chamada real de rede.
 */

import { criarClienteField } from '../cliente'
import { ErroDaApiField, ErroDeTipoDeOs } from '../erros'
import type { HttpField, ParametrosDeBusca } from '../http'
import type { ListaField, OrdemField, TipoDeOsField } from '../tipos'

const CHAVE = 'chave-de-teste-sem-valor-real'

type Chamada = { caminho: string; parametros: ParametrosDeBusca }

/**
 * `HttpField` de mentira. `rotas` decide a resposta a partir do caminho e dos
 * parâmetros; `chamadas` guarda tudo, na ordem, para o teste conferir a query.
 */
function httpDeMentira(rotas: (caminho: string, parametros: ParametrosDeBusca) => unknown) {
  const chamadas: Chamada[] = []
  const http: HttpField = {
    get: async <T,>(caminho: string, parametros: ParametrosDeBusca = {}): Promise<T> => {
      chamadas.push({ caminho, parametros })
      return rotas(caminho, parametros) as T
    },
  }
  return { http, chamadas }
}

const TIPO_SPOT: TipoDeOsField = { id: 'MTox', name: 'Atividade Spot', archived: false }

function ordem(over: Partial<OrdemField> = {}): OrdemField {
  return {
    id: 'ord-1',
    identifier: '0226-014989',
    description: 'Forro do estoque caiu',
    customer: { id: 'cli-1' },
    location: { id: 'loc-1' },
    updatedAt: '2026-09-09T12:00:00Z',
    address: { street: 'Av. Paulista', number: '1000', city: 'São Paulo', state: 'SP' },
    ...over,
  }
}

/** Monta as rotas padrão: `/services` devolve o tipo Spot, `/orders` a lista dada. */
function rotasCom(ordens: OrdemField[], totalCount = ordens.length) {
  return (caminho: string, parametros: ParametrosDeBusca): unknown => {
    if (caminho === '/services') return { items: [TIPO_SPOT], totalCount: 1 }
    if (caminho === '/orders') {
      const offset = parametros.offset ?? 0
      const limit = parametros.limit ?? 100
      const pagina: ListaField<OrdemField> = { items: ordens.slice(offset, offset + limit), totalCount }
      return pagina
    }
    throw new Error(`caminho inesperado no teste: ${caminho}`)
  }
}

describe('criarClienteField — resolver o tipo de OS por nome', () => {
  it('busca o id em /services e usa como service_id no filtro de /orders', async () => {
    const rede = httpDeMentira(rotasCom([ordem()]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await cliente.listarOsNormalizadas()

    expect(rede.chamadas[0].caminho).toBe('/services')
    expect(rede.chamadas[0].parametros.q).toBe('name:"Atividade Spot"')
    expect(rede.chamadas[1].caminho).toBe('/orders')
    expect(rede.chamadas[1].parametros.q).toContain('service_id:"MTox"')
  })

  it('guarda o id em cache: a segunda varredura não repete /services', async () => {
    const rede = httpDeMentira(rotasCom([ordem()]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await cliente.listarOsNormalizadas()
    await cliente.listarOsNormalizadas()

    expect(rede.chamadas.filter((c) => c.caminho === '/services')).toHaveLength(1)
  })

  it('aceita outro nome de tipo por configuração', async () => {
    const rede = httpDeMentira((caminho) => {
      if (caminho === '/services') return { items: [{ id: 'X', name: 'Manutenção' }], totalCount: 1 }
      return { items: [], totalCount: 0 }
    })
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http, nomeDoTipoDeOs: 'Manutenção' })

    await cliente.listarOsNormalizadas()

    expect(rede.chamadas[0].parametros.q).toBe('name:"Manutenção"')
  })

  it('lança ErroDeTipoDeOs quando nenhum tipo volta', async () => {
    const rede = httpDeMentira(() => ({ items: [], totalCount: 0 }))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await expect(cliente.listarOsNormalizadas()).rejects.toBeInstanceOf(ErroDeTipoDeOs)
  })

  it('aceita o único resultado mesmo sem casar byte a byte — a doc não promete match exato', async () => {
    const rede = httpDeMentira((caminho) => {
      if (caminho === '/services') return { items: [{ id: 'Y', name: 'atividade spot ' }], totalCount: 1 }
      return { items: [], totalCount: 0 }
    })
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await expect(cliente.resolverIdDoTipoDeOs()).resolves.toBe('Y')
  })

  it('escolhe o nome exato quando o filtro devolve vizinhos parecidos', async () => {
    const rede = httpDeMentira(() => ({
      items: [
        { id: 'A', name: 'Atividade Spot Emergencial' },
        { id: 'B', name: 'Atividade Spot' },
      ],
      totalCount: 2,
    }))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await expect(cliente.resolverIdDoTipoDeOs()).resolves.toBe('B')
  })

  it('prefere o tipo não arquivado quando dois têm o mesmo nome', async () => {
    const rede = httpDeMentira(() => ({
      items: [
        { id: 'VELHO', name: 'Atividade Spot', archived: true },
        { id: 'NOVO', name: 'Atividade Spot', archived: false },
      ],
      totalCount: 2,
    }))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await expect(cliente.resolverIdDoTipoDeOs()).resolves.toBe('NOVO')
  })

  it('para com ErroDeTipoDeOs quando a ambiguidade não tem desempate', async () => {
    const rede = httpDeMentira(() => ({
      items: [
        { id: 'A', name: 'Atividade Spot' },
        { id: 'B', name: 'Atividade Spot' },
      ],
      totalCount: 2,
    }))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const erro = await cliente.resolverIdDoTipoDeOs().catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(ErroDeTipoDeOs)
    expect((erro as ErroDeTipoDeOs).candidatos).toEqual(['A', 'B'])
  })
})

describe('criarClienteField — paginação', () => {
  it('resolve uma página única sem pedir a segunda', async () => {
    const rede = httpDeMentira(rotasCom([ordem({ identifier: 'A' }), ordem({ identifier: 'B' })]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const os = await cliente.listarOsNormalizadas()

    expect(os.map((o) => o.os)).toEqual(['A', 'B'])
    expect(rede.chamadas.filter((c) => c.caminho === '/orders')).toHaveLength(1)
  })

  it('varre várias páginas e devolve tudo concatenado, na ordem', async () => {
    const ordens = Array.from({ length: 250 }, (_, i) => ordem({ id: `o${i}`, identifier: `OS-${i}` }))
    const rede = httpDeMentira(rotasCom(ordens))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const os = await cliente.listarOsNormalizadas()

    const paginas = rede.chamadas.filter((c) => c.caminho === '/orders')
    expect(paginas.map((c) => c.parametros.offset)).toEqual([0, 100, 200])
    expect(paginas.every((c) => c.parametros.limit === 100)).toBe(true)
    expect(os).toHaveLength(250)
    expect(os[0].os).toBe('OS-0')
    expect(os[249].os).toBe('OS-249')
  })

  it('não para por totalCount defasado quando a página ainda vem cheia', async () => {
    const ordens = Array.from({ length: 250 }, (_, i) =>
      ordem({ id: `o${i}`, identifier: `OS-${i}` }),
    )
    const rede = httpDeMentira(rotasCom(ordens, 200))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const os = await cliente.listarOsNormalizadas()

    expect(os).toHaveLength(250)
    expect(rede.chamadas.filter((c) => c.caminho === '/orders')).toHaveLength(3)
  })

  it('pede ordenação estável em toda página — sem sort, varredura longa pula ou repete registro', async () => {
    const ordens = Array.from({ length: 150 }, (_, i) => ordem({ id: `o${i}`, identifier: `OS-${i}` }))
    const rede = httpDeMentira(rotasCom(ordens))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await cliente.listarOsNormalizadas()

    const paginas = rede.chamadas.filter((c) => c.caminho === '/orders')
    expect(paginas.map((c) => c.parametros.sort)).toEqual(['id', 'id'])
  })

  it('devolve lista vazia sem pedir página nenhuma além da primeira', async () => {
    const rede = httpDeMentira(rotasCom([], 0))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await expect(cliente.listarOsNormalizadas()).resolves.toEqual([])
    expect(rede.chamadas.filter((c) => c.caminho === '/orders')).toHaveLength(1)
  })

  it('para quando a página vem incompleta, mesmo que totalCount prometa mais', async () => {
    const rede = httpDeMentira((caminho) => {
      if (caminho === '/services') return { items: [TIPO_SPOT], totalCount: 1 }
      return { items: [ordem()], totalCount: 9999 }
    })
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const os = await cliente.listarOsNormalizadas()

    expect(os).toHaveLength(1)
    expect(rede.chamadas.filter((c) => c.caminho === '/orders')).toHaveLength(1)
  })

  it('trata corpo sem items como erro de leitura, nunca como lista vazia', async () => {
    const rede = httpDeMentira((caminho) => {
      if (caminho === '/services') return { items: [TIPO_SPOT], totalCount: 1 }
      return { totalCount: 0 }
    })
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await expect(cliente.listarOsNormalizadas()).rejects.toThrow(/sem a lista items/i)
  })

  it('para com erro alto quando a varredura passa do teto de offset documentado', async () => {
    const ordens = Array.from({ length: 40 }, (_, i) => ordem({ id: `o${i}`, identifier: `OS-${i}` }))
    const rede = httpDeMentira(rotasCom(ordens))
    const cliente = criarClienteField({
      chaveApi: CHAVE,
      http: rede.http,
      tamanhoDaPagina: 10,
      offsetMaximo: 20,
    })

    await expect(cliente.listarOsNormalizadas()).rejects.toThrow(/offset/i)
  })
})

describe('criarClienteField — varredura incremental', () => {
  it('traduz "desde" no filtro updated_at>=, junto do service_id', async () => {
    const rede = httpDeMentira(rotasCom([ordem()]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await cliente.listarOsNormalizadas({ desde: '2026-09-01' })

    const pagina = rede.chamadas.find((c) => c.caminho === '/orders')
    expect(pagina?.parametros.q).toBe('service_id:"MTox" updated_at>=:2026-09-01')
  })

  it('aceita Date e manda ISO, para quem guardou a marca d\'água como objeto', async () => {
    const rede = httpDeMentira(rotasCom([ordem()]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await cliente.listarOsNormalizadas({ desde: new Date('2026-09-01T03:04:05.000Z') })

    const pagina = rede.chamadas.find((c) => c.caminho === '/orders')
    expect(pagina?.parametros.q).toContain('updated_at>=:2026-09-01T03:04:05.000Z')
  })

  it('sem "desde", não manda filtro de data nenhum', async () => {
    const rede = httpDeMentira(rotasCom([ordem()]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await cliente.listarOsNormalizadas()

    const pagina = rede.chamadas.find((c) => c.caminho === '/orders')
    expect(pagina?.parametros.q).toBe('service_id:"MTox"')
  })
})

describe('criarClienteField — normalização', () => {
  it('mapeia identifier→os, description→descricao e guarda id e updatedAt', async () => {
    const rede = httpDeMentira(rotasCom([ordem()]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const [os] = await cliente.listarOsNormalizadas()

    expect(os).toEqual({
      os: '0226-014989',
      descricao: 'Forro do estoque caiu',
      loja: 'Av. Paulista, 1000 - São Paulo/SP',
      idField: 'ord-1',
      atualizadoEm: '2026-09-09T12:00:00Z',
    })
  })

  it('description null vira descricao null', async () => {
    const rede = httpDeMentira(rotasCom([ordem({ description: null })]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const [os] = await cliente.listarOsNormalizadas()

    expect(os.descricao).toBeNull()
  })

  it('description ausente do corpo também vira null, não undefined', async () => {
    const semDescricao: OrdemField = { id: 'ord-9', identifier: 'OS-9' }
    const rede = httpDeMentira(rotasCom([semDescricao]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const [os] = await cliente.listarOsNormalizadas()

    expect(os.descricao).toBeNull()
    expect('descricao' in os).toBe(true)
  })

  it('address null vira loja null, sem quebrar a varredura', async () => {
    const rede = httpDeMentira(rotasCom([ordem({ address: null })]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const [os] = await cliente.listarOsNormalizadas()

    expect(os.loja).toBeNull()
  })

  it('updatedAt ausente vira null', async () => {
    const rede = httpDeMentira(rotasCom([ordem({ updatedAt: undefined })]))
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    const [os] = await cliente.listarOsNormalizadas()

    expect(os.atualizadoEm).toBeNull()
  })

  it('com a estratégia "localizacao", a loja vem do nome da localização', async () => {
    const rede = httpDeMentira((caminho, parametros) => {
      if (caminho === '/customers/cli-1/locations/loc-1') return { id: 'loc-1', name: 'DP BAIRRO DE FATIMA' }
      return rotasCom([ordem()])(caminho, parametros)
    })
    const cliente = criarClienteField({
      chaveApi: CHAVE,
      http: rede.http,
      estrategiaDeLoja: 'localizacao',
    })

    const [os] = await cliente.listarOsNormalizadas()

    expect(os.loja).toBe('DP BAIRRO DE FATIMA')
  })
})

describe('criarClienteField — o circuito fechado, com fetch injetado', () => {
  it('a varredura inteira respeita 1 req/s, contando /services e cada página', async () => {
    let t = 0
    const instantes: number[] = []
    const ordens = Array.from({ length: 3 }, (_, i) => ordem({ id: `o${i}`, identifier: `OS-${i}` }))

    const buscar = async (url: string) => {
      instantes.push(t)
      const alvo = new URL(url)
      const corpo = alvo.pathname.startsWith('/services')
        ? { items: [TIPO_SPOT], totalCount: 1 }
        : {
            items: ordens.slice(Number(alvo.searchParams.get('offset') ?? 0), Number(alvo.searchParams.get('offset') ?? 0) + 2),
            totalCount: 3,
          }
      return {
        status: 200,
        headers: { get: () => null },
        json: async () => corpo,
        text: async () => JSON.stringify(corpo),
      }
    }

    const cliente = criarClienteField({
      chaveApi: CHAVE,
      buscar,
      tamanhoDaPagina: 2,
      agora: () => t,
      dormir: async (ms: number) => {
        t += ms
      },
    })

    const os = await cliente.listarOsNormalizadas()

    expect(os).toHaveLength(3)
    // /services, página 1, página 2 — um segundo entre cada.
    expect(instantes).toEqual([0, 1000, 2000])
  })
})

describe('criarClienteField — o cache do tipo de OS não memoriza fracasso', () => {
  it('depois de um erro em /services, a varredura seguinte pergunta de novo', async () => {
    let vaiFalhar = true
    const rede = httpDeMentira((caminho, parametros) => {
      if (caminho === '/services' && vaiFalhar) {
        vaiFalhar = false
        throw new ErroDaApiField(500, null, '/services')
      }
      return rotasCom([ordem()])(caminho, parametros)
    })
    const cliente = criarClienteField({ chaveApi: CHAVE, http: rede.http })

    await expect(cliente.resolverIdDoTipoDeOs()).rejects.toBeInstanceOf(ErroDaApiField)
    // Se a promessa falha ficasse no cache, um 429 na primeira tentativa
    // condenaria o processo inteiro a nunca mais resolver o tipo de OS.
    await expect(cliente.resolverIdDoTipoDeOs()).resolves.toBe('MTox')
  })
})
