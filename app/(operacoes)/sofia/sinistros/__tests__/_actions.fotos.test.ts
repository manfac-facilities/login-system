// Teto de 30 fotos por sinistro (spec 2026-11-03 §2.7): conferido na action, antes de gravar.
const insertPorTabela: Record<string, unknown[]> = {}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => ({
      insert: jest.fn(async (rows: unknown) => {
        ;(insertPorTabela[table] ??= []).push(rows)
        return { error: null }
      }),
    })),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { criarSinistroAction } from '../_actions'

function fd(nFotos: number): FormData {
  const f = new FormData()
  const fotos: Record<string, string> = {}
  for (let i = 1; i <= nFotos; i++) fotos[`Dano ${i}`] = `sinistros/s1/dano-${i}.jpg`
  const campos: Record<string, string> = {
    id: 's1',
    veiculo_id: 'v1',
    motorista_id: '',
    data: '2026-11-03',
    tipo: 'avaria',
    descricao: 'Batida',
    valor_dano: '',
    observacoes: '',
    fotos: JSON.stringify(fotos),
  }
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

beforeEach(() => {
  for (const k of Object.keys(insertPorTabela)) delete insertPorTabela[k]
})

it('31 fotos são recusadas sem gravar nada', async () => {
  const r = await criarSinistroAction({}, fd(31))
  expect(r.error).toBe('Limite de 30 fotos por sinistro')
  expect(insertPorTabela.sinistros).toBeUndefined()
  expect(insertPorTabela.sinistro_fotos).toBeUndefined()
})

it('3 fotos são gravadas, uma linha cada', async () => {
  const r = await criarSinistroAction({}, fd(3))
  expect(r).toEqual({ success: true, sinistroId: 's1' })
  expect(insertPorTabela.sinistro_fotos?.[0]).toHaveLength(3)
})
