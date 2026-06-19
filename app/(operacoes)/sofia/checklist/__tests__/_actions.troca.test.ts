// Chainable mock of the Supabase query builder: every method returns `this`
// so calls like `.update(...).eq(...).is(...)` resolve through `then`, which
// looks up the per-table result configured for the test.
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['update', 'insert', 'select', 'eq', 'is', 'single']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { criarChecklistAction } from '../_actions'

function buildTrocaFormData(): FormData {
  const fd = new FormData()
  const fields: Record<string, string> = {
    tipo: 'troca',
    equipe_id: 'equipe-origem',
    veiculo_id: 'veiculo-1',
    equipe_destino_id: 'equipe-destino',
    motorista_destino_id: '',
    motorista_id: '',
    observacoes: '',
    assinatura_motorista: 'true',
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('criarChecklistAction — troca de responsável', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { data: { id: 'checklist-1' }, error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('reports success when all three handoff writes succeed', async () => {
    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result).toEqual({ success: true, checklistId: 'checklist-1' })
  })

  it('surfaces an error instead of silently succeeding when closing the old responsibility record fails', async () => {
    tableResults.veiculo_responsabilidade_historico = { error: { message: 'RLS denied' } }

    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result.error).toBeTruthy()
  })

  it('surfaces an error instead of silently succeeding when updating the vehicle\'s current team fails', async () => {
    tableResults.veiculos = { error: { message: 'constraint violation' } }

    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result.error).toBeTruthy()
  })
})
