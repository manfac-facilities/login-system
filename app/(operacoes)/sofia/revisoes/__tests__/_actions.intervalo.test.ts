// definirIntervaloRevisaoAction (spec 2026-11-03 §1.4): só gestor; 1.000–100.000 ou vazio.
const updateMock = jest.fn()
const eqMock = jest.fn()
const podeGerirMock = jest.fn()
const logAuditMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { email: 'igor@manfac.com.br' } } })) },
    rpc: jest.fn(() => podeGerirMock()),
    from: jest.fn(() => ({ update: updateMock })),
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }))

import { definirIntervaloRevisaoAction } from '../_actions'
import { MSG_SEM_PERMISSAO_FROTAS } from '@/lib/sofia/permissoes'

const fd = (v: string) => {
  const f = new FormData()
  f.set('veiculo_id', 'v1')
  f.set('intervalo_revisao_km', v)
  return f
}

beforeEach(() => {
  updateMock.mockReset()
  eqMock.mockReset()
  eqMock.mockResolvedValue({ error: null })
  updateMock.mockReturnValue({ eq: eqMock })
  logAuditMock.mockReset()
  podeGerirMock.mockResolvedValue({ data: true, error: null })
})

describe('definirIntervaloRevisaoAction', () => {
  it('15.000 grava e audita', async () => {
    expect(await definirIntervaloRevisaoAction({}, fd('15000'))).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ intervalo_revisao_km: 15000 })
    expect(eqMock).toHaveBeenCalledWith('id', 'v1')
    expect(logAuditMock).toHaveBeenCalledWith('veiculos', 'atualizou', 'v1', 'Intervalo de revisão: 15.000 km')
  })

  it('vazio volta ao padrão (null)', async () => {
    expect(await definirIntervaloRevisaoAction({}, fd(''))).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ intervalo_revisao_km: null })
  })

  it('500 → erro e nada gravado', async () => {
    expect((await definirIntervaloRevisaoAction({}, fd('500'))).error).toMatch(/entre 1\.000 e 100\.000/)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('sem gestor → negado', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await definirIntervaloRevisaoAction({}, fd('15000'))).toEqual({ error: MSG_SEM_PERMISSAO_FROTAS })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
