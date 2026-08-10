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
    rpc: rpcMock,
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import { lancarKmAction, deletarKmAction, upsertKmExcedidoStatusAction, atualizarAutorizacaoKmExcedidoAction } from '../_actions'
import { isAdmin } from '@/lib/auth/roles'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const NON_ADMIN_EMAIL = 'operador@manfac.com.br'

beforeEach(() => {
  ;(isAdmin as jest.Mock).mockReset()
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
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
    currentUserEmail = NON_ADMIN_EMAIL
  })

  it('não grava quando o usuário não é admin', async () => {
    const fd = buildFormData({
      veiculo_id: 'veiculo-1',
      mes: '2026-07-01',
      km_contratual: '1000',
      km_realizado: '1200',
      status: 'autorizado',
    })
    await upsertKmExcedidoStatusAction(fd)
    expect(chains.km_excedido_desconto.upsert).not.toHaveBeenCalled()
  })
})

describe('deletarKmAction', () => {
  beforeEach(() => {
    tableResults = { km_diario: { error: null } }
    chains = { km_diario: makeChainable(tableResults.km_diario) }
    currentUserEmail = NON_ADMIN_EMAIL
  })

  it('não exclui quando o usuário não é admin', async () => {
    const fd = buildFormData({ id: 'km-1' })

    const result = await deletarKmAction({}, fd)

    expect(result).toEqual({ error: 'Apenas administradores podem executar esta ação' })
    expect(chains.km_diario.delete).not.toHaveBeenCalled()
  })
})

describe('atualizarAutorizacaoKmExcedidoAction', () => {
  beforeEach(() => {
    tableResults = { km_excedido_desconto: { error: null } }
    chains = { km_excedido_desconto: makeChainable(tableResults.km_excedido_desconto) }
    currentUserEmail = NON_ADMIN_EMAIL
  })

  it('não atualiza quando o usuário não é admin', async () => {
    const fd = buildFormData({ status: 'autorizado' })
    await atualizarAutorizacaoKmExcedidoAction('km-1', fd)
    expect(chains.km_excedido_desconto.update).not.toHaveBeenCalled()
  })
})
