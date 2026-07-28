// Chainable mock of the Supabase query builder: every method returns `this`
// so calls like `.update(...).eq(...).is(...)` resolve through `then`, which
// looks up the per-table result configured for the test. Each method call is
// also pushed onto `callLog` (as `table.method`) so tests can assert that a
// write was — or was NOT — attempted on a given table.
type TableResult = { data?: unknown; error?: unknown }

let callLog: string[]

function makeChainable(table: string, result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['update', 'insert', 'select', 'eq', 'is', 'single', 'neq', 'limit']
  for (const m of methods) {
    chain[m] = jest.fn(() => {
      callLog.push(`${table}.${m}`)
      return chain
    })
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(table, tableResults[table])),
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
    id: 'checklist-1',
    tipo: 'troca',
    equipe_id: 'equipe-origem',
    veiculo_id: 'veiculo-1',
    equipe_destino_id: 'equipe-destino',
    motorista_destino_id: '',
    motorista_id: '',
    observacoes: '',
    assinatura_motorista: 'true',
    lataria_ok: 'true',
    vidros_ok: 'true',
    pneus_ok: 'true',
    combustivel_ok: 'true',
    itens_internos_ok: 'true',
    estepe_ok: 'true',
    macaco_ok: 'true',
    triangulo_ok: 'true',
    fotos: JSON.stringify({
      Frente: { path: 'checklist-1/Frente-1.jpg', lat: null, lng: null },
      Traseira: { path: 'checklist-1/Traseira-1.jpg', lat: null, lng: null },
      'Lateral Esq.': { path: 'checklist-1/Lateral-Esq.-1.jpg', lat: null, lng: null },
      'Lateral Dir.': { path: 'checklist-1/Lateral-Dir.-1.jpg', lat: null, lng: null },
    }),
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('criarChecklistAction — troca de responsável', () => {
  beforeEach(() => {
    callLog = []
    tableResults = {
      checklist: { error: null },
      checklist_fotos: { error: null },
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

  it('blocks the team handoff when the destination team is already linked to another active vehicle', async () => {
    // Mocks the `veiculos` select used internally by validarVinculoEquipeUnico
    // returning a conflicting row — mirrors the conflict-case mock in
    // app/(operacoes)/sofia/veiculos/__tests__/_actions.test.ts.
    tableResults.veiculos = { data: [{ id: 'veiculo-outro', placa: 'XYZ-9999' }] }

    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result).toEqual({
      error: 'Equipe já vinculada ao veículo XYZ-9999',
      checklistId: 'checklist-1',
    })
    // validarVinculoEquipeUnico only ever calls select/eq/neq/limit on
    // `veiculos` — no `.update(...)` should have been attempted there, and
    // none of the veiculo_responsabilidade_historico writes should have run
    // either, since the validation short-circuits before all of them.
    expect(callLog).not.toContain('veiculos.update')
    expect(callLog).not.toContain('veiculo_responsabilidade_historico.update')
    expect(callLog).not.toContain('veiculo_responsabilidade_historico.insert')
    expect(callLog).toContain('veiculos.select')
  })

  it('surfaces the fotos-registration error and keeps the checklist id when checklist_fotos insert fails after the checklist row was already saved', async () => {
    tableResults.checklist_fotos = { error: { message: 'RLS denied' } }

    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result.error).toBeTruthy()
    expect(result.error).toBe(
      'Checklist salvo, mas as fotos não foram registradas. Contate o suporte.'
    )
    expect(result.checklistId).toBe('checklist-1')
    // The mock's `makeChainable` only ever registers update/insert/select/eq/
    // is/single/neq/limit — there is no delete method to call, mirroring
    // production: there's no compensating-transaction mechanism, so the
    // already-inserted checklist row is intentionally left in place.
    expect(callLog).not.toContain('checklist.delete')
    expect(callLog).toContain('checklist.insert')
    expect(callLog).toContain('checklist_fotos.insert')
  })
})
