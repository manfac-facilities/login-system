type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'gte', 'lt', 'order', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>
let currentUserEmail: string | null = null
let chains: Record<string, ReturnType<typeof makeChainable>> = {}
const rpcMock = jest.fn()
const podeGerirMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: currentUserEmail ? { email: currentUserEmail } : null },
      })),
    },
    from: jest.fn((table: string) => {
      if (!chains[table]) chains[table] = makeChainable(tableResults[table])
      return chains[table]
    }),
    // sofia_pode_gerir (gate) fica separado do rpcMock (lancar_km_atomico)
    rpc: jest.fn((fn: string, args?: unknown) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : rpcMock(fn, args)
    ),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: jest.fn() }))

import { lancarKmAction, deletarKmAction, upsertKmExcedidoStatusAction, atualizarAutorizacaoKmExcedidoAction } from '../_actions'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const USER_EMAIL = 'operador@manfac.com.br'
const MSG = 'Apenas administradores ou gestores de frotas podem executar esta ação'
const PODE = { data: true, error: null }
const NAO_PODE = { data: false, error: null }
const ERRO_RPC = { data: true, error: { message: 'x' } }

beforeEach(() => {
  podeGerirMock.mockReset()
  podeGerirMock.mockResolvedValue(NAO_PODE)
})

describe('lancarKmAction — via lancar_km_atomico', () => {
  beforeEach(() => {
    chains = {}
    currentUserEmail = null
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    tableResults = {
      veiculos: { data: { km_contratual_mensal: null, placa: 'ABC-1234' }, error: null },
      km_diario: { data: [], error: null },
    }
  })

  it('chama lancar_km_atomico com os parâmetros certos', async () => {
    await lancarKmAction(
      {},
      buildFormData({
        equipe_id: 'equipe-1',
        veiculo_id: 'veiculo-1',
        motorista_id: 'motorista-1',
        km_atual: '1500',
        data: '2026-07-18',
        observacoes: 'tudo certo',
      })
    )

    expect(rpcMock).toHaveBeenCalledWith('lancar_km_atomico', {
      p_equipe_id: 'equipe-1',
      p_veiculo_id: 'veiculo-1',
      p_motorista_id: 'motorista-1',
      p_km_atual: 1500,
      p_data: '2026-07-18',
      p_observacoes: 'tudo certo',
    })
  })

  it('surfaces a mensagem de erro exata que a function retorna (regra de KM menor)', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'SOF01', message: 'KM não pode ser menor que a última KM registrada (2.000 km)' },
    })

    const result = await lancarKmAction(
      {},
      buildFormData({ equipe_id: 'equipe-1', veiculo_id: 'veiculo-1', km_atual: '1500', data: '2026-07-18' })
    )

    expect(result).toEqual({ error: 'KM não pode ser menor que a última KM registrada (2.000 km)' })
  })

  it('esconde erro interno do Postgres atrás da mensagem genérica', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied for function lancar_km_atomico' },
    })

    const result = await lancarKmAction(
      {},
      buildFormData({ equipe_id: 'equipe-1', veiculo_id: 'veiculo-1', km_atual: '1500', data: '2026-07-18' })
    )

    expect(result).toEqual({ error: 'Erro ao registrar KM' })
  })

  it('não faz mais o lançamento por escritas separadas — só a chamada rpc', async () => {
    await lancarKmAction(
      {},
      buildFormData({ equipe_id: 'equipe-1', veiculo_id: 'veiculo-1', km_atual: '1500', data: '2026-07-18' })
    )

    // chains.veiculos/km_diario ainda existem, mas só por causa de
    // verificarERegistrarExcedencia, que roda DEPOIS e é só leitura.
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(chains.km_diario.upsert).not.toHaveBeenCalled()
    expect(chains.veiculos.update).not.toHaveBeenCalled()
  })
})

describe('upsertKmExcedidoStatusAction', () => {
  beforeEach(() => {
    tableResults = { km_excedido_desconto: { error: null } }
    chains = { km_excedido_desconto: makeChainable(tableResults.km_excedido_desconto) }
    currentUserEmail = USER_EMAIL
  })
  const fd = () =>
    buildFormData({
      veiculo_id: 'veiculo-1',
      mes: '2026-07-01',
      km_contratual: '1000',
      km_realizado: '1200',
      status: 'autorizado',
    })

  it('gestor de frotas grava', async () => {
    podeGerirMock.mockResolvedValue(PODE)
    await upsertKmExcedidoStatusAction(fd())
    expect(chains.km_excedido_desconto.upsert).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['não pode gerir', NAO_PODE],
    ['erro na RPC', ERRO_RPC],
  ])('não grava quando %s', async (_n, resposta) => {
    podeGerirMock.mockResolvedValue(resposta)
    await upsertKmExcedidoStatusAction(fd())
    expect(chains.km_excedido_desconto.upsert).not.toHaveBeenCalled()
  })
})

describe('deletarKmAction', () => {
  beforeEach(() => {
    tableResults = { km_diario: { error: null } }
    chains = { km_diario: makeChainable(tableResults.km_diario) }
    currentUserEmail = USER_EMAIL
  })

  it('gestor de frotas exclui', async () => {
    podeGerirMock.mockResolvedValue(PODE)
    const result = await deletarKmAction({}, buildFormData({ id: 'km-1' }))
    expect(result).toEqual({ success: true })
    expect(chains.km_diario.delete).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['não pode gerir', NAO_PODE],
    ['erro na RPC', ERRO_RPC],
  ])('não exclui quando %s', async (_n, resposta) => {
    podeGerirMock.mockResolvedValue(resposta)
    const result = await deletarKmAction({}, buildFormData({ id: 'km-1' }))
    expect(result).toEqual({ error: MSG })
    expect(chains.km_diario.delete).not.toHaveBeenCalled()
  })
})

describe('atualizarAutorizacaoKmExcedidoAction', () => {
  beforeEach(() => {
    tableResults = { km_excedido_desconto: { error: null } }
    chains = { km_excedido_desconto: makeChainable(tableResults.km_excedido_desconto) }
    currentUserEmail = USER_EMAIL
  })

  it('gestor de frotas atualiza', async () => {
    podeGerirMock.mockResolvedValue(PODE)
    await atualizarAutorizacaoKmExcedidoAction('km-1', buildFormData({ status: 'autorizado' }))
    expect(chains.km_excedido_desconto.update).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['não pode gerir', NAO_PODE],
    ['erro na RPC', ERRO_RPC],
  ])('não atualiza quando %s', async (_n, resposta) => {
    podeGerirMock.mockResolvedValue(resposta)
    await atualizarAutorizacaoKmExcedidoAction('km-1', buildFormData({ status: 'autorizado' }))
    expect(chains.km_excedido_desconto.update).not.toHaveBeenCalled()
  })
})
