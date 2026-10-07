/**
 * `../page.tsx` — a base lê TODAS as obras, em páginas: o PostgREST corta em
 * 1.000 linhas sem erro, e os KPIs (sempre sobre a base inteira) mentiriam.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('../_visao', () => ({
  __esModule: true,
  default: (props: { obras: { id: string }[] }) => {
    visaoProps = props
    return null
  },
}))

import { render } from '@testing-library/react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import BaseDeObrasPage from '../page'

let visaoProps: { obras: { id: string }[] } | null = null
const order = jest.fn()
const range = jest.fn()
let banco: unknown[] = []
let erroNaPagina: number | null = null

function mockBanco() {
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { email: 'a@manfac.com.br' } } })) },
    from: jest.fn(() => {
      const q: Record<string, unknown> = {}
      q.select = jest.fn(() => q)
      q.order = jest.fn((...a: unknown[]) => {
        order(...a)
        return q
      })
      q.range = jest.fn((de: number, ate: number) => {
        range(de, ate)
        if (erroNaPagina !== null && de === erroNaPagina) {
          return Promise.resolve({ data: null, error: { message: 'boom' } })
        }
        return Promise.resolve({ data: banco.slice(de, ate + 1), error: null })
      })
      return q
    }),
  })
}

const linha = (i: number) => ({ id: `o${i}`, os: String(i), etapa: 'andamento' })

beforeEach(() => {
  visaoProps = null
  order.mockClear()
  range.mockClear()
  erroNaPagina = null
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  mockBanco()
})

test('até 999 obras: uma consulta só, sem order (igual a antes)', async () => {
  banco = Array.from({ length: 241 }, (_, i) => linha(i))
  render(await BaseDeObrasPage())
  expect(visaoProps!.obras).toHaveLength(241)
  expect(range).toHaveBeenCalledTimes(1)
  expect(order).not.toHaveBeenCalled()
})

test('mais de 1000 obras: nenhuma é cortada', async () => {
  banco = Array.from({ length: 2345 }, (_, i) => linha(i))
  render(await BaseDeObrasPage())
  expect(visaoProps!.obras).toHaveLength(2345)
  expect(new Set(visaoProps!.obras.map((o) => o.id)).size).toBe(2345)
  expect(order).toHaveBeenCalledWith('id', { ascending: true })
})

test('erro em qualquer página: tela de erro, nunca lista parcial', async () => {
  banco = Array.from({ length: 2345 }, (_, i) => linha(i))
  erroNaPagina = 1000
  const { container } = render(await BaseDeObrasPage())
  expect(visaoProps).toBeNull()
  expect(container.textContent).toContain('Não deu para carregar a base de obras')
})
