import { registrarLeadAction, completarLeadAction } from '../_actions'
import { TEXTO_CONSENTIMENTO } from '@/lib/leads'

const insert = vi.fn()
const update = vi.fn()
const is = vi.fn()
const eq = vi.fn()

// Resultados configuráveis por teste: `insertResultado` cobre o ramo de erro
// do Supabase na etapa 1 (distinto do ramo de exceção, já coberto abaixo);
// `updateResultado` cobre o `.select('id')` que prova se o `.is('etapa2_em',
// null)` realmente bloqueou (ou não) uma segunda escrita.
let insertResultado: { data: { id: string } | null; error: { message: string } | null } = {
  data: { id: 'lead-1' },
  error: null,
}
let updateResultado: { data: { id: string }[] | null; error: { message: string } | null } = {
  data: [{ id: 'lead-1' }],
  error: null,
}

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
          single: async () => insertResultado,
        }),
      }
    },
    update: (campos: unknown) => {
      update(campos)
      return {
        is: (col: string, val: unknown) => {
          is(col, val)
          return {
            eq: (col2: string, val2: string) => {
              eq(col2, val2)
              return {
                select: async () => updateResultado,
              }
            },
          }
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('registrarLeadAction', () => {
  beforeEach(() => {
    insert.mockClear()
    update.mockClear()
    is.mockClear()
    eq.mockClear()
    createAdminClientMock.mockClear()
    insertResultado = { data: { id: 'lead-1' }, error: null }
    updateResultado = { data: [{ id: 'lead-1' }], error: null }
  })

  it('grava e devolve o id', async () => {
    const r = await registrarLeadAction(valido)
    expect(r).toEqual({ ok: true, id: 'lead-1' })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('carimba consentido_em e consentimento_texto junto com o consentimento', async () => {
    await registrarLeadAction(valido)
    const linha = insert.mock.calls[0][0] as Record<string, unknown>
    expect(linha.consentimento).toBe(true)
    expect(typeof linha.consentido_em).toBe('string')
    // Se TEXTO_CONSENTIMENTO mudar um dia, as linhas antigas precisam
    // continuar apontando para o texto que a pessoa realmente aceitou —
    // por isso o texto em si é gravado, não só o booleano e o carimbo.
    expect(linha.consentimento_texto).toBe(TEXTO_CONSENTIMENTO)
  })

  it('rejeita sem consentimento e NÃO grava', async () => {
    const r = await registrarLeadAction({ ...valido, consentimento: false })
    expect(r).toMatchObject({ ok: false, falha: 'validacao' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita e-mail malformado e NÃO grava', async () => {
    const r = await registrarLeadAction({ ...valido, email: 'maria@' })
    expect(r).toMatchObject({ ok: false, falha: 'validacao' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita path fora da lista válida e NÃO grava', async () => {
    // `DemandPath` some na compilação: registrarLeadAction é endpoint
    // público não autenticado, então o `as any` aqui simula exatamente o
    // que um cliente HTTP malicioso pode mandar.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await registrarLeadAction({ ...valido, path: 'Qualquer coisa' as any })
    expect(r).toMatchObject({ ok: false, falha: 'validacao' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita nome acima do limite e NÃO grava', async () => {
    const r = await registrarLeadAction({ ...valido, nome: 'A'.repeat(121) })
    expect(r).toMatchObject({ ok: false, falha: 'validacao' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita e-mail acima do limite e NÃO grava', async () => {
    const emailGigante = `${'a'.repeat(250)}@x.com`
    const r = await registrarLeadAction({ ...valido, email: emailGigante })
    expect(r).toMatchObject({ ok: false, falha: 'validacao' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita telefone acima do limite e NÃO grava', async () => {
    const r = await registrarLeadAction({ ...valido, telefone: '9'.repeat(31) })
    expect(r).toMatchObject({ ok: false, falha: 'validacao' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('armadilha preenchida: responde sucesso com um id real e não grava', async () => {
    const r = await registrarLeadAction({ ...valido, armadilha: 'http://spam' })
    expect(r.ok).toBe(true)
    // A armadilha antes devolvia id: '' — um robô distingue esse caso do
    // caminho real na hora, o que anula a razão de responder sucesso.
    expect((r as { id: string }).id).toMatch(UUID_RE)
    expect(insert).not.toHaveBeenCalled()
  })

  it('armadilha preenchida: avisa no log para não confundir com "não vem spam"', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await registrarLeadAction({ ...valido, armadilha: 'http://spam' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('armadilha'))
    warn.mockRestore()
  })

  it('devolve falha "infra" quando o Supabase responde erro', async () => {
    insertResultado = { data: null, error: { message: 'conexão recusada' } }
    const r = await registrarLeadAction(valido)
    expect(r).toMatchObject({ ok: false, falha: 'infra' })
  })

  it('devolve falha "infra" em vez de lançar quando createAdminClient lança', async () => {
    createAdminClientMock.mockImplementationOnce(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente')
    })
    const r = await registrarLeadAction(valido)
    expect(r).toEqual({
      ok: false,
      erro: 'Não conseguimos registrar agora. Fale com a gente no WhatsApp.',
      falha: 'infra',
    })
  })
})

describe('completarLeadAction', () => {
  beforeEach(() => {
    insert.mockClear()
    update.mockClear()
    is.mockClear()
    eq.mockClear()
    createAdminClientMock.mockClear()
    insertResultado = { data: { id: 'lead-1' }, error: null }
    updateResultado = { data: [{ id: 'lead-1' }], error: null }
  })

  it('atualiza a linha existente e nunca insere', async () => {
    const r = await completarLeadAction('lead-1', { empresa: 'Rede X' })
    expect(r.ok).toBe(true)
    expect(update).toHaveBeenCalledTimes(1)
    expect(insert).not.toHaveBeenCalled()
    expect(is).toHaveBeenCalledWith('etapa2_em', null)
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

  it('devolve { ok: false } quando a etapa 2 já tinha sido gravada (data vazio)', async () => {
    // `site_leads` é registro de captura, imutável: a etapa 2 acontece uma
    // vez só. O dublê aqui simula o `.is('etapa2_em', null)` não bater com
    // nenhuma linha — a chamada não atualizou nada, e a action não pode
    // mentir dizendo que atualizou.
    updateResultado = { data: [], error: null }
    const r = await completarLeadAction('lead-1', { empresa: 'Rede X' })
    expect(r).toEqual({ ok: false })
  })

  it('rejeita resumo acima do limite e NÃO grava', async () => {
    const r = await completarLeadAction('lead-1', { resumo: 'A'.repeat(2001) })
    expect(r.ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejeita campo curto acima do limite e NÃO grava', async () => {
    const r = await completarLeadAction('lead-1', { empresa: 'A'.repeat(201) })
    expect(r.ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})
