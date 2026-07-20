type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['update', 'insert', 'select', 'eq', 'is', 'single', 'neq', 'limit']
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

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { criarChecklistAction } from '../_actions'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    veiculo_id: 'veiculo-1',
    equipe_id: '',
    equipe_destino_id: '',
    motorista_destino_id: '',
    motorista_id: '',
    observacoes: '',
    assinatura_motorista: 'true',
  }
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v)
  return fd
}

describe('criarChecklistAction — devolucao', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { data: { id: 'checklist-1' }, error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('zera a equipe do veículo e fecha o histórico ao devolver', async () => {
    const result = await criarChecklistAction({}, buildFormData({ tipo: 'devolucao', equipe_id: 'equipe-1' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-1' })
  })

  it('surfaces erro se falhar ao zerar a equipe do veículo', async () => {
    tableResults.veiculos = { error: { message: 'falhou' } }
    const result = await criarChecklistAction({}, buildFormData({ tipo: 'devolucao', equipe_id: 'equipe-1' }))
    expect(result.error).toBeTruthy()
  })
})

describe('criarChecklistAction — finalizacao_contrato', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { data: { id: 'checklist-2' }, error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('inativa o veículo ao finalizar contrato', async () => {
    const result = await criarChecklistAction({}, buildFormData({ tipo: 'finalizacao_contrato' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-2' })
  })
})

describe('criarChecklistAction — recebimento com atribuição de equipe', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { data: { id: 'checklist-3' }, error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('atribui a equipe quando equipe_destino_id vem preenchido', async () => {
    const result = await criarChecklistAction(
      {},
      buildFormData({ tipo: 'recebimento', equipe_destino_id: 'equipe-2' })
    )
    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
  })

  it('não mexe em equipe/histórico quando equipe_destino_id vem vazio', async () => {
    const result = await criarChecklistAction({}, buildFormData({ tipo: 'recebimento' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
  })
})
