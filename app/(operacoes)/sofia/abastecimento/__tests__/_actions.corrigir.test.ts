let currentUserEmail: string | null = null
const rpcMock = jest.fn()
const podeGerirMock = jest.fn()
const fromMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: currentUserEmail ? { email: currentUserEmail } : null },
      })),
    },
    from: fromMock,
    rpc: jest.fn((fn: string, args?: unknown) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : rpcMock(fn, args)
    ),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: jest.fn() }))

import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/sofia/auditLog'
import { corrigirAbastecimentoAction } from '../_actions'

const MSG = 'Apenas administradores ou gestores de frotas podem executar esta ação'

function fd(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}
const base = { id: 'a4', litros: '42.3', valor: '253.38', km: '48305' }
const corrigirChamado = () => rpcMock.mock.calls.some(([fn]) => fn === 'corrigir_abastecimento')

beforeEach(() => {
  currentUserEmail = 'igor@manfac.com.br'
  rpcMock.mockReset()
  rpcMock.mockResolvedValue({ data: null, error: null })
  podeGerirMock.mockReset()
  podeGerirMock.mockResolvedValue({ data: true, error: null })
  fromMock.mockClear()
  ;(revalidatePath as jest.Mock).mockClear()
  ;(logAudit as jest.Mock).mockClear()
})

describe('corrigirAbastecimentoAction — permissão', () => {
  it('sem usuário: nega sem RPC', async () => {
    currentUserEmail = null
    expect(await corrigirAbastecimentoAction({}, fd(base))).toEqual({ error: MSG })
    expect(corrigirChamado()).toBe(false)
  })
  it('sofia_pode_gerir false: nega sem RPC', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await corrigirAbastecimentoAction({}, fd(base))).toEqual({ error: MSG })
    expect(corrigirChamado()).toBe(false)
  })
  it('sofia_pode_gerir com erro: nega', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    expect(await corrigirAbastecimentoAction({}, fd(base))).toEqual({ error: MSG })
    expect(corrigirChamado()).toBe(false)
  })
})

describe('corrigirAbastecimentoAction — validação (mensagens do mockup)', () => {
  it.each([
    [{ litros: '' }, 'Informe os litros abastecidos.'],
    [{ litros: '-1' }, 'Informe os litros abastecidos.'],
    [{ valor: '' }, 'Informe o valor do abastecimento.'],
    [{ valor: 'x' }, 'Informe o valor do abastecimento.'],
    [{ km: '-3' }, 'KM inválido.'],
    [{ km: '100.5' }, 'KM inválido.'],
  ])('%o -> %s', async (campo, msg) => {
    expect(await corrigirAbastecimentoAction({}, fd({ ...base, ...campo }))).toEqual({ error: msg })
    expect(corrigirChamado()).toBe(false)
  })
})

describe('corrigirAbastecimentoAction — chamada', () => {
  it('gestor: chama corrigir_abastecimento; km vazio vira null; motivo aparado', async () => {
    const r = await corrigirAbastecimentoAction({}, fd({ ...base, km: '', motivo: ' vírgula no lugar errado ' }))
    expect(rpcMock).toHaveBeenCalledWith('corrigir_abastecimento', {
      p_abastecimento_id: 'a4', p_litros: 42.3, p_valor: 253.38, p_km: null, p_motivo: 'vírgula no lugar errado',
    })
    expect(r).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith('/sofia/abastecimento')
    expect(revalidatePath).toHaveBeenCalledWith('/sofia/custos')
    expect(revalidatePath).toHaveBeenCalledWith('/sofia/audit')
    expect(logAudit).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled() // nenhuma escrita direta em tabela
  })

  it('motivo vazio vira null', async () => {
    await corrigirAbastecimentoAction({}, fd({ ...base, motivo: '  ' }))
    expect(rpcMock).toHaveBeenCalledWith('corrigir_abastecimento', expect.objectContaining({ p_motivo: null, p_km: 48305 }))
  })

  it('SOF01 repassado', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'SOF01', message: 'Nada foi alterado.' } })
    expect(await corrigirAbastecimentoAction({}, fd(base))).toEqual({ error: 'Nada foi alterado.' })
  })

  it('outro erro: genérico', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } })
    expect(await corrigirAbastecimentoAction({}, fd(base))).toEqual({ error: 'Erro ao corrigir o abastecimento' })
  })
})
