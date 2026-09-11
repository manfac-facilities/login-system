/**
 * Limitador de 1 requisição por segundo para a API do Field Control.
 *
 * POR QUE ISSO EXISTE, E POR QUE NÃO É "CUIDADO EXTRA": a documentação oficial
 * diz, literalmente, "A API permite que a aplicação cliente possa fazer uma
 * requisição por segundo", e passar disso devolve `429`
 * (docs/cliente/2026-08-31-sistema-controle-de-obras/api-field-control-levantamento.md §4).
 * Como não há `Retry-After` documentado, tomar 429 é caro: a recuperação é um
 * palpite. Sai mais barato nunca disparar o 429 do que saber tratá-lo bem.
 *
 * DUAS GARANTIAS, e as duas importam:
 *   1. SERIALIZAÇÃO — as tarefas rodam uma de cada vez, em fila. Sem isso,
 *      `Promise.all` de cinco páginas viraria cinco requisições no mesmo
 *      milissegundo, e nenhum espaçamento salvaria.
 *   2. ESPAÇAMENTO — o início de cada tarefa fica a, no mínimo, `intervaloMs`
 *      do início da anterior. Medimos do INÍCIO, não do fim: o limite é de
 *      requisições por segundo, não de intervalo entre respostas. Se uma
 *      chamada demorou 3 s, a próxima parte na hora — o segundo já passou.
 *
 * `agora` e `dormir` são injetáveis porque o teste não pode gastar 2 segundos
 * de parede para provar que duas chamadas ficaram a 2 segundos de distância.
 */

export type OpcoesDoLimitador = {
  /** Distância mínima entre os INÍCIOS de duas tarefas. Padrão: 1000 ms. */
  intervaloMs?: number
  /** Relógio monotônico em ms. Padrão: `Date.now`. */
  agora?: () => number
  /** Espera de verdade. Padrão: `setTimeout`. */
  dormir?: (ms: number) => Promise<void>
}

export type Limitador = {
  /**
   * Põe a tarefa na fila e resolve com o que ela devolver. A rejeição é
   * repassada intacta — quem chamou é que sabe o que fazer com o erro.
   */
  enfileirar<T>(tarefa: () => Promise<T>): Promise<T>
}

/** Espera real, usada quando ninguém injeta um relógio de teste. */
function dormirDeVerdade(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function criarLimitador(opcoes: OpcoesDoLimitador = {}): Limitador {
  const intervaloMs = opcoes.intervaloMs ?? 1000
  const agora = opcoes.agora ?? (() => Date.now())
  const dormir = opcoes.dormir ?? dormirDeVerdade

  /**
   * A cauda da fila. Cada `enfileirar` se pendura aqui, e a cauda é sempre uma
   * promessa que NUNCA rejeita (`.then(ok, ok)`): se ela pudesse rejeitar, um
   * erro numa tarefa deixaria toda a fila seguinte pendurada num unhandled
   * rejection, e a varredura morreria na primeira OS problemática.
   */
  let cauda: Promise<void> = Promise.resolve()

  /** Instante a partir do qual a próxima tarefa pode partir. */
  let liberadoEm = Number.NEGATIVE_INFINITY

  function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
    const resultado = cauda.then(async () => {
      const espera = liberadoEm - agora()
      if (espera > 0) await dormir(espera)
      // Reserva o próximo slot ANTES de rodar: o relógio conta do disparo.
      liberadoEm = agora() + intervaloMs
      return tarefa()
    })

    const ignorar = () => undefined
    cauda = resultado.then(ignorar, ignorar)
    return resultado
  }

  return { enfileirar }
}
