// A tabela checklist tem 2 FKs para equipes e 2 para motoristas; sem hint de coluna
// o PostgREST devolve erro de embed ambíguo e a tela fica vazia (bug B3).
const selects: string[] = []

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'order', 'limit', 'eq', 'single']) {
        chain[m] = jest.fn((arg?: unknown) => {
          if (m === 'select' && typeof arg === 'string') selects.push(arg)
          return chain
        })
      }
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null })
      return chain
    }),
    storage: { from: jest.fn() },
  })),
}))
jest.mock('next/navigation', () => ({ notFound: jest.fn(() => { throw new Error('notFound') }) }))
jest.mock('../_actions', () => ({ excluirChecklistAction: jest.fn() }))
jest.mock('@/components/sofia/DeleteConfirmButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/sofia/GaleriaFotos', () => ({ __esModule: true, default: () => null }))

import ChecklistPage from '../page'
import ChecklistDetalhePage from '../[id]/page'

beforeEach(() => {
  selects.length = 0
})

function expectDesambiguado(select: string) {
  expect(select).toContain('equipes!equipe_id(codigo)')
  expect(select).toContain('motoristas!motorista_id(nome)')
  expect(select).not.toMatch(/(^|,\s*)(equipes|motoristas)\(/)
}

describe('checklist: embeds desambiguados', () => {
  it('lista', async () => {
    await ChecklistPage()
    expect(selects).toHaveLength(1)
    expectDesambiguado(selects[0])
  })

  it('detalhe', async () => {
    await ChecklistDetalhePage({ params: Promise.resolve({ id: 'x' }) }).catch(() => {})
    const sel = selects.find((s) => s.includes('veiculos'))
    expect(sel).toBeDefined()
    expectDesambiguado(sel!)
  })
})
