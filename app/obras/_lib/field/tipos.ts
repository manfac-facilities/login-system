/**
 * Tipos do recurso "Ordem de Serviço" do Field Control, escritos a partir do
 * schema documentado — não de uma resposta real, que ninguém desta frente viu.
 *
 * Fonte: docs/cliente/2026-08-31-sistema-controle-de-obras/api-field-control-levantamento.md
 * (§2 filtros, §3 campos, §4 paginação), que por sua vez cita literalmente
 * https://developers.fieldcontrol.com.br/.
 *
 * DUAS DECISÕES DE MODELAGEM, e as duas são conservadoras de propósito:
 *
 * 1. QUASE TUDO É OPCIONAL E ACEITA `null`. A doc só garante `identifier` como
 *    obrigatório e único, e diz explicitamente que `description` pode vir
 *    `null`. Para os outros campos ela não promete presença. Tipar otimista
 *    aqui não deixa o dado aparecer — só troca um `null` visível por um
 *    `undefined` de madrugada dentro de um `.trim()`.
 *
 * 2. NOMES EM INGLÊS, EM camelCase, IGUAIS AOS DA API. Este arquivo é a
 *    fronteira: daqui para fora tudo vira `OsNormalizada`, em português. Se um
 *    nome do Field aparecer fora desta pasta, a fronteira vazou.
 *    (Cuidado com a assimetria da API, que não é erro de digitação: o corpo da
 *    resposta vem em camelCase — `updatedAt` — e o FILTRO do `q` vai em
 *    snake_case — `updated_at`.)
 */

/** Endereço embutido na própria OS. Vem junto na listagem, sem chamada extra. */
export type EnderecoField = {
  zipCode?: string | null
  city?: string | null
  state?: string | null
  neighborhood?: string | null
  street?: string | null
  /** A doc não fixa o tipo; número de porta aparece tanto como texto quanto como número. */
  number?: string | number | null
  complement?: string | null
  coords?: { latitude?: number | null; longitude?: number | null } | null
}

/** Referência a outro recurso. Na LISTAGEM de `/orders` vem só o `id`. */
export type ReferenciaField = {
  id: string
}

/** Ordem de serviço. Só os campos que esta camada lê ou repassa. */
export type OrdemField = {
  id: string
  /** "Identificador da ordem de serviço, deve ser único entre todas" — vira `os`. */
  identifier: string
  /** Máx. 2000 caracteres. A doc diz que pode ser `null`; também pode simplesmente não vir. */
  description?: string | null
  address?: EnderecoField | null
  /** "Localização" do cliente — o caminho caro para o nome da loja. Ver `loja.ts`. */
  location?: ReferenciaField | null
  customer?: ReferenciaField | null
  /** Tipo de OS. O mesmo recurso que o endpoint `/services` lista. */
  service?: ReferenciaField | null
  /** A API real confirmou este booleano tanto na listagem quanto no detalhe. */
  archived?: boolean | null
  createdAt?: string | null
  updatedAt?: string | null
}

/**
 * Tipo de OS. Mora no endpoint `/services` — nome histórico e traiçoeiro: o
 * recurso "Serviços" de itens de fatura é OUTRO, em `/work-services`.
 */
export type TipoDeOsField = {
  id: string
  name: string
  /** Duração estimada, inteiro. */
  duration?: number | null
  archived?: boolean | null
  createdAt?: string | null
}

/** Localização do cliente: é o `name` daqui que provavelmente é a "loja". */
export type LocalizacaoField = {
  id: string
  name?: string | null
}

/** Envelope de toda listagem: `items` e `totalCount` no nível raiz. */
export type ListaField<T> = {
  items?: T[] | null
  totalCount?: number | null
}

/**
 * A OS já traduzida para o vocabulário do Controle de Obras.
 *
 * É o ÚNICO formato que sai desta pasta. Os três primeiros campos são os da
 * tabela da spec (`02-FRENTES-DO-DUDA.md` §F1.6). Os dois últimos existem por
 * necessidade operacional, não por capricho:
 *   - `idField` é a chave estável para reconciliar sem depender de
 *     `identifier`, que é único mas editável pelo gestor no painel;
 *   - `atualizadoEm` é a marca d'água da varredura incremental: quem consome
 *     guarda o maior valor visto e devolve na próxima passada.
 *
 * Esta camada NÃO grava nada. Quem escreve no banco é outra frente.
 */
export type OsNormalizada = {
  os: string
  descricao: string | null
  loja: string | null
  idField: string
  atualizadoEm: string | null
  /** `null` preserva uma resposta ausente ou inválida, sem presumir que a OS está ativa. */
  archived: boolean | null
}
