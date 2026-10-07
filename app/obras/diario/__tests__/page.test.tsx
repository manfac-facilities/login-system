/**
 * `../page.tsx` — pacote 3 de performance (06/10/2026): as obras em campo são
 * lidas em páginas (corte de 1.000 do PostgREST), `obras_pessoa`/chave saem em
 * paralelo e a lista de responsáveis do admin sai das próprias obras lidas.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../_pessoa', () => ({ resolverChave: jest.fn(async () => 'YURI') }))
jest.mock('../_cartoes', () => ({
  __esModule: true,
  default: (props: CartoesProps) => {
    cartoes = props
    return null
  },
}))

import { render } from '@testing-library/react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import DiarioPage from '../page'

type CartoesProps = { obras: { id: string }[]; responsaveis: string[]; analistaSelecionado: string }
let cartoes: CartoesProps | null = null

/** Chamadas de `select` em `obras_obra`, na ordem. */
const selecoesObra: string[] = []
const eqPcm = jest.fn()
const order = jest.fn()
let obrasNoBanco: { id: string; pcm: string | null; etapa: string }[] = []

function mockBanco() {
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { email: 'a@manfac.com.br' } } })) },
    from: jest.fn((tabela: string) => {
      const q: Record<string, unknown> = {}
      if (tabela === 'obras_obra') {
        let pcm: string | null = null
        q.select = jest.fn((cols: string) => {
          selecoesObra.push(cols)
          return q
        })
        q.in = jest.fn(() => q)
        q.eq = jest.fn((_c: string, v: string) => {
          eqPcm(v)
          pcm = v
          return q
        })
        q.order = jest.fn((...a: unknown[]) => {
          order(...a)
          return q
        })
        q.range = jest.fn((de: number, ate: number) => {
          const base = pcm ? obrasNoBanco.filter((o) => o.pcm === pcm) : obrasNoBanco
          return Promise.resolve({ data: base.slice(de, ate + 1), error: null })
        })
        return q
      }
      // obras_pessoa, obras_diario, obras_tarefa: vazias
      q.select = jest.fn(() => q)
      q.eq = jest.fn(() => q)
      q.in = jest.fn(() => Promise.resolve({ data: [], error: null }))
      q.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r)
      return q
    }),
  })
}

const obra = (i: number, pcm: string | null) => ({ id: `o${i}`, pcm, etapa: 'andamento' })

beforeEach(() => {
  cartoes = null
  selecoesObra.length = 0
  eqPcm.mockClear()
  order.mockClear()
  ;(isAdmin as jest.Mock).mockResolvedValue(true)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  mockBanco()
})

test('admin sem filtro: responsáveis saem das obras lidas, sem consulta extra de pcm', async () => {
  obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA'), obra(3, null), obra(4, 'YURI')]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(cartoes!.obras).toHaveLength(4)
  expect(cartoes!.responsaveis).toEqual(['AMANDA', 'YURI'])
  expect(selecoesObra).toEqual(['*'])
})

test('admin com filtro: lista de responsáveis continua completa (consulta à parte de pcm)', async () => {
  obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA')]
  render(await DiarioPage({ searchParams: Promise.resolve({ analista: 'YURI' }) }))
  expect(cartoes!.obras.map((o) => o.id)).toEqual(['o1'])
  expect(cartoes!.responsaveis).toEqual(['AMANDA', 'YURI'])
  expect([...selecoesObra].sort()).toEqual(['*', 'pcm'])
})

test('mais de 1000 obras em campo: nenhuma é cortada', async () => {
  obrasNoBanco = Array.from({ length: 1500 }, (_, i) => obra(i, 'YURI'))
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(cartoes!.obras).toHaveLength(1500)
  expect(order).toHaveBeenCalledWith('id', { ascending: true })
})

test('não-admin: filtra pela chave dele no banco', async () => {
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA')]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(eqPcm).toHaveBeenCalledWith('YURI')
  expect(cartoes!.obras.map((o) => o.id)).toEqual(['o1'])
  expect(cartoes!.responsaveis).toEqual([])
})
