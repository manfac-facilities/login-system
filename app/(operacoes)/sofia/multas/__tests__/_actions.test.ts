const getUserMock = jest.fn()
const auditInsertMock = jest.fn()
const multaInsertMock = jest.fn()
const multaUpdateInEqMock = jest.fn()
const multaUpdateEqMock = jest.fn()
const multaDeleteEqSelectSingleMock = jest.fn()
const multaDeleteInSelectMock = jest.fn()
const rpcMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
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

jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import {
  criarMultaAction,
  enviarParaDescontoEmMassaAction,
  excluirMultaAction,
  excluirMultasEmMassaAction,
  atualizarAutorizacaoMultaAction,
} from '../_actions'
import { isAdmin } from '@/lib/auth/roles'

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
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', operacao: 'criou' })
    )
  })
})

describe('enviarParaDescontoEmMassaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaUpdateInEqMock.mockReset()
    multaUpdateInEqMock.mockResolvedValue({ error: null })
    ;(isAdmin as jest.Mock).mockReset()
  })

  it('rejects a non-admin user by throwing', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    await expect(enviarParaDescontoEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow(
      'Apenas administradores podem executar esta ação'
    )
    expect(multaUpdateInEqMock).not.toHaveBeenCalled()
  })

  it('moves only pending multas to validada', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
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
    ;(isAdmin as jest.Mock).mockReset()
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result.error).toBeTruthy()
    expect(multaDeleteEqSelectSingleMock).not.toHaveBeenCalled()
  })

  it('logs the deleted row to audit_log after deleting, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result).toEqual({ success: true })
    expect(multaDeleteEqSelectSingleMock).toHaveBeenCalled()
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', operacao: 'excluiu' })
    )
  })

  it('returns an error and does not log to audit_log when the delete fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    multaDeleteEqSelectSingleMock.mockResolvedValue({ data: null, error: new Error('delete failed') })
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result.error).toBeTruthy()
    expect(auditInsertMock).not.toHaveBeenCalled()
  })

  it('returns an error when no row comes back from the delete', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
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
    ;(isAdmin as jest.Mock).mockReset()
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
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
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    ;(isAdmin as jest.Mock).mockReset()
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('calls excluir_multas_em_massa with the ids, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1', email: ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    await excluirMultasEmMassaAction(['multa-1', 'multa-2'])
    // Sem p_usuario_id: o autor da auditoria sai de auth.uid() dentro da
    // function, pra não ser forjável por quem chamar /rpc/ direto.
    expect(rpcMock).toHaveBeenCalledWith('excluir_multas_em_massa', {
      p_ids: ['multa-1', 'multa-2'],
    })
    // O audit log agora é gravado dentro da function, na mesma transação do
    // delete — a action não insere mais em audit_log por fora.
    expect(auditInsertMock).not.toHaveBeenCalled()
  })

  it('propagates the error when the RPC fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1', email: ADMIN_EMAIL } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    rpcMock.mockResolvedValue({ data: null, error: new Error('bulk delete failed') })
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow('bulk delete failed')
  })
})
