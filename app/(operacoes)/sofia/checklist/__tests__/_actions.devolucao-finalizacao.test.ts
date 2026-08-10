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
const rpcMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    rpc: rpcMock,
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { criarChecklistAction } from '../_actions'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    id: 'checklist-1',
    veiculo_id: 'veiculo-1',
    equipe_id: '',
    equipe_destino_id: '',
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
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v)
  return fd
}

function resetMocks() {
  rpcMock.mockReset()
  rpcMock.mockResolvedValue({ data: null, error: null })
  tableResults = {
    checklist: { error: null },
    checklist_fotos: { error: null },
    // usado só pela leitura de validarVinculoEquipeUnico
    veiculos: { error: null },
  }
}

describe('criarChecklistAction — devolucao', () => {
  beforeEach(resetMocks)

  it('zera a equipe do veículo e fecha o histórico ao devolver', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-1', tipo: 'devolucao', equipe_id: 'equipe-1' }))

    expect(result).toEqual({ success: true, checklistId: 'checklist-1' })
    expect(rpcMock).toHaveBeenCalledWith('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: 'veiculo-1',
      p_equipe_id: null,
      p_motorista_id: null,
      p_tipo: 'devolucao',
      p_checklist_id: 'checklist-1',
    })
  })

  it('surfaces erro nomeando a devolução, não uma troca de responsável', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'falhou' } })
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-1', tipo: 'devolucao', equipe_id: 'equipe-1' }))
    expect(result.error).toBe(
      'Erro ao processar o checklist: a devolução não foi registrada. Nenhuma alteração de equipe foi aplicada ao veículo. Contate o suporte.'
    )
  })
})

describe('criarChecklistAction — finalizacao_contrato', () => {
  beforeEach(resetMocks)

  it('inativa o veículo ao finalizar contrato', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-2', tipo: 'finalizacao_contrato' }))

    expect(result).toEqual({ success: true, checklistId: 'checklist-2' })
    expect(rpcMock).toHaveBeenCalledWith('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: 'veiculo-1',
      p_equipe_id: null,
      p_motorista_id: null,
      p_tipo: 'finalizacao_contrato',
      p_checklist_id: 'checklist-2',
    })
  })
})

describe('criarChecklistAction — recebimento com atribuição de equipe', () => {
  beforeEach(resetMocks)

  it('atribui a equipe quando equipe_destino_id vem preenchido', async () => {
    const result = await criarChecklistAction(
      {},
      buildFormData({ id: 'checklist-3', tipo: 'recebimento', equipe_destino_id: 'equipe-2' })
    )

    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
    expect(rpcMock).toHaveBeenCalledWith('atribuir_responsabilidade_veiculo', {
      p_veiculo_id: 'veiculo-1',
      p_equipe_id: 'equipe-2',
      p_motorista_id: null,
      p_tipo: 'recebimento',
      p_checklist_id: 'checklist-3',
    })
  })

  it('não chama a RPC quando equipe_destino_id vem vazio', async () => {
    const result = await criarChecklistAction({}, buildFormData({ id: 'checklist-3', tipo: 'recebimento' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
