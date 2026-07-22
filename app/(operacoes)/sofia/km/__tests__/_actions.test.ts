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
let currentUserEmail: string | null = null
let chains: Record<string, ReturnType<typeof makeChainable>> = {}

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
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: jest.fn() }))

import { lancarKmAction, upsertKmExcedidoStatusAction, atualizarAutorizacaoKmExcedidoAction } from '../_actions'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const NON_ADMIN_EMAIL = 'operador@manfac.com.br'

describe('lancarKmAction — chave de conflito', () => {
  beforeEach(() => {
    lastUpsertArgs = []
    chains = {}
    currentUserEmail = null
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
