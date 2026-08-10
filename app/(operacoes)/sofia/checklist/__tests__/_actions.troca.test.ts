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
const rpcMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(table, tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    rpc: rpcMock,
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
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    tableResults = {
      checklist: { error: null },
      checklist_fotos: { error: null },
      // usado só pela leitura de validarVinculoEquipeUnico
      veiculos: { error: null },
    }
  })

  it('reports success and calls atribuir_responsabilidade_veiculo with the right params', async () => {
    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result).toEqual({ success: true, checklistId: 'checklist-1' })
    expect(rpcMock).toHaveBeenCalledWith('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: 'veiculo-1',
      p_equipe_id: 'equipe-destino',
      p_motorista_id: null,
      p_tipo: 'troca',
      p_checklist_id: 'checklist-1',
    })
  })

  it('surfaces an error instead of silently succeeding when the RPC fails', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'lock timeout' } })

    const result = await criarChecklistAction({}, buildTrocaFormData())

    expect(result).toEqual({
      error:
        'Erro ao processar o checklist: a atribuição de equipe não foi registrada. Nenhuma alteração de equipe foi aplicada ao veículo. Contate o suporte.',
      checklistId: 'checklist-1',
    })
  })

  it('não faz mais as escritas de reatribuição direto nas tabelas', async () => {
    await criarChecklistAction({}, buildTrocaFormData())

    expect(callLog).not.toContain('veiculos.update')
    expect(callLog).not.toContain('veiculo_responsabilidade_historico.update')
    expect(callLog).not.toContain('veiculo_responsabilidade_historico.insert')
    expect(callLog).not.toContain('motoristas.update')
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
    // A validação short-circuita antes da chamada rpc — a reatribuição nunca
    // chega a ser tentada.
    expect(rpcMock).not.toHaveBeenCalled()
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
    // A falha acontece antes de chegar na reatribuição de equipe — rpc nunca
    // é chamado.
    expect(rpcMock).not.toHaveBeenCalled()
    // The mock's `makeChainable` only ever registers update/insert/select/eq/
    // is/single/neq/limit — there is no delete method to call, mirroring
    // production: there's no compensating-transaction mechanism, so the
    // already-inserted checklist row is intentionally left in place.
    expect(callLog).not.toContain('checklist.delete')
    expect(callLog).toContain('checklist.insert')
    expect(callLog).toContain('checklist_fotos.insert')
  })
})
