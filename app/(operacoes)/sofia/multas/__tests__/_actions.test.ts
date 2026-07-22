const getUserMock = jest.fn()
const auditInsertMock = jest.fn()
const multaInsertMock = jest.fn()
const multaUpdateInEqMock = jest.fn()
const multaUpdateEqMock = jest.fn()
const multaDeleteEqSelectSingleMock = jest.fn()
const multaDeleteInSelectMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: auditInsertMock }
      return {
        insert: jest.fn(() => ({ select: jest.fn(() => ({ single: multaInsertMock })) })),
        update: jest.fn(() => ({
          in: jest.fn(() => ({ eq: multaUpdateInEqMock })),
          eq: multaUpdateEqMock,
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({ select: jest.fn(() => ({ single: multaDeleteEqSelectSingleMock })) })),
          in: jest.fn(() => ({ select: multaDeleteInSelectMock })),
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
  atualizarAutorizacaoMultaAction,
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

function buildExclusaoFormData(id = 'multa-1'): FormData {
  const fd = new FormData()
  fd.set('id', id)
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
    getUserMock.mockReset()
    multaUpdateInEqMock.mockReset()
    multaUpdateInEqMock.mockResolvedValue({ error: null })
  })

  it('rejects a non-admin user by throwing', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    await expect(enviarParaDescontoEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow(
      'Apenas administradores podem executar esta ação'
    )
    expect(multaUpdateInEqMock).not.toHaveBeenCalled()
  })

  it('moves only pending multas to validada', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    await enviarParaDescontoEmMassaAction(['multa-1', 'multa-2'])
    expect(multaUpdateInEqMock).toHaveBeenCalledWith('status', 'pendente')
  })
})

describe('excluirMultaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaDeleteEqSelectSingleMock.mockReset()
    multaDeleteEqSelectSingleMock.mockResolvedValue({ data: { id: 'multa-1', valor: 100 }, error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result.error).toBeTruthy()
    expect(multaDeleteEqSelectSingleMock).not.toHaveBeenCalled()
  })

  it('logs the deleted row to audit_log after deleting, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result).toEqual({ success: true })
    expect(multaDeleteEqSelectSingleMock).toHaveBeenCalled()
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', acao: 'exclusao' })
    )
  })

  it('returns an error and does not log to audit_log when the delete fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    multaDeleteEqSelectSingleMock.mockResolvedValue({ data: null, error: new Error('delete failed') })
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result.error).toBeTruthy()
    expect(auditInsertMock).not.toHaveBeenCalled()
  })

  it('returns an error when no row comes back from the delete', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    multaDeleteEqSelectSingleMock.mockResolvedValue({ data: null, error: null })
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result.error).toBe('Multa não encontrada')
    expect(auditInsertMock).not.toHaveBeenCalled()
  })
})

describe('atualizarAutorizacaoMultaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaUpdateEqMock.mockReset()
    multaUpdateEqMock.mockResolvedValue({ error: null })
  })

  it('não atualiza quando o usuário não é admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    const fd = new FormData()
    fd.set('status', 'autorizado')
    await atualizarAutorizacaoMultaAction('multa-1', fd)
    expect(multaUpdateEqMock).not.toHaveBeenCalled()
  })
})

describe('excluirMultasEmMassaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaDeleteInSelectMock.mockReset()
    multaDeleteInSelectMock.mockResolvedValue({ data: [{ id: 'multa-1' }, { id: 'multa-2' }], error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow()
    expect(multaDeleteInSelectMock).not.toHaveBeenCalled()
  })

  it('logs every deleted row to audit_log, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    await excluirMultasEmMassaAction(['multa-1', 'multa-2'])
    expect(auditInsertMock).toHaveBeenCalledTimes(2)
    expect(multaDeleteInSelectMock).toHaveBeenCalled()
  })

  it('propagates the error and does not log to audit_log when the bulk delete fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    multaDeleteInSelectMock.mockResolvedValue({ data: null, error: new Error('bulk delete failed') })
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow('bulk delete failed')
    expect(auditInsertMock).not.toHaveBeenCalled()
  })
})
