type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'update', 'eq', 'single']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>
let currentUserEmail: string | null

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUserEmail ? { email: currentUserEmail } : null } })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  registrarDescontoMultaAction,
  registrarDescontoSinistroAction,
  desfazerDescontoMultaAction,
  atualizarStatusMultaAction,
} from '../_actions'

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe('descontos/_actions — gate de admin e validação de valor', () => {
  beforeEach(() => {
    currentUserEmail = 'jvictorco28@gmail.com'
    tableResults = {
      multas: { data: { valor: 500 }, error: null },
      sinistros: { data: { valor_dano: 1000 }, error: null },
    }
  })

  it('registrarDescontoMultaAction rejeita usuário não-admin', async () => {
    currentUserEmail = 'operador@manfac.com.br'
    await expect(
      registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '100', tipo_desconto: 'parcial', autorizacao_assinada: 'true' }))
    ).rejects.toThrow('Apenas administradores podem executar esta ação')
  })

  it('registrarDescontoMultaAction rejeita valor maior que o original', async () => {
    await expect(
      registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '600', tipo_desconto: 'total', autorizacao_assinada: 'true' }))
    ).rejects.toThrow('Valor do desconto não pode ser maior que o valor original')
  })

  it('registrarDescontoMultaAction rejeita valor negativo', async () => {
    await expect(
      registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '-50', tipo_desconto: 'parcial', autorizacao_assinada: 'true' }))
    ).rejects.toThrow('Valor do desconto inválido')
  })

  it('registrarDescontoMultaAction aceita valor válido', async () => {
    await expect(
      registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '200', tipo_desconto: 'parcial', autorizacao_assinada: 'true' }))
    ).resolves.toBeUndefined()
  })

  it('registrarDescontoSinistroAction rejeita valor maior que o dano original', async () => {
    await expect(
      registrarDescontoSinistroAction(fd({ id: 's1', valor_descontado: '2000', tipo_desconto: 'total', autorizacao_assinada: 'true' }))
    ).rejects.toThrow('Valor do desconto não pode ser maior que o valor original')
  })

  it('desfazerDescontoMultaAction rejeita usuário não-admin', async () => {
    currentUserEmail = 'operador@manfac.com.br'
    await expect(desfazerDescontoMultaAction('m1')).rejects.toThrow('Apenas administradores podem executar esta ação')
  })

  it('atualizarStatusMultaAction rejeita usuário não-admin', async () => {
    currentUserEmail = 'operador@manfac.com.br'
    await expect(atualizarStatusMultaAction('m1', 'validada')).rejects.toThrow('Apenas administradores podem executar esta ação')
  })
})
