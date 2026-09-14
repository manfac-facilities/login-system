/**
 * Cliente da API do Field Control — fronteira pública da pasta.
 *
 * IMPORTE DAQUI, não dos arquivos internos. O que está exportado neste arquivo
 * é contrato; o resto é implementação e pode mudar de nome sem aviso.
 *
 * COMO SE USA:
 *
 *   const cliente = criarClienteField({ chaveApi: <a chave, vinda de fora> })
 *   const os = await cliente.listarOsNormalizadas({ desde: ultimaVarredura })
 *
 * `os` é `OsNormalizada[]`, já com a paginação resolvida, o ritmo de 1 req/s
 * respeitado e os campos traduzidos. Gravar isso em algum lugar é trabalho de
 * quem chama — esta camada não escreve no banco.
 *
 * TRÊS COISAS PARA SABER ANTES DE LIGAR ISTO EM PRODUÇÃO:
 *
 * 1. A "loja" ainda é decisão em aberto do cliente. O padrão é `'endereco'`
 *    (custo zero); `'localizacao'` custa uma chamada por loja. Ver `loja.ts`.
 * 2. Nada aqui lê variável de ambiente. A chave entra por parâmetro, de
 *    propósito: onde ela mora é decisão de quem integra.
 * 3. `sort` vai como `'id'` por padrão e **não foi verificado contra a API
 *    real** — a documentação não lista os campos aceitos. É configurável.
 */

export { criarClienteField, NOME_PADRAO_DO_TIPO_DE_OS, OFFSET_MAXIMO, TAMANHO_MAXIMO_DA_PAGINA } from './cliente'
export type { ClienteField, ConfigDoClienteField, OpcoesDaVarredura } from './cliente'

export { consultarSituacaoDaOrdemField } from './consulta-ordem'
export type {
  ConsultaDaOrdemField,
  SituacaoDaOrdemField,
  TratamentoDaConsultaInconclusiva,
} from './consulta-ordem'

export { criarResolvedorDeLoja, textoDoEndereco } from './loja'
export type { EstrategiaDeLoja, ResolvedorDeLoja } from './loja'

export { BASE_URL_FIELD, criarHttpField, montarQ, USER_AGENT_PADRAO } from './http'
export type { FiltroQ, HttpField, OperadorQ, ParametrosDeBusca } from './http'

export { criarLimitador } from './limitador'
export type { Limitador } from './limitador'

export { ErroDaApiField, ErroDeParametroInvalido, ErroDeRateLimit, ErroDeTipoDeOs } from './erros'

export type {
  EnderecoField,
  ListaField,
  LocalizacaoField,
  OrdemField,
  OsNormalizada,
  ReferenciaField,
  TipoDeOsField,
} from './tipos'
