import { lerTodasAsLinhas } from '../_lib/ler-paginas'

/** Banco falso: `total` linhas numeradas; cada página devolve no máximo `ate - de + 1`. */
function banco(total: number, falhaNaPagina?: number) {
  const chamadas: { de: number; ate: number; estavel: boolean }[] = []
  const buscar = async (de: number, ate: number, estavel: boolean) => {
    chamadas.push({ de, ate, estavel })
    if (falhaNaPagina !== undefined && de === falhaNaPagina * 1000) {
      return { data: null, error: { message: 'boom' } }
    }
    const data = Array.from({ length: Math.max(0, Math.min(ate + 1, total) - de) }, (_, i) => de + i)
    return { data, error: null }
  }
  return { buscar, chamadas }
}

describe('lerTodasAsLinhas', () => {
  it('tabela vazia: lista vazia, uma consulta, sem ordenar', async () => {
    const b = banco(0)
    const r = await lerTodasAsLinhas(b.buscar)
    expect(r).toEqual({ data: [], error: null })
    expect(b.chamadas).toEqual([{ de: 0, ate: 999, estavel: false }])
  })

  it('999 linhas: uma consulta só, igual à consulta antiga (sem order)', async () => {
    const b = banco(999)
    const r = await lerTodasAsLinhas(b.buscar)
    expect(r.data).toHaveLength(999)
    expect(b.chamadas).toHaveLength(1)
    expect(b.chamadas[0].estavel).toBe(false)
  })

  it('exatamente 1000 linhas: lê tudo, sem perder nem repetir, relendo ordenado', async () => {
    const b = banco(1000)
    const r = await lerTodasAsLinhas(b.buscar)
    expect(r.error).toBeNull()
    expect(r.data).toEqual(Array.from({ length: 1000 }, (_, i) => i))
    expect(b.chamadas.map((c) => c.estavel)).toEqual([false, true, true])
  })

  it('1001+ linhas: não corta em 1000', async () => {
    const b = banco(2503)
    const r = await lerTodasAsLinhas(b.buscar)
    expect(r.data).toEqual(Array.from({ length: 2503 }, (_, i) => i))
    expect(b.chamadas.filter((c) => c.estavel).map((c) => c.de)).toEqual([0, 1000, 2000])
  })

  it('erro na primeira página: data nula', async () => {
    const r = await lerTodasAsLinhas(banco(5, 0).buscar)
    expect(r.data).toBeNull()
    expect(r.error?.message).toBe('boom')
  })

  it('erro numa página do meio: data nula, nunca lista parcial', async () => {
    const r = await lerTodasAsLinhas(banco(3500, 2).buscar)
    expect(r.data).toBeNull()
    expect(r.error?.message).toBe('boom')
  })
})
