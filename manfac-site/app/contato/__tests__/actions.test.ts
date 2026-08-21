import { registrarLeadAction, completarLeadAction } from '../_actions'

const insert = vi.fn()
const update = vi.fn()
const eq = vi.fn()

// `vi.fn` em vez de objeto fixo: precisa ser controlável por teste para
// simular createAdminClient() lançando (chave de service role ausente no
// processo) — o cenário que já derrubou /admin/acessos em produção em
// 2026-08-09 e que aqui não pode travar o botão em "Enviando…".
const createAdminClientMock = vi.fn(() => ({
  from: () => ({
    insert: (linha: unknown) => {
      insert(linha)
      return {
        select: () => ({
          single: async () => ({ data: { id: 'lead-1' }, error: null }),
        }),
      }
    },
    update: (campos: unknown) => {
      update(campos)
      return {
        eq: async (col: string, val: string) => {
          eq(col, val)
          return { error: null }
        },
      }
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => createAdminClientMock(),
}))

const valido = {
  path: 'Obra ou reforma' as const,
  nome: 'Maria Souza',
  email: 'maria@empresa.com.br',
  telefone: '(21) 99999-0000',
  consentimento: true,
}

describe('registrarLeadAction', () => {
  beforeEach(() => {
    insert.mockClear()
    update.mockClear()
    eq.mockClear()
    createAdminClientMock.mockClear()
  })

  it('grava e devolve o id', async () => {
    const r = await registrarLeadAction(valido)
    expect(r).toEqual({ ok: true, id: 'lead-1' })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('carimba consentido_em junto com o consentimento', async () => {
    await registrarLeadAction(valido)
    const linha = insert.mock.calls[0][0] as Record<string, unknown>
    expect(linha.consentimento).toBe(true)
    expect(typeof linha.consentido_em).toBe('string')
  })

  it('rejeita sem consentimento e NÃO grava', async () => {
    const r = await registrarLeadAction({ ...valido, consentimento: false })
    expect(r.ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita e-mail malformado e NÃO grava', async () => {
    const r = await registrarLeadAction({ ...valido, email: 'maria@' })
    expect(r.ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('armadilha preenchida: responde sucesso e não grava', async () => {
    const r = await registrarLeadAction({ ...valido, armadilha: 'http://spam' })
    expect(r.ok).toBe(true)
    expect(insert).not.toHaveBeenCalled()
  })

  it('devolve { ok: false } em vez de lançar quando createAdminClient lança', async () => {
    createAdminClientMock.mockImplementationOnce(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente')
    })
    const r = await registrarLeadAction(valido)
    expect(r).toEqual({
      ok: false,
      erro: 'Não conseguimos registrar agora. Fale com a gente no WhatsApp.',
    })
  })
})

describe('completarLeadAction', () => {
  beforeEach(() => {
    insert.mockClear()
    update.mockClear()
    eq.mockClear()
    createAdminClientMock.mockClear()
  })

  it('atualiza a linha existente e nunca insere', async () => {
    const r = await completarLeadAction('lead-1', { empresa: 'Rede X' })
    expect(r.ok).toBe(true)
    expect(update).toHaveBeenCalledTimes(1)
    expect(insert).not.toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('id', 'lead-1')
  })

  it('carimba etapa2_em', async () => {
    await completarLeadAction('lead-1', { resumo: 'algo' })
    const campos = update.mock.calls[0][0] as Record<string, unknown>
    expect(typeof campos.etapa2_em).toBe('string')
  })

  it('ignora chamada sem id', async () => {
    const r = await completarLeadAction('', { empresa: 'X' })
    expect(r.ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('devolve { ok: false } em vez de lançar quando createAdminClient lança', async () => {
    createAdminClientMock.mockImplementationOnce(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente')
    })
    const r = await completarLeadAction('lead-1', { empresa: 'Rede X' })
    expect(r).toEqual({ ok: false })
  })
})
