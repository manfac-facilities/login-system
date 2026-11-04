const getUserMock = jest.fn()
const auditInsertMock = jest.fn()
const multaInsertMock = jest.fn()
const multaUpdateInEqMock = jest.fn()
const multaUpdateEqMock = jest.fn()
const multaDeleteEqSelectSingleMock = jest.fn()
const multaDeleteInSelectMock = jest.fn()
const rpcMock = jest.fn()
const multaInsertPayload: unknown[] = []
const podeGerirMock = jest.fn()
const isAdminMock = jest.fn()
const multaSelectSingleMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    // sofia_pode_gerir (gate) fica separado do rpcMock (excluir_multas_em_massa)
    rpc: jest.fn((fn: string, args?: unknown) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : fn === 'sofia_is_admin' ? isAdminMock() : rpcMock(fn, args)
    ),
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: auditInsertMock }
      return {
        insert: jest.fn((payload: unknown) => {
          multaInsertPayload.push(payload)
          return { select: jest.fn(() => ({ single: multaInsertMock })) }
        }),
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single: multaSelectSingleMock })) })),
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
const PODE = { data: true, error: null }
const NAO_PODE = { data: false, error: null }
const ERRO_RPC = { data: true, error: { message: 'x' } }
const MSG_EXCLUIR = 'Apenas administradores ou gestores de frotas podem excluir multas'

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

  it('prazo de indicação vazio vira recebimento + 30 dias; campos novos vão no insert', async () => {
    multaInsertPayload.length = 0
    const result = await criarMultaAction(
      {},
      buildFormData({ data_recebimento: '2026-11-03', locadora: 'Maestro', auto_infracao: 'A-1', orgao_autuador: 'DETRAN-RJ', pontos: '4' })
    )
    expect(result).toEqual({ success: true })
    expect(multaInsertPayload[0]).toEqual(
      expect.objectContaining({
        prazo_indicacao: '2026-12-03',
        locadora: 'Maestro',
        auto_infracao: 'A-1',
        orgao_autuador: 'DETRAN-RJ',
        pontos: 4,
      })
    )
  })

  it('prazo informado é respeitado; pontos vazio vira null', async () => {
    multaInsertPayload.length = 0
    await criarMultaAction({}, buildFormData({ prazo_indicacao: '2026-07-20', pontos: '' }))
    expect(multaInsertPayload[0]).toEqual(expect.objectContaining({ prazo_indicacao: '2026-07-20', pontos: null }))
  })

  it.each(['-1', '2.5', 'abc'])('pontos inválido (%s) é recusado sem gravar', async (pontos) => {
    const result = await criarMultaAction({}, buildFormData({ pontos }))
    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('registers a normal multa and logs creation in audit_log', async () => {
    const result = await criarMultaAction({}, buildFormData())
    expect(result).toEqual({ success: true })
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', operacao: 'criou' })
    )
  })
})

describe('excluirMultaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaDeleteEqSelectSingleMock.mockReset()
    multaDeleteEqSelectSingleMock.mockResolvedValue({ data: { id: 'multa-1', valor: 100 }, error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    ;podeGerirMock.mockReset()
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    ;podeGerirMock.mockResolvedValue(NAO_PODE)
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result).toEqual({ error: MSG_EXCLUIR })
    expect(multaDeleteEqSelectSingleMock).not.toHaveBeenCalled()
  })

  it('logs the deleted row to audit_log after deleting, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    ;podeGerirMock.mockResolvedValue(PODE)
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result).toEqual({ success: true })
    expect(multaDeleteEqSelectSingleMock).toHaveBeenCalled()
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', operacao: 'excluiu' })
    )
  })

  it('returns an error and does not log to audit_log when the delete fails', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    ;podeGerirMock.mockResolvedValue(PODE)
    multaDeleteEqSelectSingleMock.mockResolvedValue({ data: null, error: new Error('delete failed') })
    const result = await excluirMultaAction({}, buildExclusaoFormData())
    expect(result.error).toBeTruthy()
    expect(auditInsertMock).not.toHaveBeenCalled()
  })

  it('returns an error when no row comes back from the delete', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    ;podeGerirMock.mockResolvedValue(PODE)
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
    ;podeGerirMock.mockReset()
    ;podeGerirMock.mockResolvedValue(NAO_PODE)
  })

  it('não atualiza quando o usuário não é admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    const fd = new FormData()
    fd.set('status', 'autorizado')
    await atualizarAutorizacaoMultaAction('multa-1', fd)
    expect(multaUpdateEqMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('excluirMultasEmMassaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: null, error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    ;podeGerirMock.mockReset()
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    ;podeGerirMock.mockResolvedValue(NAO_PODE)
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow(MSG_EXCLUIR)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('calls excluir_multas_em_massa with the ids, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'admin-1', email: ADMIN_EMAIL } } })
    ;podeGerirMock.mockResolvedValue(PODE)
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
    ;podeGerirMock.mockResolvedValue(PODE)
    rpcMock.mockResolvedValue({ data: null, error: new Error('bulk delete failed') })
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow('bulk delete failed')
  })
})

describe('erro na RPC sofia_pode_gerir nega (falha fechado)', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u-1', email: NON_ADMIN_EMAIL } } })
    podeGerirMock.mockReset()
    podeGerirMock.mockResolvedValue(ERRO_RPC)
    multaUpdateInEqMock.mockReset()
    multaUpdateEqMock.mockReset()
    multaDeleteEqSelectSingleMock.mockReset()
    rpcMock.mockReset()
  })

  it('excluirMultaAction', async () => {
    expect(await excluirMultaAction({}, buildExclusaoFormData())).toEqual({ error: MSG_EXCLUIR })
    expect(multaDeleteEqSelectSingleMock).not.toHaveBeenCalled()
  })

  it('excluirMultasEmMassaAction', async () => {
    await expect(excluirMultasEmMassaAction(['multa-1'])).rejects.toThrow(MSG_EXCLUIR)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('atualizarAutorizacaoMultaAction', async () => {
    const fd = new FormData()
    fd.set('status', 'autorizado')
    await atualizarAutorizacaoMultaAction('multa-1', fd)
    expect(multaUpdateEqMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('atualizarAutorizacaoMultaAction — agora pelo fluxo de etapas', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    podeGerirMock.mockReset()
    podeGerirMock.mockResolvedValue(PODE)
    isAdminMock.mockReset()
    isAdminMock.mockResolvedValue(NAO_PODE)
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: 'x', error: null })
    multaSelectSingleMock.mockReset()
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
  })

  it('gestor de frotas solicita: chama a RPC com a etapa solicitado', async () => {
    multaSelectSingleMock.mockResolvedValue({ data: { etapa: 'cobrada' }, error: null })
    const fd = new FormData()
    fd.set('status', 'solicitado')
    await atualizarAutorizacaoMultaAction('multa-1', fd)
    expect(rpcMock).toHaveBeenCalledWith('sofia_multa_registrar_etapa', {
      p_multa_id: 'multa-1',
      p_etapa: 'solicitado',
      p_dados: {},
    })
  })

  it('gestor de frotas NÃO autoriza: a RPC nem é chamada', async () => {
    multaSelectSingleMock.mockResolvedValue({ data: { etapa: 'solicitado' }, error: null })
    const fd = new FormData()
    fd.set('status', 'autorizado')
    await atualizarAutorizacaoMultaAction('multa-1', fd)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('sem_solicitacao vira "cobrada" (cancelar solicitação)', async () => {
    const fd = new FormData()
    fd.set('status', 'sem_solicitacao')
    await atualizarAutorizacaoMultaAction('multa-1', fd)
    expect(rpcMock).toHaveBeenCalledWith('sofia_multa_registrar_etapa', expect.objectContaining({ p_etapa: 'cobrada' }))
  })
})
