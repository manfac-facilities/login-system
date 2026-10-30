type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'gte', 'lt', 'order', 'single', 'maybeSingle']) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>
let chains: Record<string, ReturnType<typeof makeChainable>> = {}
let currentUserEmail: string | null = null
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
      if (!chains[table]) chains[table] = makeChainable(tableResults[table] ?? { data: null, error: null })
      return chains[table]
    }),
    rpc: jest.fn((fn: string, args?: unknown) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : rpcMock(fn, args)
    ),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: jest.fn() }))

import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/sofia/auditLog'
import { corrigirKmAction } from '../_actions'

const MSG = 'Apenas administradores ou gestores de frotas podem executar esta ação'
const RETORNO = { placa: 'PLW-3E07', veiculo_id: 'v1', data: '2026-10-23', km_veiculo_antes: 49230, km_veiculo_depois: 48230 }

function fd(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

const corrigirChamado = () => rpcMock.mock.calls.some(([fn]) => fn === 'corrigir_km_atomico')

beforeEach(() => {
  chains = {}
  tableResults = { km_excedido_desconto: { data: null, error: null } }
  currentUserEmail = 'igor@manfac.com.br'
  rpcMock.mockReset()
  rpcMock.mockResolvedValue({ data: RETORNO, error: null })
  podeGerirMock.mockReset()
  podeGerirMock.mockResolvedValue({ data: true, error: null })
  ;(revalidatePath as jest.Mock).mockClear()
  ;(logAudit as jest.Mock).mockClear()
})

describe('corrigirKmAction — permissão (nada escreve antes de requireGestorFrotas)', () => {
  it('sem usuário: nega e não chama a RPC', async () => {
    currentUserEmail = null
    const r = await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230' }))
    expect(r).toEqual({ error: MSG })
    expect(corrigirChamado()).toBe(false)
  })

  it('sofia_pode_gerir false: nega e não chama a RPC', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    const r = await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230' }))
    expect(r).toEqual({ error: MSG })
    expect(corrigirChamado()).toBe(false)
  })

  it('sofia_pode_gerir com erro: nega (falha fechada)', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    const r = await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230' }))
    expect(r).toEqual({ error: MSG })
    expect(corrigirChamado()).toBe(false)
  })
})

describe('corrigirKmAction — validação de entrada', () => {
  it('KM vazio', async () => {
    expect(await corrigirKmAction({}, fd({ id: 'k5', km_novo: '' }))).toEqual({ error: 'Informe o KM correto.' })
    expect(corrigirChamado()).toBe(false)
  })
  it('KM negativo usa a mensagem de validateKmAtual', async () => {
    expect(await corrigirKmAction({}, fd({ id: 'k5', km_novo: '-5' }))).toEqual({ error: 'KM atual não pode ser negativo' })
    expect(corrigirChamado()).toBe(false)
  })
  it('KM não numérico', async () => {
    expect(await corrigirKmAction({}, fd({ id: 'k5', km_novo: 'abc' }))).toEqual({ error: 'KM atual é obrigatório' })
  })
  it('B4: KM não inteiro é recusado com mensagem clara', async () => {
    expect(await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230.5' }))).toEqual({
      error: 'O KM precisa ser um número inteiro, sem vírgula ou ponto.',
    })
    expect(corrigirChamado()).toBe(false)
  })
  it('sem id', async () => {
    expect(await corrigirKmAction({}, fd({ km_novo: '1' }))).toEqual({ error: 'ID inválido' })
  })
})

describe('corrigirKmAction — chamada e retorno', () => {
  it('gestor: chama corrigir_km_atomico com os parâmetros; motivo só espaços vira null', async () => {
    const r = await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230', motivo: '   ' }))
    expect(rpcMock).toHaveBeenCalledWith('corrigir_km_atomico', { p_km_id: 'k5', p_km_novo: 48230, p_motivo: null })
    expect(r).toEqual({ success: true, placa: 'PLW-3E07', veiculoId: 'v1', kmVeiculo: 48230, aviso: undefined })
    expect(revalidatePath).toHaveBeenCalledWith('/sofia/km')
    expect(revalidatePath).toHaveBeenCalledWith('/sofia/veiculos')
    expect(revalidatePath).toHaveBeenCalledWith('/sofia/audit')
    expect(logAudit).not.toHaveBeenCalled()
  })

  it('motivo é repassado aparado', async () => {
    await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230', motivo: ' digitou 9 no lugar de 8 ' }))
    expect(rpcMock).toHaveBeenCalledWith('corrigir_km_atomico', {
      p_km_id: 'k5', p_km_novo: 48230, p_motivo: 'digitou 9 no lugar de 8',
    })
  })

  it('erro SOF01: texto da função repassado', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: 'SOF01', message: 'O KM não pode ser menor que o lançamento anterior: 48.110 km em 22/10/2026.' },
    })
    const r = await corrigirKmAction({}, fd({ id: 'k5', km_novo: '1' }))
    expect(r).toEqual({ error: 'O KM não pode ser menor que o lançamento anterior: 48.110 km em 22/10/2026.' })
  })

  it('outro erro: mensagem genérica', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } })
    expect(await corrigirKmAction({}, fd({ id: 'k5', km_novo: '1' }))).toEqual({ error: 'Erro ao corrigir o KM' })
  })
})

describe('corrigirKmAction — KM excedido: nunca em silêncio, nunca altera', () => {
  it('mês com registro de KM excedido: sucesso com aviso, sem escrever em km_excedido_desconto', async () => {
    tableResults.km_excedido_desconto = { data: { id: 'ke1' }, error: null }
    const r = await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230' }))
    expect(r.success).toBe(true)
    expect(r.aviso).toBe('registro')
    const ch = chains.km_excedido_desconto as Record<string, jest.Mock>
    expect(ch.eq).toHaveBeenCalledWith('veiculo_id', 'v1')
    expect(ch.eq).toHaveBeenCalledWith('mes', '2026-10-01')
    expect(ch.insert).not.toHaveBeenCalled()
    expect(ch.update).not.toHaveBeenCalled()
    expect(ch.upsert).not.toHaveBeenCalled()
    expect(ch.delete).not.toHaveBeenCalled()
  })

  it('falha ao conferir: avisa em vez de calar', async () => {
    tableResults.km_excedido_desconto = { data: null, error: { message: 'timeout' } }
    const r = await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230' }))
    expect(r.success).toBe(true)
    expect(r.aviso).toBe('falha')
  })

  it('mês sem registro: sem aviso e sem escrita (não cria excesso)', async () => {
    const r = await corrigirKmAction({}, fd({ id: 'k5', km_novo: '48230' }))
    expect(r.aviso).toBeUndefined()
    const ch = chains.km_excedido_desconto as Record<string, jest.Mock>
    expect(ch.insert).not.toHaveBeenCalled()
    expect(chains.pendencias).toBeUndefined()
  })
})
