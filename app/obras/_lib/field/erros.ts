/**
 * Erros da camada do Field Control.
 *
 * POR QUE CLASSES E NÃO `throw new Error('...')`: quem chama precisa DECIDIR
 * diferente por caso — 422 é bug nosso e não adianta repetir; 429 é ritmo e
 * pede espera; 5xx pode ser transitório. Distinguir por texto de mensagem é o
 * tipo de coisa que quebra quando alguém traduz a string.
 *
 * A chave da API NUNCA entra em mensagem de erro. Erro vira log, log vira
 * print no chat, e é assim que segredo vaza — a regra 8 de
 * `docs/onboarding-duda/01-REGRAS-DE-TRABALHO.md` não abre exceção "só para
 * depurar". Por isso o erro carrega `url` sem query sensível e `corpo`, nunca
 * os cabeçalhos da requisição.
 */

/** Falha genérica da API: status fora da faixa 2xx que não tem tratamento próprio. */
export class ErroDaApiField extends Error {
  readonly status: number
  readonly corpo: unknown

  constructor(status: number, corpo: unknown, contexto: string) {
    super(`Field Control respondeu ${status} em ${contexto}`)
    this.name = 'ErroDaApiField'
    this.status = status
    this.corpo = corpo
  }
}

/**
 * `429` que sobreviveu a todas as repetições de backoff.
 *
 * Chegar aqui quer dizer que o espaçamento de 1 req/s não foi suficiente —
 * provavelmente porque outro processo está usando a MESMA chave ao mesmo tempo.
 * A documentação não diz se o limite é por chave ou por conta (§"O que não deu
 * para descobrir"), então essa hipótese é a primeira a investigar.
 */
export class ErroDeRateLimit extends ErroDaApiField {
  readonly tentativas: number

  constructor(corpo: unknown, contexto: string, tentativas: number) {
    super(429, corpo, contexto)
    this.name = 'ErroDeRateLimit'
    this.tentativas = tentativas
    this.message =
      `Field Control devolveu 429 em ${contexto} depois de ${tentativas} tentativas. ` +
      `O limite documentado é 1 req/s — verifique se outro processo está usando a mesma chave.`
  }
}

/**
 * `422` — parâmetro inválido (limit fora da faixa, offset negativo, filtro
 * malformado). É defeito de quem montou a requisição, não do servidor: repetir
 * só queima o orçamento de 1 req/s e devolve o mesmo 422.
 */
export class ErroDeParametroInvalido extends ErroDaApiField {
  constructor(corpo: unknown, contexto: string) {
    super(422, corpo, contexto)
    this.name = 'ErroDeParametroInvalido'
    this.message = `Field Control recusou um parâmetro em ${contexto} (422). Isso é bug nosso de montagem da requisição, não instabilidade.`
  }
}

/**
 * O tipo de OS procurado por nome não pôde ser resolvido para um id único.
 *
 * Existe porque a documentação NÃO diz se o filtro `name` de `/services` é
 * exato ou parcial (levantamento §6). Se um dia "Atividade Spot" casar com
 * dois tipos cadastrados, é melhor parar aqui, alto e claro, do que varrer as
 * OS do tipo errado em silêncio.
 */
export class ErroDeTipoDeOs extends Error {
  readonly candidatos: string[]

  constructor(mensagem: string, candidatos: string[]) {
    super(mensagem)
    this.name = 'ErroDeTipoDeOs'
    this.candidatos = candidatos
  }
}
