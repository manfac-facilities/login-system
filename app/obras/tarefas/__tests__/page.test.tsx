/**
 * Testes de `../page.tsx` — só o que o cancelamento de obra mudou nela
 * (spec-cancelamento-obra-2026-09-23 §8 e §11): tarefa ABERTA de obra
 * cancelada não chega à lista; a respondida continua, como registro.
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
  default: (props: { tarefas: { id: string }[] }) => {
    listaProps = props
    return null
  },
}))

import { render } from '@testing-library/react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import TarefasPage from '../page'

let listaProps: { tarefas: { id: string }[] } | null = null
const selectObra = jest.fn()

/** Encadeamento qualquer que termina num `await` com `resultado`. */
function cadeia(resultado: unknown, aoSelecionar?: (cols: string) => void) {
  const alvo: Record<string, unknown> = {}
  for (const m of ['order', 'limit', 'in', 'eq']) alvo[m] = jest.fn(() => alvo)
  alvo.select = jest.fn((cols: string) => {
    aoSelecionar?.(cols)
    return alvo
  })
  alvo.then = (r: (v: unknown) => unknown) => Promise.resolve(resultado).then(r)
  return alvo
}

const tarefa = (id: string, obra_id: string, situacao: 'aberta' | 'respondida') => ({
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
})

beforeEach(() => {
  listaProps = null
  selectObra.mockClear()
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { email: 'a@manfac.com.br' } } })) },
    from: jest.fn((tabela: string) => {
      if (tabela === 'obras_tarefa') {
        return cadeia({
          data: [tarefa('t1', 'A', 'aberta'), tarefa('t2', 'A', 'respondida'), tarefa('t3', 'B', 'aberta')],
          error: null,
        })
      }
      if (tabela === 'obras_obra') {
        return cadeia(
          {
            data: [
              { id: 'A', os: '1', loja: 'LOJA A', equipe: 'MANFAC-1', pcm: 'YURI', etapa: 'cancelado' },
              { id: 'B', os: '2', loja: 'LOJA B', equipe: 'MANFAC-2', pcm: 'YURI', etapa: 'andamento' },
            ],
            error: null,
          },
          selectObra
        )
      }
      return cadeia({ data: [], error: null })
    }),
  })
})

test('tarefa aberta de obra cancelada não chega à lista; respondida e de obra ativa chegam', async () => {
  render(await TarefasPage())
  expect(listaProps!.tarefas.map((t) => t.id)).toEqual(['t2', 't3'])
})

test('o select de obras traz a etapa', async () => {
  render(await TarefasPage())
  expect(selectObra).toHaveBeenCalledWith('id, os, loja, equipe, pcm, etapa')
})
