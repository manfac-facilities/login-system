type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'limit']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

import { validarVinculoEquipeUnico } from '../veiculos'

type MockSupabase = Parameters<typeof validarVinculoEquipeUnico>[0]

describe('validarVinculoEquipeUnico', () => {
  it('retorna null quando equipeId está vazio', async () => {
    const supabase = { from: jest.fn() } as unknown as MockSupabase
    const result = await validarVinculoEquipeUnico(supabase, '')
    expect(result).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('retorna null quando nenhum veículo não-inativo tem essa equipe', async () => {
    const chain = makeChainable({ data: [] })
    const supabase = { from: jest.fn(() => chain) } as unknown as MockSupabase
    const result = await validarVinculoEquipeUnico(supabase, 'equipe-1')
    expect(result).toBeNull()
  })

  it('retorna mensagem de erro com a placa quando a equipe já está vinculada', async () => {
    const chain = makeChainable({ data: [{ id: 'veiculo-2', placa: 'ABC-1234' }] })
    const supabase = { from: jest.fn(() => chain) } as unknown as MockSupabase
    const result = await validarVinculoEquipeUnico(supabase, 'equipe-1')
    expect(result).toBe('Equipe já vinculada ao veículo ABC-1234')
  })

  it('exclui o próprio veículo da checagem quando veiculoIdExcluir é passado', async () => {
    const chain = makeChainable({ data: [] })
    const supabase = { from: jest.fn(() => chain) } as unknown as MockSupabase
    const result = await validarVinculoEquipeUnico(supabase, 'equipe-1', 'veiculo-1')
    expect(result).toBeNull()
    expect(chain.neq).toHaveBeenCalledWith('id', 'veiculo-1')
  })
})
