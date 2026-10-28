type TableResult = { data?: unknown; error?: unknown }

const updateMock = jest.fn()
const podeGerirMock = jest.fn()

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'single']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.update = jest.fn((payload: unknown) => {
    updateMock(payload)
    return chain
  })
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>
let currentUserEmail: string | null

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
    rpc: jest.fn((fn: string) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : Promise.reject(new Error(`rpc inesperada: ${fn}`))
    ),
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUserEmail ? { email: currentUserEmail } : null } })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  atualizarStatusMultaAction,
  registrarDescontoMultaAction,
  desfazerDescontoMultaAction,
  atualizarStatusDescontoSinistroAction,
  registrarDescontoSinistroAction,
  desfazerDescontoSinistroAction,
} from '../_actions'

const MSG = 'Apenas administradores ou gestores de frotas podem executar esta ação'

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

beforeEach(() => {
  currentUserEmail = 'operador@manfac.com.br'
  tableResults = {
    multas: { data: { valor: 500 }, error: null },
    sinistros: { data: { valor_dano: 1000 }, error: null },
  }
  updateMock.mockReset()
  podeGerirMock.mockReset()
  podeGerirMock.mockResolvedValue({ data: true, error: null })
})

describe('descontos/_actions — gate de gestor de frotas (as 6 actions)', () => {
  const casos: Array<[string, () => Promise<unknown>]> = [
    ['atualizarStatusMultaAction', () => atualizarStatusMultaAction('m1', 'validada')],
    [
      'registrarDescontoMultaAction',
      () => registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '100', tipo_desconto: 'parcial', autorizacao_assinada: 'true' })),
    ],
    ['desfazerDescontoMultaAction', () => desfazerDescontoMultaAction('m1')],
    ['atualizarStatusDescontoSinistroAction', () => atualizarStatusDescontoSinistroAction('s1', 'validada')],
    [
      'registrarDescontoSinistroAction',
      () => registrarDescontoSinistroAction(fd({ id: 's1', valor_descontado: '100', tipo_desconto: 'parcial', autorizacao_assinada: 'true' })),
    ],
    ['desfazerDescontoSinistroAction', () => desfazerDescontoSinistroAction('s1')],
  ]

  it.each(casos)('%s: gestor de frotas grava', async (_nome, chamar) => {
    await expect(chamar()).resolves.toBeUndefined()
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

  it.each(casos)('%s: quem não pode gerir recebe a mensagem e nada é gravado', async (_nome, chamar) => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    await expect(chamar()).rejects.toThrow(MSG)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it.each(casos)('%s: erro na RPC sofia_pode_gerir nega', async (_nome, chamar) => {
    podeGerirMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    await expect(chamar()).rejects.toThrow(MSG)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it.each(casos)('%s: sem usuário nega sem consultar a RPC', async (_nome, chamar) => {
    currentUserEmail = null
    await expect(chamar()).rejects.toThrow(MSG)
    expect(podeGerirMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('descontos/_actions — validação de valor', () => {
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
})
