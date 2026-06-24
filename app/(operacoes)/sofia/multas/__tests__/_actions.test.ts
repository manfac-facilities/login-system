const getUserMock = jest.fn()
const auditInsertMock = jest.fn()
const multaInsertMock = jest.fn()
const multaSelectSingleMock = jest.fn()
const multaSelectInMock = jest.fn()
const multaUpdateInEqMock = jest.fn()
const multaDeleteEqMock = jest.fn()
const multaDeleteInMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: auditInsertMock }
      return {
        insert: jest.fn(() => ({ select: jest.fn(() => ({ single: multaInsertMock })) })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ single: multaSelectSingleMock })),
          in: multaSelectInMock,
        })),
        update: jest.fn(() => ({
          in: jest.fn(() => ({ eq: multaUpdateInEqMock })),
        })),
        delete: jest.fn(() => ({
          eq: multaDeleteEqMock,
          in: multaDeleteInMock,
        })),
      }
    }),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import {
  criarMultaAction,
  enviarParaDescontoEmMassaAction,
  excluirMultaAction,
  excluirMultasEmMassaAction,
} from '../_actions'

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
const NON_ADMIN_EMAIL = 'outro.usuario@manfac.com.br'

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

describe('enviarParaDescontoEmMassaAction', () => {
  beforeEach(() => {
    multaUpdateInEqMock.mockReset()
    multaUpdateInEqMock.mockResolvedValue({ error: null })
  })

  it('moves only pending multas to validada', async () => {
    await enviarParaDescontoEmMassaAction(['multa-1', 'multa-2'])
    expect(multaUpdateInEqMock).toHaveBeenCalledWith('status', 'pendente')
  })
})

describe('excluirMultaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaSelectSingleMock.mockReset()
    multaSelectSingleMock.mockResolvedValue({ data: { id: 'multa-1', valor: 100 }, error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    multaDeleteEqMock.mockReset()
    multaDeleteEqMock.mockResolvedValue({ error: null })
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    await expect(excluirMultaAction('multa-1')).rejects.toThrow()
    expect(multaDeleteEqMock).not.toHaveBeenCalled()
  })

  it('logs the deleted row to audit_log before deleting, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    await excluirMultaAction('multa-1')
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', acao: 'exclusao' })
    )
    expect(multaDeleteEqMock).toHaveBeenCalledWith('id', 'multa-1')
  })
})

describe('excluirMultasEmMassaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaSelectInMock.mockReset()
    multaSelectInMock.mockResolvedValue({ data: [{ id: 'multa-1' }, { id: 'multa-2' }], error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    multaDeleteInMock.mockReset()
    multaDeleteInMock.mockResolvedValue({ error: null })
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow()
    expect(multaDeleteInMock).not.toHaveBeenCalled()
  })

  it('logs every deleted row to audit_log, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    await excluirMultasEmMassaAction(['multa-1', 'multa-2'])
    expect(auditInsertMock).toHaveBeenCalledTimes(2)
    expect(multaDeleteInMock).toHaveBeenCalledWith('id', ['multa-1', 'multa-2'])
  })
})
