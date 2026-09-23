/**
 * Testes de `_comunicados-actions.ts` (spec 2026-09-22-comunicado-atualizacoes).
 * O filtro de acesso é da RLS — aqui só se confere o que o código faz com o
 * que o banco devolve.
 */

const getUserMock = jest.fn()
const respostas: Record<string, unknown> = {}
const insertMock = jest.fn()
const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = []

function consulta(tabela: string) {
  const q: Record<string, unknown> = {}
  for (const metodo of ['select', 'eq', 'order']) {
    q[metodo] = (...args: unknown[]) => {
      chamadas.push({ tabela, metodo, args })
      return q
    }
  }
  q.then = (resolve: (v: unknown) => unknown) => resolve(respostas[tabela])
  q.insert = (...args: unknown[]) => insertMock(...args)
  return q
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: (tabela: string) => consulta(tabela),
  })),
}))

import { listarComunicadosNaoLidos, marcarComunicadoLido } from '../_comunicados-actions'

const C1 = { id: 'c1', titulo: 'Um', corpo: 'a', publicado_em: '2026-09-22T12:00:00Z' }
const C2 = { id: 'c2', titulo: 'Dois', corpo: 'b', publicado_em: '2026-09-21T12:00:00Z' }

beforeEach(() => {
  chamadas.length = 0
  getUserMock.mockReset()
  getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } })
  insertMock.mockReset()
  respostas.hub_comunicados = { data: [C1, C2], error: null }
  respostas.hub_comunicados_lidos = { data: [], error: null }
})

describe('listarComunicadosNaoLidos', () => {
  it('filtra os já lidos, lê só obras e ordena por publicado_em desc', async () => {
    respostas.hub_comunicados_lidos = { data: [{ comunicado_id: 'c1' }], error: null }

    expect(await listarComunicadosNaoLidos()).toEqual([C2])
    expect(chamadas).toContainEqual({ tabela: 'hub_comunicados', metodo: 'eq', args: ['sistema', 'obras'] })
    expect(chamadas).toContainEqual({
      tabela: 'hub_comunicados',
      metodo: 'order',
      args: ['publicado_em', { ascending: false }],
    })
    expect(chamadas).toContainEqual({ tabela: 'hub_comunicados_lidos', metodo: 'eq', args: ['user_id', 'u1'] })
  })

  it('erro de leitura devolve lista vazia', async () => {
    respostas.hub_comunicados = { data: null, error: { message: 'falhou' } }
    expect(await listarComunicadosNaoLidos()).toEqual([])
  })

  it('erro ao ler os lidos também devolve lista vazia', async () => {
    respostas.hub_comunicados_lidos = { data: null, error: { message: 'falhou' } }
    expect(await listarComunicadosNaoLidos()).toEqual([])
  })

  it('sem sessão devolve lista vazia', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await listarComunicadosNaoLidos()).toEqual([])
  })
})

describe('marcarComunicadoLido', () => {
  it('insere com o user_id da sessão', async () => {
    insertMock.mockResolvedValue({ error: null })
    expect(await marcarComunicadoLido('c1')).toEqual({ ok: true })
    expect(insertMock).toHaveBeenCalledWith({ comunicado_id: 'c1', user_id: 'u1' })
  })

  it('chave duplicada (23505) conta como sucesso', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })
    expect(await marcarComunicadoLido('c1')).toEqual({ ok: true })
  })

  it('outro erro devolve ok: false', async () => {
    insertMock.mockResolvedValue({ error: { code: '42501', message: 'rls' } })
    expect(await marcarComunicadoLido('c1')).toEqual({ ok: false })
  })

  it('sem sessão devolve ok: false e não insere', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await marcarComunicadoLido('c1')).toEqual({ ok: false })
    expect(insertMock).not.toHaveBeenCalled()
  })
})
