/**
 * Testes de `../page.tsx`:
 *  - cancelamento de obra (spec-cancelamento-obra-2026-09-23 §8 e §11): tarefa
 *    ABERTA de obra cancelada não chega à lista; a respondida continua;
 *  - performance (pacote 3, 06/10/2026): lê TODAS as tarefas em páginas (sem o
 *    antigo `limit(500)`, que derrubava a mais antiga) e traz a obra embutida,
 *    sem `.in('id', [...UUIDs])`.
 *
 * Padrão de `app/obras/obra/[id]/__tests__/page.test.tsx`: Supabase e auth
 * mockados, a Server Component chamada como função. `_lista` é mockada para
 * capturar as props que a página entrega.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../_lista', () => ({
  __esModule: true,
  default: (props: ListaProps) => {
    listaProps = props
    return null
  },
}))

import { render } from '@testing-library/react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import TarefasPage from '../page'

type ListaProps = {
  tarefas: ({ id: string } & Record<string, unknown>)[]
  obras: Record<string, { id: string; os: string; loja: string; equipe: string }>
}
let listaProps: ListaProps | null = null

const selectTarefa = jest.fn()
const orderTarefa = jest.fn()
const inTarefa = jest.fn()
const rangeTarefa = jest.fn()
/** Linhas que o "banco" tem; `range` fatia como o PostgREST. */
let banco: unknown[] = []

function builderTarefas() {
  const alvo: Record<string, unknown> = {}
  alvo.select = jest.fn((cols: string) => {
    selectTarefa(cols)
    return alvo
  })
  alvo.order = jest.fn((col: string, o: unknown) => {
    orderTarefa(col, o)
    return alvo
  })
  alvo.in = jest.fn((...a: unknown[]) => {
    inTarefa(...a)
    return alvo
  })
  alvo.range = jest.fn((de: number, ate: number) => {
    rangeTarefa(de, ate)
    return Promise.resolve({ data: banco.slice(de, ate + 1), error: null })
  })
  return alvo
}

const OBRA_A = { id: 'A', os: '1', loja: 'LOJA A', equipe: 'MANFAC-1', pcm: 'YURI', etapa: 'cancelado' }
const OBRA_B = { id: 'B', os: '2', loja: 'LOJA B', equipe: 'MANFAC-2', pcm: 'YURI', etapa: 'andamento' }

const tarefa = (id: string, obra_id: string, situacao: 'aberta' | 'respondida', obra: unknown = null) => ({
  id,
  obra_id,
  item: 'Material',
  dono: 'ROBERTA',
  aberta: '2026-09-20',
  hora_aberta: null,
  prazo: '2026-09-20',
  registrou: null,
  situacao,
  resposta_em: null,
  resposta_hora: null,
  resumo: null,
  created_at: '2026-09-20T12:00:00Z',
  obras_obra: obra,
})

beforeEach(() => {
  listaProps = null
  for (const m of [selectTarefa, orderTarefa, inTarefa, rangeTarefa]) m.mockClear()
  banco = [
    tarefa('t1', 'A', 'aberta', OBRA_A),
    tarefa('t2', 'A', 'respondida', OBRA_A),
    tarefa('t3', 'B', 'aberta', OBRA_B),
  ]
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { email: 'a@manfac.com.br' } } })) },
    from: jest.fn((tabela: string) => {
      if (tabela === 'obras_tarefa') return builderTarefas()
      // obras_pessoa
      return { select: jest.fn(async () => ({ data: [], error: null })) }
    }),
  })
})

test('tarefa aberta de obra cancelada não chega à lista; respondida e de obra ativa chegam', async () => {
  render(await TarefasPage())
  expect(listaProps!.tarefas.map((t) => t.id)).toEqual(['t2', 't3'])
})

test('a obra vem embutida na tarefa (com a etapa), sem consulta .in de UUIDs', async () => {
  render(await TarefasPage())
  expect(selectTarefa).toHaveBeenCalledWith('*, obras_obra(id, os, loja, equipe, pcm, etapa)')
  expect(inTarefa).not.toHaveBeenCalled()
})

test('as obras da lista e o formato da tarefa são os de antes (sem o campo embutido)', async () => {
  render(await TarefasPage())
  expect(listaProps!.obras).toEqual({
    A: { id: 'A', os: '1', loja: 'LOJA A', equipe: 'MANFAC-1' },
    B: { id: 'B', os: '2', loja: 'LOJA B', equipe: 'MANFAC-2' },
  })
  for (const t of listaProps!.tarefas) expect(t).not.toHaveProperty('obras_obra')
})

test('tarefa cuja obra não veio (null) continua na lista, como antes', async () => {
  banco = [tarefa('t9', 'Z', 'aberta', null)]
  render(await TarefasPage())
  expect(listaProps!.tarefas.map((t) => t.id)).toEqual(['t9'])
  expect(listaProps!.obras).toEqual({})
})

test('ordena por aberta desc, como antes (a primeira consulta não ganha desempate)', async () => {
  render(await TarefasPage())
  expect(orderTarefa).toHaveBeenCalledTimes(1)
  expect(orderTarefa).toHaveBeenCalledWith('aberta', { ascending: false })
})

test('mais de 1000 tarefas: lê tudo, inclusive a mais antiga (sem limit(500))', async () => {
  banco = Array.from({ length: 1001 }, (_, i) => tarefa(`t${i}`, 'B', 'aberta', OBRA_B))
  render(await TarefasPage())
  expect(listaProps!.tarefas).toHaveLength(1001)
  expect(listaProps!.tarefas.map((t) => t.id)).toContain('t1000')
  // recomeçou ordenado por id para paginar sem repetir nem pular
  expect(orderTarefa).toHaveBeenCalledWith('id', { ascending: true })
})
