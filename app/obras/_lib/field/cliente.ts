/**
 * Cliente da API do Field Control — a porta de entrada desta pasta.
 *
 * O QUE ELE FAZ: resolve o tipo de OS pelo nome, varre `/orders` paginando por
 * dentro, e devolve `OsNormalizada[]`.
 * O QUE ELE NÃO FAZ, e não é esquecimento: não grava no banco, não desenha
 * tela, não decide regra de negócio e não configura webhook. Quem consome o que
 * sai daqui é outra frente (`02-FRENTES-DO-DUDA.md` §F1, "o que NÃO fazer").
 *
 * A CHAVE DA API VEM DE FORA. Este arquivo não lê `process.env` de propósito:
 * decidir o nome da variável e onde ela mora é escolha de quem for ligar isto à
 * aplicação — e essa escolha mexe em arquivo fora desta pasta.
 */

import { criarHttpField, montarQ, type BuscarHttp, type FiltroQ, type HttpField } from './http'
import { criarResolvedorDeLoja, type EstrategiaDeLoja } from './loja'
import { ErroDeTipoDeOs } from './erros'
import { consultarSituacaoDaOrdemField, type ConsultaDaOrdemField } from './consulta-ordem'
import type { ListaField, OrdemField, OsNormalizada, TipoDeOsField } from './tipos'

/** O tipo de OS que interessa ao Controle de Obras. */
export const NOME_PADRAO_DO_TIPO_DE_OS = 'Atividade Spot'

/** Teto documentado de `limit` por página. Pedir mais devolve 422. */
export const TAMANHO_MAXIMO_DA_PAGINA = 100

/** Teto documentado de `offset`. Além dele a API recusa. */
export const OFFSET_MAXIMO = 200000

export type ConfigDoClienteField = {
  /** Header `X-Api-Key`. Segredo: quem chama é que sabe de onde tirar. */
  chaveApi: string
  /**
   * QUAL DAS DUAS LEITURAS DE "LOJA" USAR. Padrão `'endereco'` porque é a que
   * custa zero chamada — e porque, enquanto o cliente não responde, o caro é
   * que tem de se justificar, não o barato. Trocar aqui é a mudança de uma
   * linha prometida em `loja.ts`.
   */
  estrategiaDeLoja?: EstrategiaDeLoja
  nomeDoTipoDeOs?: string
  /**
   * Campo do `sort`. Padrão `'id'`: paginação estável exige ordenar por algo
   * IMUTÁVEL. Ordenar por `updatedAt` numa varredura de várias páginas é
   * receita para pular registro — uma OS editada no meio da varredura muda de
   * lugar na ordenação e escapa da página que ainda não foi lida.
   * ⚠️ A doc não diz quais campos `sort` aceita nem se é camelCase ou
   * snake_case. Por isso é configurável: se a chave real recusar `id`, muda-se
   * aqui sem tocar na lógica.
   */
  ordenacao?: string
  tamanhoDaPagina?: number
  offsetMaximo?: number
  baseUrl?: string
  userAgent?: string
  /** Transporte pronto — usado pelos testes de varredura. */
  http?: HttpField
  /** `fetch` injetado. Em teste, sempre dublê. */
  buscar?: BuscarHttp
  agora?: () => number
  dormir?: (ms: number) => Promise<void>
  repeticoesEm429?: number
  backoffBaseMs?: number
}

export type OpcoesDaVarredura = {
  /**
   * Marca d'água: só volta o que mudou a partir daqui. Vira o filtro
   * `updated_at>=`. Aceita `Date` ou o texto já pronto — a doc usa
   * `2024-02-01` no exemplo, mas não proíbe timestamp completo.
   */
  desde?: string | Date
}

export type ClienteField = {
  /** Id do tipo de OS, resolvido pelo nome e memorizado. */
  resolverIdDoTipoDeOs(): Promise<string>
  /** Todas as OS do tipo, já normalizadas, com a paginação resolvida por dentro. */
  listarOsNormalizadas(opcoes?: OpcoesDaVarredura): Promise<OsNormalizada[]>
  /** Situação da ordem antiga para a herança conservadora da D2.1. */
  consultarSituacaoDaOrdem(idField: string): Promise<ConsultaDaOrdemField>
}

/** Texto com conteúdo, ou `null`. Evita `''` e `'  '` virando dado. */
function texto(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null
  const limpo = valor.trim()
  return limpo === '' ? null : limpo
}

/**
 * Escolhe UM tipo de OS entre os candidatos devolvidos por `/services`.
 *
 * POR QUE ISSO É MAIS QUE `items[0]`: a documentação **não diz** se o filtro
 * `name` é exato ou parcial (levantamento, §"O que não deu para descobrir").
 * Se for parcial, `"Atividade Spot"` casa também com `"Atividade Spot
 * Emergencial"`, e pegar o primeiro da lista significaria varrer o tipo errado
 * em silêncio por meses. A ordem de desempate é: nome exato → único não
 * arquivado → único resultado. Sem desempate, para com erro: uma varredura
 * parada é um problema de uma tarde; uma varredura do tipo errado é um
 * problema de confiança no sistema inteiro.
 */
function escolherTipoDeOs(candidatos: TipoDeOsField[], nomeProcurado: string): TipoDeOsField {
  const alvo = nomeProcurado.trim().toLowerCase()
  const exatos = candidatos.filter((c) => (c.name ?? '').trim().toLowerCase() === alvo)

  if (exatos.length === 1) return exatos[0]

  if (exatos.length > 1) {
    const vivos = exatos.filter((c) => c.archived !== true)
    if (vivos.length === 1) return vivos[0]
    throw new ErroDeTipoDeOs(
      `Mais de um tipo de OS chamado "${nomeProcurado}" no Field Control, e nenhum desempate possível.`,
      exatos.map((c) => c.id),
    )
  }

  // Nenhum nome idêntico. Um único resultado ainda é uma resposta boa: pode ser
  // diferença de acento, de caixa ou de espaço no cadastro.
  if (candidatos.length === 1) return candidatos[0]

  throw new ErroDeTipoDeOs(
    candidatos.length === 0
      ? `Nenhum tipo de OS chamado "${nomeProcurado}" foi encontrado no Field Control.`
      : `O filtro por "${nomeProcurado}" devolveu ${candidatos.length} tipos e nenhum com o nome idêntico.`,
    candidatos.map((c) => c.id),
  )
}

export function criarClienteField(config: ConfigDoClienteField): ClienteField {
  const nomeDoTipoDeOs = config.nomeDoTipoDeOs ?? NOME_PADRAO_DO_TIPO_DE_OS
  const ordenacao = config.ordenacao ?? 'id'
  const offsetMaximo = config.offsetMaximo ?? OFFSET_MAXIMO
  const tamanhoDaPagina = Math.min(config.tamanhoDaPagina ?? TAMANHO_MAXIMO_DA_PAGINA, TAMANHO_MAXIMO_DA_PAGINA)

  const http =
    config.http ??
    criarHttpField({
      chaveApi: config.chaveApi,
      baseUrl: config.baseUrl,
      userAgent: config.userAgent,
      buscar: config.buscar,
      agora: config.agora,
      dormir: config.dormir,
      repeticoesEm429: config.repeticoesEm429,
      backoffBaseMs: config.backoffBaseMs,
    })

  const resolverLoja = criarResolvedorDeLoja(config.estrategiaDeLoja ?? 'endereco', http)

  /**
   * Cache do id do tipo de OS. A spec pede explicitamente: "o id não muda com
   * frequência, guarde em cache, não resolva a cada varredura". Guardar a
   * PROMESSA, e não o valor, também impede duas varreduras simultâneas de
   * gastarem duas requisições com a mesma pergunta.
   */
  let idDoTipoDeOs: Promise<string> | null = null

  function resolverIdDoTipoDeOs(): Promise<string> {
    if (!idDoTipoDeOs) {
      idDoTipoDeOs = (async () => {
        const lista = await http.get<ListaField<TipoDeOsField>>('/services', {
          q: montarQ([{ campo: 'name', valor: nomeDoTipoDeOs }]),
        })
        return escolherTipoDeOs(lista?.items ?? [], nomeDoTipoDeOs).id
      })()
      // Falha não pode ficar memorizada: um 429 na primeira tentativa
      // condenaria o processo inteiro a nunca mais resolver o tipo.
      idDoTipoDeOs.catch(() => {
        idDoTipoDeOs = null
      })
    }
    return idDoTipoDeOs
  }

  async function listarOsNormalizadas(opcoes: OpcoesDaVarredura = {}): Promise<OsNormalizada[]> {
    const serviceId = await resolverIdDoTipoDeOs()

    const filtros: FiltroQ[] = [{ campo: 'service_id', valor: serviceId }]
    if (opcoes.desde !== undefined) {
      const desde = opcoes.desde instanceof Date ? opcoes.desde.toISOString() : opcoes.desde
      filtros.push({ campo: 'updated_at', operador: '>=', valor: desde })
    }
    const q = montarQ(filtros)

    const ordens: OrdemField[] = []
    let offset = 0
    const primeirosIdsVistos = new Set<string>()

    for (;;) {
      const pagina = await http.get<ListaField<OrdemField>>('/orders', {
        q,
        limit: tamanhoDaPagina,
        offset,
        sort: ordenacao,
      })

      if (!pagina || !Array.isArray(pagina.items)) {
        throw new Error(
          'Field Control devolveu uma página de /orders sem a lista items. A varredura foi interrompida.',
        )
      }
      const itens = pagina.items
      const primeiroId = itens[0]?.id ?? null
      if (primeiroId && primeirosIdsVistos.has(primeiroId)) {
        throw new Error(
          `Field Control repetiu a página de /orders no offset ${offset}. A varredura foi interrompida.`,
        )
      }
      if (primeiroId) primeirosIdsVistos.add(primeiroId)
      ordens.push(...itens)

      /**
       * Só página incompleta encerra. `totalCount` é informativo e pode estar
       * velho; usá-lo para parar cedo transforma uma contagem em cache numa
       * falsa prova de ausência para as páginas que ficaram sem leitura.
       */
      if (itens.length < tamanhoDaPagina) break

      offset += tamanhoDaPagina
      if (offset > offsetMaximo) {
        throw new Error(
          `Varredura passou do offset máximo (${offsetMaximo}) documentado pela API do Field Control. ` +
            `Quebre a busca por faixas de updated_at em vez de paginar além desse teto.`,
        )
      }
    }

    /**
     * A normalização é SEQUENCIAL de propósito. Na estratégia 'localizacao'
     * ela faz uma requisição por loja nova, e essas requisições precisam entrar
     * na mesma fila de 1 req/s. Um `Promise.all` aqui despejaria todas de uma
     * vez: o limitador seguraria o ritmo, mas a ordem do resultado deixaria de
     * ser a da API — e ordem estável é o que torna a varredura auditável.
     */
    const normalizadas: OsNormalizada[] = []
    for (const ordem of ordens) {
      normalizadas.push({
        os: ordem.identifier,
        descricao: texto(ordem.description),
        loja: await resolverLoja(ordem),
        idField: ordem.id,
        atualizadoEm: texto(ordem.updatedAt),
        archived: typeof ordem.archived === 'boolean' ? ordem.archived : null,
      })
    }
    return normalizadas
  }

  return {
    resolverIdDoTipoDeOs,
    listarOsNormalizadas,
    consultarSituacaoDaOrdem: (idField) => consultarSituacaoDaOrdemField(http, idField),
  }
}
