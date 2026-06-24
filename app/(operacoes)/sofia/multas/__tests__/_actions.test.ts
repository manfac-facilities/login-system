const getUserMock = jest.fn()
const auditInsertMock = jest.fn()
const multaInsertMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: auditInsertMock }
      return {
        insert: jest.fn(() => ({ select: jest.fn(() => ({ single: multaInsertMock })) })),
      }
    }),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { criarMultaAction } from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    veiculo_id: '',
    motorista_id: '',
    data: '2026-06-01',
    data_recebimento: '2026-06-05',
    tipo_infracao: 'Excesso de velocidade',
    tipo_infracao_outra: '',
    descricao: '',
    valor: '195.23',
    observacoes: '',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const ADMIN_EMAIL = 'jvictorco28@gmail.com'

describe('criarMultaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    multaInsertMock.mockReset()
    multaInsertMock.mockResolvedValue({ data: { id: 'multa-1', valor: 195.23 }, error: null })
  })

  it('accepts a multa with valor 0 instead of rejecting it as missing (falsy-zero regression)', async () => {
    const result = await criarMultaAction({}, buildFormData({ valor: '0' }))

    expect(result).toEqual({ success: true })
  })

  it('still rejects when valor is left blank', async () => {
    const result = await criarMultaAction({}, buildFormData({ valor: '' }))

    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('rejects when tipo_infracao is missing', async () => {
    const result = await criarMultaAction({}, buildFormData({ tipo_infracao: '' }))

    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('rejects when data_recebimento is missing', async () => {
    const result = await criarMultaAction({}, buildFormData({ data_recebimento: '' }))

    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('uses the "Outra" free-text value when tipo_infracao is "outra"', async () => {
    const result = await criarMultaAction(
      {},
      buildFormData({ tipo_infracao: 'outra', tipo_infracao_outra: 'Transporte irregular de carga' })
    )

    expect(result).toEqual({ success: true })
  })

  it('registers a normal multa and logs creation in audit_log', async () => {
    const result = await criarMultaAction({}, buildFormData())

    expect(result).toEqual({ success: true })
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', acao: 'criacao' })
    )
  })
})
