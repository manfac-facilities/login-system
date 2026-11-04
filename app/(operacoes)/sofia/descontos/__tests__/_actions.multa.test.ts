/**
 * Descontos de MULTA pelo fluxo de etapas (spec 2026-11-03 §2.1/§2.6/§4.3).
 * Depois de sdd-sql-sofia-multa-avaria.sql, status/valor_descontado/tipo_desconto
 * de multas só mudam pela RPC sofia_multa_registrar_etapa: nada aqui pode fazer
 * UPDATE direto em multas.
 */
const getUserMock = jest.fn()
const podeGerirMock = jest.fn()
const isAdminMock = jest.fn()
const registrarMock = jest.fn()
const selectSingleMock = jest.fn()
const updateMock = jest.fn()
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
          updateMock(table, p)
          return { eq: jest.fn(async () => ({ error: null })) }
        }),
      }
    }),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import * as acoes from '../_actions'
import { registrarDescontoMultaAction, desfazerDescontoMultaAction } from '../_actions'

const MSG_GESTOR = 'Apenas administradores ou gestores de frotas podem executar esta ação'

function fd(campos: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

const DESCONTO_OK = { id: 'm1', valor_descontado: '200', tipo_desconto: 'parcial', competencia: '2026-11' }

function perfil(p: 'comum' | 'gestor' | 'erro' | 'sem_usuario') {
  getUserMock.mockResolvedValue({
    data: { user: p === 'sem_usuario' ? null : { id: 'u', email: `${p}@manfac.com.br` } },
  })
  podeGerirMock.mockResolvedValue(
    p === 'gestor' ? { data: true, error: null } : p === 'erro' ? { data: true, error: { message: 'x' } } : { data: false, error: null }
  )
}

beforeEach(() => {
  ;[getUserMock, podeGerirMock, isAdminMock, registrarMock, selectSingleMock, updateMock, auditInsertMock].forEach((m) =>
    m.mockReset()
  )
  isAdminMock.mockResolvedValue({ data: false, error: null })
  registrarMock.mockResolvedValue({ data: 'ok', error: null })
  auditInsertMock.mockResolvedValue({ error: null })
  selectSingleMock.mockResolvedValue({ data: { valor: 500, etapa: 'autorizado' }, error: null })
  perfil('gestor')
})

describe('atualizarStatusMultaAction deixou de existir', () => {
  it('não é mais exportada (avançar a multa é no fluxo da multa)', () => {
    expect((acoes as Record<string, unknown>).atualizarStatusMultaAction).toBeUndefined()
  })
})

describe('registrarDescontoMultaAction — pela etapa "descontada"', () => {
  it('gestor registra: chama a RPC com valor, tipo e competência (dia 1), sem UPDATE direto', async () => {
    const r = await registrarDescontoMultaAction({}, fd(DESCONTO_OK))
    expect(r).toEqual({ success: true })
    expect(registrarMock).toHaveBeenCalledWith('sofia_multa_registrar_etapa', {
      p_multa_id: 'm1',
      p_etapa: 'descontada',
      p_dados: { valor_descontado: '200', tipo_desconto: 'parcial', competencia: '2026-11-01' },
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('desconto total também passa', async () => {
    const r = await registrarDescontoMultaAction({}, fd({ ...DESCONTO_OK, valor_descontado: '500', tipo_desconto: 'total' }))
    expect(r).toEqual({ success: true })
  })

  it.each(['comum', 'erro', 'sem_usuario'] as const)('%s: negado antes de ler ou escrever', async (p) => {
    perfil(p)
    const r = await registrarDescontoMultaAction({}, fd(DESCONTO_OK))
    expect(r).toEqual({ error: MSG_GESTOR })
    expect(selectSingleMock).not.toHaveBeenCalled()
    expect(registrarMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('valor negativo ou vazio é recusado', async () => {
    expect(await registrarDescontoMultaAction({}, fd({ ...DESCONTO_OK, valor_descontado: '-50' }))).toEqual({
      error: 'Valor do desconto inválido',
    })
    expect(await registrarDescontoMultaAction({}, fd({ ...DESCONTO_OK, valor_descontado: '' }))).toEqual({
      error: 'Valor do desconto inválido',
    })
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('valor maior que o da multa é recusado', async () => {
    const r = await registrarDescontoMultaAction({}, fd({ ...DESCONTO_OK, valor_descontado: '600' }))
    expect(r).toEqual({ error: 'Valor do desconto não pode ser maior que o valor original' })
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('tipo precisa ser total ou parcial', async () => {
    const r = await registrarDescontoMultaAction({}, fd({ ...DESCONTO_OK, tipo_desconto: 'nenhum' }))
    expect(r).toEqual({ error: 'Informe o tipo de desconto (total ou parcial)' })
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('competência é obrigatória (mês do contracheque)', async () => {
    const r = await registrarDescontoMultaAction({}, fd({ ...DESCONTO_OK, competencia: '' }))
    expect(r).toEqual({ error: 'Informe a competência (mês do contracheque)' })
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('multa não encontrada não chama a RPC', async () => {
    selectSingleMock.mockResolvedValue({ data: null, error: { message: 'nada' } })
    const r = await registrarDescontoMultaAction({}, fd(DESCONTO_OK))
    expect(r).toEqual({ error: 'Multa não encontrada' })
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('recusa do banco vira mensagem fixa (sem repassar error.message)', async () => {
    registrarMock.mockResolvedValue({ data: null, error: { message: 'Desconto só pode ser registrado depois de autorizado' } })
    const r = await registrarDescontoMultaAction({}, fd(DESCONTO_OK))
    expect(r.error).toMatch(/^Não foi possível registrar o desconto/)
  })
})

describe('desfazerDescontoMultaAction — descontada → autorizado (spec §2.1)', () => {
  it('gestor desfaz: RPC com a etapa "autorizado", sem UPDATE direto', async () => {
    const r = await desfazerDescontoMultaAction('m1', {})
    expect(r).toEqual({ success: true })
    expect(registrarMock).toHaveBeenCalledWith('sofia_multa_registrar_etapa', {
      p_multa_id: 'm1',
      p_etapa: 'autorizado',
      p_dados: {},
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it.each(['comum', 'erro', 'sem_usuario'] as const)('%s: negado sem chamar a RPC', async (p) => {
    perfil(p)
    const r = await desfazerDescontoMultaAction('m1', {})
    expect(r).toEqual({ error: MSG_GESTOR })
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('recusa do banco aparece como erro', async () => {
    registrarMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    const r = await desfazerDescontoMultaAction('m1', {})
    expect(r.error).toBeTruthy()
  })
})
