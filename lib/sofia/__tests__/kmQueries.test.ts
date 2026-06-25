type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'lte', 'gte', 'single', 'is', 'delete']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let fromMock: jest.Mock

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: (...args: unknown[]) => fromMock(...args),
  })),
}))

import { getKmDiarioHistorico } from '../queries'

describe('getKmDiarioHistorico', () => {
  it('orders by data descending', async () => {
    const chain = makeChainable({ data: [] })
    fromMock = jest.fn(() => chain)

    await getKmDiarioHistorico()

    expect(chain.order).toHaveBeenCalledWith('data', { ascending: false })
  })
})
