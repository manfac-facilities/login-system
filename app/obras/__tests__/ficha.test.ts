/**
 * Testes das Server Actions da Ficha (`app/obras/obra/[id]/_actions.ts`).
 *
 * Padrão de mocks de `app/conversor-os/__tests__/_actions.test.ts`: Supabase,
 * `next/cache` e `lib/auth/systemAccess` mockados. **Nunca bate em Supabase
 * real** — a migration `sdd-sql-obras-v0.sql` ainda não foi aplicada em banco
 * nenhum, então não haveria contra o que testar.
 *
 * O que estes testes protegem:
 *  - a receita do hub: sem acesso não escreve, e a action nunca lança;
 *  - a trava dos cinco campos da triagem no SERVIDOR, não só na tela;
 *  - `null` como único sentinela de vazio (decisão 8 da spec);
 *  - a troca de etapa registrando quando ela mudou, e sobrevivendo à ausência
 *    das colunas de autoria (ver o comentário em `_actions.ts`).
 */

const getUserMock = jest.fn()
const updateMock = jest.fn()
const eqMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({ update: updateMock })),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))

import { liberarObraAction, mudarEtapaAction } from '../obra/[id]/_actions'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { hojeISO } from '../_lib/tipos'

/**
 * `update(...).eq(...)` — e, na triagem, `.eq(...).eq(...)`. O encadeamento
 * devolve sempre um objeto que é, ele mesmo, o resultado da promise.
 */
function encadear(resultado: { error: unknown; data?: unknown }) {
  // `liberarObraAction` fecha a cadeia com `.select('id')` para saber quantas
  // linhas mudaram — zero linhas não é erro no Postgres, mas é conflito para
  // nós. Quem não passar `data` ganha uma linha, que é o caso de sucesso.
  const final = { ...resultado, data: 'data' in resultado ? resultado.data : [{ id: 'o1' }] }
  const alvo: Record<string, unknown> = { ...final }
  alvo.eq = eqMock.mockReturnValue(alvo)
  alvo.select = jest.fn(() => alvo)
  alvo.then = (r: (v: unknown) => unknown) => Promise.resolve(final).then(r)
  updateMock.mockReturnValue(alvo)
  return alvo
}

const TRIAGEM_OK = {
  resp: 'YURI',
  equipe: 'MANFAC-7',
  prioridade: 'Normal',
  inicio: '2026-09-08',
  duracao: '7',
}

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'yuri@manfac.com.br' } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  encadear({ error: null })
})

describe('mudarEtapaAction', () => {
  it('recusa quem não tem acesso ao sistema, sem escrever nada', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await mudarEtapaAction('o1', 'andamento')
    expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('recusa usuário sem sessão', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const r = await mudarEtapaAction('o1', 'andamento')
    expect(r).toEqual({ error: 'Não autenticado' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('recusa etapa que não existe no ciclo', async () => {
    const r = await mudarEtapaAction('o1', 'inventada')
    expect(r).toEqual({ error: 'Etapa inválida' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('grava a etapa e RECOMEÇA o contador de dias parada nela', async () => {
    const r = await mudarEtapaAction('o1', 'paralisado')
    expect(r).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        etapa: 'paralisado',
        desde_etapa: hojeISO(),
        atualizacao: hojeISO(),
        etapa_por: 'yuri@manfac.com.br',
      })
    )
  })

  it('sobrevive à ausência das colunas de autoria, refazendo o update sem elas', async () => {
    // Primeira tentativa: o PostgREST não conhece etapa_por/etapa_em.
    updateMock
      .mockReturnValueOnce({
        eq: jest.fn().mockResolvedValue({ error: { code: 'PGRST204', message: "Could not find the 'etapa_por' column" } }),
      })
      .mockReturnValueOnce({ eq: jest.fn().mockResolvedValue({ error: null }) })

    const r = await mudarEtapaAction('o1', 'andamento')
    expect(r).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(updateMock).toHaveBeenLastCalledWith({
      etapa: 'andamento',
      desde_etapa: hojeISO(),
      atualizacao: hojeISO(),
    })
  })

  it('devolve mensagem em português quando o banco recusa, sem lançar', async () => {
    updateMock.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: { code: '42501', message: 'RLS denied' } }),
    })
    await expect(mudarEtapaAction('o1', 'andamento')).resolves.toEqual({
      error: 'Erro ao mudar a etapa da obra',
    })
  })
})

describe('liberarObraAction', () => {
  it('recusa quem não tem acesso ao sistema', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await liberarObraAction('o1', TRIAGEM_OK)
    expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('a trava dos cinco campos vale no SERVIDOR, não só no botão', async () => {
    for (const faltando of ['resp', 'equipe', 'prioridade', 'inicio', 'duracao'] as const) {
      const dados = { ...TRIAGEM_OK, [faltando]: '' }
      const r = await liberarObraAction('o1', dados)
      expect(r).toEqual({ error: 'Preencha os cinco campos antes de liberar' })
    }
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('recusa prioridade fora do enum e duração fora da faixa', async () => {
    expect(await liberarObraAction('o1', { ...TRIAGEM_OK, prioridade: 'Altíssima' })).toEqual({
      error: 'Prioridade inválida',
    })
    expect(await liberarObraAction('o1', { ...TRIAGEM_OK, duracao: '900' })).toEqual({
      error: 'A duração precisa ficar entre 1 e 180 dias',
    })
  })

  it('grava os cinco campos e manda a obra para Levantamento', async () => {
    const r = await liberarObraAction('o1', TRIAGEM_OK)
    expect(r).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pcm: 'YURI',
        equipe: 'MANFAC-7',
        prioridade: 'Normal',
        inicio_plan: '2026-09-08',
        duracao: 7,
        etapa: 'levantamento',
        desde_etapa: hojeISO(),
        pend_resp: 'YURI',
      })
    )
  })

  it('sem quem liberou, a data da liberação não é gravada — nem como string vazia', async () => {
    await liberarObraAction('o1', { ...TRIAGEM_OK, libPor: '', libEm: '2026-09-01' })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ liberado_por: null, liberado_em: null })
    )
  })

  it('com quem liberou e sem data, assume hoje', async () => {
    await liberarObraAction('o1', { ...TRIAGEM_OK, libPor: 'LEANDRO', libEm: '' })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ liberado_por: 'LEANDRO', liberado_em: hojeISO() })
    )
  })

  it('só libera obra que ainda está aguardando definição', async () => {
    await liberarObraAction('o1', TRIAGEM_OK)
    expect(eqMock).toHaveBeenCalledWith('id', 'o1')
    expect(eqMock).toHaveBeenCalledWith('etapa', 'definir')
  })

  it('não diz que deu certo quando não mudou linha nenhuma', async () => {
    // Outra aba, outra pessoa, ou duplo clique: a obra saiu de "Aguardando
    // definição" entre carregar a tela e clicar. O `.eq('etapa','definir')` não
    // casa com nada, e o Postgres não considera isso erro — antes desta guarda
    // a ação devolvia sucesso e navegava para a base sem ter gravado nada.
    encadear({ error: null, data: [] })
    const r = await liberarObraAction('o1', TRIAGEM_OK)
    expect(r).toEqual({ error: 'Esta obra já foi liberada por outra pessoa. Recarregue a página.' })
  })
})
