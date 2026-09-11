/**
 * Testes do limitador de 1 req/s.
 *
 * RELÓGIO VIRTUAL, NÃO TIMER REAL: o teste injeta `agora`/`dormir` próprios,
 * em que `dormir(ms)` só empurra um contador. Assim o espaçamento é verificado
 * em milissegundos exatos e a suíte não gasta 2 segundos de parede para provar
 * que duas chamadas ficaram a 2 segundos de distância.
 */

import { criarLimitador } from '../limitador'

/** Relógio de mentira: `dormir` avança o tempo em vez de esperar. */
function relogioVirtual(inicio = 0) {
  let t = inicio
  return {
    agora: () => t,
    dormir: async (ms: number) => {
      t += ms
    },
    avancar: (ms: number) => {
      t += ms
    },
  }
}

describe('criarLimitador', () => {
  it('não faz a primeira chamada esperar', async () => {
    const relogio = relogioVirtual()
    const limitador = criarLimitador({ intervaloMs: 1000, ...relogio })

    const instante = await limitador.enfileirar(async () => relogio.agora())

    expect(instante).toBe(0)
  })

  it('espaça chamadas consecutivas pelo intervalo configurado', async () => {
    const relogio = relogioVirtual()
    const limitador = criarLimitador({ intervaloMs: 1000, ...relogio })

    const instantes = await Promise.all([
      limitador.enfileirar(async () => relogio.agora()),
      limitador.enfileirar(async () => relogio.agora()),
      limitador.enfileirar(async () => relogio.agora()),
    ])

    expect(instantes).toEqual([0, 1000, 2000])
  })

  it('não espera de novo quando o intervalo já passou por conta do trabalho anterior', async () => {
    const relogio = relogioVirtual()
    const limitador = criarLimitador({ intervaloMs: 1000, ...relogio })

    // A primeira tarefa demora 3s de relógio; a segunda não deve esperar mais.
    await limitador.enfileirar(async () => {
      relogio.avancar(3000)
    })
    const instante = await limitador.enfileirar(async () => relogio.agora())

    expect(instante).toBe(3000)
  })

  it('serializa: a próxima tarefa só começa depois que a anterior termina', async () => {
    const relogio = relogioVirtual()
    const limitador = criarLimitador({ intervaloMs: 1000, ...relogio })
    let emVoo = 0
    let picoSimultaneo = 0

    const tarefa = async () => {
      emVoo += 1
      picoSimultaneo = Math.max(picoSimultaneo, emVoo)
      await Promise.resolve()
      emVoo -= 1
    }

    await Promise.all([
      limitador.enfileirar(tarefa),
      limitador.enfileirar(tarefa),
      limitador.enfileirar(tarefa),
    ])

    expect(picoSimultaneo).toBe(1)
  })

  it('uma tarefa que falha não trava a fila nem come o espaçamento da seguinte', async () => {
    const relogio = relogioVirtual()
    const limitador = criarLimitador({ intervaloMs: 1000, ...relogio })

    await expect(
      limitador.enfileirar(async () => {
        throw new Error('falhou')
      }),
    ).rejects.toThrow('falhou')

    const instante = await limitador.enfileirar(async () => relogio.agora())

    expect(instante).toBe(1000)
  })
})
