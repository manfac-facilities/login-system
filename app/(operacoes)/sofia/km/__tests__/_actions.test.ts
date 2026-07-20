type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'eq', 'gte', 'lt', 'order', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = jest.fn((...args: unknown[]) => {
      if (m === 'upsert') lastUpsertArgs = args
      return chain
    })
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>
let lastUpsertArgs: unknown[] = []

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: jest.fn() }))

import { lancarKmAction } from '../_actions'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('lancarKmAction — chave de conflito', () => {
  beforeEach(() => {
    lastUpsertArgs = []
    tableResults = {
      veiculos: { data: { km_atual: 1000 }, error: null },
      km_diario: { error: null },
    }
  })

  it('usa onConflict "data,veiculo_id" em vez de "data,equipe_id"', async () => {
    await lancarKmAction(
      {},
      buildFormData({ equipe_id: 'equipe-1', veiculo_id: 'veiculo-1', km_atual: '1500', data: '2026-07-18' })
    )
    expect(lastUpsertArgs[1]).toEqual({ onConflict: 'data,veiculo_id' })
  })
})
