const getUserMock = jest.fn()
const podeGerirMock = jest.fn()
const isAdminMock = jest.fn()
const registrarMock = jest.fn()
const selectSingleMock = jest.fn()
const updateEqMock = jest.fn()
const updatePayload: unknown[] = []
const auditInsertMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string, args?: unknown) => {
      if (fn === 'sofia_pode_gerir') return podeGerirMock()
      if (fn === 'sofia_is_admin') return isAdminMock()
      return registrarMock(fn, args)
    }),
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: auditInsertMock }
      return {
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single: selectSingleMock })) })),
        update: jest.fn((p: unknown) => {
          updatePayload.push(p)
          return { eq: updateEqMock }
        }),
      }
    }),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  editarPrazoMultaAction,
  registrarDobroAction,
  registrarEtapaMultaAction,
} from '../_actions'

const SIM = { data: true, error: null }
const NAO = { data: false, error: null }
const MSG_GESTOR = 'Apenas administradores ou gestores de frotas podem executar esta ação'

function fd(campos: Record<string, string> = {}) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

function perfil(p: 'comum' | 'gestor' | 'admin') {
  getUserMock.mockResolvedValue({ data: { user: { id: 'u', email: `${p}@manfac.com.br` } } })
  podeGerirMock.mockResolvedValue(p === 'comum' ? NAO : SIM)
  isAdminMock.mockResolvedValue(p === 'admin' ? SIM : NAO)
}

beforeEach(() => {
  ;[getUserMock, podeGerirMock, isAdminMock, registrarMock, selectSingleMock, updateEqMock, auditInsertMock].forEach(
    (m) => m.mockReset()
  )
  updatePayload.length = 0
  registrarMock.mockResolvedValue({ data: 'ok', error: null })
  updateEqMock.mockResolvedValue({ error: null })
  auditInsertMock.mockResolvedValue({ error: null })
})

describe('registrarEtapaMultaAction — autorização antes de qualquer escrita', () => {
  it('usuário comum é negado antes de chamar a RPC', async () => {
    perfil('comum')
    const r = await registrarEtapaMultaAction('m1', 'indicado', fd({ indicado_em: '2026-11-03' }))
    expect(r).toEqual({ error: MSG_GESTOR })
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('etapa inválida (ou "registrada") é recusada sem chamar nada', async () => {
    perfil('admin')
    expect((await registrarEtapaMultaAction('m1', 'pendente', fd())).error).toBe('Etapa inválida')
    expect((await registrarEtapaMultaAction('m1', 'registrada', fd())).error).toBe('Etapa inválida')
    expect(registrarMock).not.toHaveBeenCalled()
    expect(podeGerirMock).not.toHaveBeenCalled()
  })

  it('GESTOR pedindo "autorizado" é negado sem chamar a RPC', async () => {
    perfil('gestor')
    selectSingleMock.mockResolvedValue({ data: { etapa: 'solicitado' }, error: null })
    const r = await registrarEtapaMultaAction('m1', 'autorizado', fd())
    expect(r).toEqual({ error: 'Só o administrador autoriza o desconto' })
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('GESTOR não revoga (autorizado → solicitado)', async () => {
    perfil('gestor')
    selectSingleMock.mockResolvedValue({ data: { etapa: 'autorizado' }, error: null })
    const r = await registrarEtapaMultaAction('m1', 'solicitado', fd())
    expect(r.error).toBe('Só o administrador autoriza o desconto')
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('erro na RPC sofia_is_admin nega (falha fechada)', async () => {
    perfil('gestor')
    isAdminMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    selectSingleMock.mockResolvedValue({ data: { etapa: 'solicitado' }, error: null })
    expect((await registrarEtapaMultaAction('m1', 'autorizado', fd())).error).toBeTruthy()
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('multa não lida → nega sem chamar a RPC', async () => {
    perfil('admin')
    selectSingleMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect((await registrarEtapaMultaAction('m1', 'autorizado', fd())).error).toBe('Multa não encontrada')
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('ADMIN autoriza: a RPC é chamada', async () => {
    perfil('admin')
    selectSingleMock.mockResolvedValue({ data: { etapa: 'solicitado' }, error: null })
    expect(await registrarEtapaMultaAction('m1', 'autorizado', fd())).toEqual({ success: true })
    expect(registrarMock).toHaveBeenCalledWith('sofia_multa_registrar_etapa', {
      p_multa_id: 'm1',
      p_etapa: 'autorizado',
      p_dados: {},
    })
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', operacao: 'atualizou', descricao: 'Etapa: Autorizar desconto' })
    )
  })

  it('GESTOR desfaz desconto (descontada → autorizado) sem precisar de admin', async () => {
    perfil('gestor')
    selectSingleMock.mockResolvedValue({ data: { etapa: 'descontada' }, error: null })
    expect(await registrarEtapaMultaAction('m1', 'autorizado', fd())).toEqual({ success: true })
    expect(registrarMock).toHaveBeenCalled()
  })
})

describe('registrarEtapaMultaAction — p_dados só com as chaves da etapa', () => {
  beforeEach(() => perfil('gestor'))

  it.each<[string, Record<string, string>, Record<string, string>]>([
    ['condutor', { motorista_id: 'mo1', valor: '999', etapa: 'x' }, { motorista_id: 'mo1' }],
    ['termo', { storage_path: 'multas/m1/termo-1.pdf', motorista_id: 'mo1' }, { storage_path: 'multas/m1/termo-1.pdf' }],
    ['indicado', { indicado_em: '2026-11-03', protocolo: 'P-1', valor_descontado: '1' }, { indicado_em: '2026-11-03', protocolo: 'P-1' }],
    ['validada', { em_nome_de: 'Gestor EQ', canal: 'whatsapp', status: 'descontada' }, { em_nome_de: 'Gestor EQ', canal: 'whatsapp' }],
    ['contestada', { em_nome_de: 'G', canal: 'email', observacao: 'Não era ele' }, { em_nome_de: 'G', canal: 'email', observacao: 'Não era ele' }],
    ['cobrada', { boleto_lancado_em: '2026-11-03', tipo_desconto: 'total' }, { boleto_lancado_em: '2026-11-03' }],
    ['solicitado', { valor_descontado: '50' }, {}],
    [
      'descontada',
      { valor_descontado: '100', tipo_desconto: 'total', competencia: '2026-11', motorista_id: 'x' },
      { valor_descontado: '100', tipo_desconto: 'total', competencia: '2026-11-01' },
    ],
  ])('%s', async (etapa, entrada, esperado) => {
    selectSingleMock.mockResolvedValue({ data: { etapa: 'cobrada' }, error: null })
    const r = await registrarEtapaMultaAction('m1', etapa, fd(entrada))
    expect(r).toEqual({ success: true })
    expect(registrarMock).toHaveBeenCalledWith('sofia_multa_registrar_etapa', {
      p_multa_id: 'm1',
      p_etapa: etapa,
      p_dados: esperado,
    })
  })

  it('termo com caminho de outra multa é recusado antes da RPC', async () => {
    const r = await registrarEtapaMultaAction('m1', 'termo', fd({ storage_path: 'multas/m2/termo.pdf' }))
    expect(r.error).toMatch(/termo/)
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('canal fora da lista é recusado antes da RPC', async () => {
    const r = await registrarEtapaMultaAction('m1', 'validada', fd({ em_nome_de: 'G', canal: 'pombo' }))
    expect(r.error).toBeTruthy()
    expect(registrarMock).not.toHaveBeenCalled()
  })
})

describe('registrarEtapaMultaAction — erro do banco vira mensagem fixa', () => {
  it('nunca repassa error.message', async () => {
    perfil('gestor')
    registrarMock.mockResolvedValue({ data: null, error: { message: 'SEGREDO interno do banco' } })
    const r = await registrarEtapaMultaAction('m1', 'indicado', fd({ indicado_em: '2026-11-03' }))
    expect(r.error).toBe('Não foi possível registrar a indicação. Informe a data da indicação e tente de novo.')
    expect(r.error).not.toContain('SEGREDO')
    expect(auditInsertMock).not.toHaveBeenCalled()
  })
})

describe('editarPrazoMultaAction / registrarDobroAction', () => {
  it('comum não edita prazo (sem UPDATE)', async () => {
    perfil('comum')
    expect((await editarPrazoMultaAction('m1', fd({ prazo_indicacao: '2026-12-01' }))).error).toBe(MSG_GESTOR)
    expect(updateEqMock).not.toHaveBeenCalled()
  })
  it('gestor edita prazo', async () => {
    perfil('gestor')
    expect(await editarPrazoMultaAction('m1', fd({ prazo_indicacao: '2026-12-01' }))).toEqual({ success: true })
    expect(updatePayload[0]).toEqual({ prazo_indicacao: '2026-12-01' })
  })
  it('dobro exige empresa|motorista', async () => {
    perfil('gestor')
    expect((await registrarDobroAction('m1', fd({ responsavel_dobro: 'rh' }))).error).toBeTruthy()
    expect(updateEqMock).not.toHaveBeenCalled()
    expect(await registrarDobroAction('m1', fd({ responsavel_dobro: 'motorista' }))).toEqual({ success: true })
    expect(updatePayload[0]).toEqual({ pago_em_dobro: true, responsavel_dobro: 'motorista' })
  })
  it('comum não registra dobro', async () => {
    perfil('comum')
    expect((await registrarDobroAction('m1', fd({ responsavel_dobro: 'empresa' }))).error).toBe(MSG_GESTOR)
    expect(updateEqMock).not.toHaveBeenCalled()
  })
})
