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
 *  - a troca de etapa registrando quando ela mudou, numa chamada só da RPC (A13).
 */

const getUserMock = jest.fn()
const updateMock = jest.fn()
const eqMock = jest.fn()
// Desde a A13 (23/09) a troca de etapa grava pela RPC `obras_aplicar_alteracao`
// (etapa + marcos numa chamada só), não mais por `.update(...)`.
const rpcMock = jest.fn()
// `mudarEtapaAction` passou a ler a obra ANTES de trocar a etapa (para
// calcular os marcos da esteira — decisões do João de 21/09). Este arquivo
// não testa marcos (isso mora em `obra/[id]/__tests__/_actions.test.ts`);
// a obra "de fábrica" só precisa satisfazer o `lerObra` sem lançar, com
// etapa e marcos que nunca disparam mudança (todos os alvos usados aqui são
// etapas de campo, anteriores a `relatorio`).
const obraLidaMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
    from: jest.fn(() => ({
      update: updateMock,
      select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle: obraLidaMock })) })),
    })),
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
  obraLidaMock.mockResolvedValue({
    data: {
      id: 'o1',
      etapa: 'levantamento',
      marco_exec_fim: null,
      marco_relatorio: null,
      marco_os_aprov: null,
      marco_fechou_os: null,
      marco_liberou_fat: null,
      marco_faturou: null,
    },
    error: null,
  })
  encadear({ error: null })
  rpcMock.mockResolvedValue({ data: null, error: null })
})

/** `p_campos` da última chamada da RPC. */
function camposDaRpc(): Record<string, unknown> {
  return (rpcMock.mock.calls.at(-1)?.[1] as { p_campos: Record<string, unknown> }).p_campos
}

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
    expect(updateMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(camposDaRpc()).toEqual(
      expect.objectContaining({
        etapa: 'paralisado',
        desde_etapa: hojeISO(),
        atualizacao: hojeISO(),
        etapa_por: 'yuri@manfac.com.br',
      })
    )
  })

  it('devolve mensagem em português quando o banco recusa, sem lançar', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'RLS denied' } })
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
