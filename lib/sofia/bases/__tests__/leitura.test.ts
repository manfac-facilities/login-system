jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

import { buscarTudo } from '../leitura'

describe('buscarTudo', () => {
  it('junta os lotes de 1000 até vir um incompleto', async () => {
    const pag = jest.fn(async (de: number) => ({
      data: de === 0 ? Array(1000).fill(1) : de === 1000 ? Array(1000).fill(2) : Array(5).fill(3),
      error: null,
    }))
    const r = await buscarTudo<number>(pag)
    expect(r).toHaveLength(2005)
    expect(pag.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
  it('lote exato de 1000 pede mais um e termina no vazio', async () => {
    const pag = jest.fn(async (de: number) => ({ data: de === 0 ? Array(1000).fill(1) : [], error: null }))
    expect(await buscarTudo<number>(pag)).toHaveLength(1000)
    expect(pag).toHaveBeenCalledTimes(2)
  })
  it('erro vira exceção, nunca lista vazia', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(buscarTudo<number>(async () => ({ data: null, error: { message: 'x' } }))).rejects.toThrow(/Erro ao carregar/)
  })
})
