import { lerEntradaDosAlertas } from '../leitura'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

/** Cliente falso: tabelas sem filtro devolvem [] e `revisoes` respeita .range, como o PostgREST (corta em 1.000). */
function admin(totalRevisoes: number) {
  const chamadas: [number, number][] = []
  const cadeia = (rows: unknown[]) => {
    const q: any = Promise.resolve({ data: rows, error: null })
    q.select = () => q
    q.neq = () => q
    q.eq = () => q
    q.order = () => q
    q.range = (a: number, b: number) => {
      chamadas.push([a, b])
      const fim = Math.min(b, totalRevisoes - 1)
      const lote = Array.from({ length: Math.max(0, fim - a + 1) }, (_, i) => ({ id: String(a + i) }))
      return Promise.resolve({ data: lote, error: null })
    }
    return q
  }
  return { chamadas, client: { from: (t: string) => cadeia(t === 'revisoes' ? [] : []) } as never }
}

describe('lerEntradaDosAlertas: revisoes', () => {
  it('lê todas as revisões, não só as 1.000 primeiras', async () => {
    const { client, chamadas } = admin(2500)
    const e = await lerEntradaDosAlertas(client, '2026-11-04')
    expect(e.revisoes).toHaveLength(2500)
    expect(chamadas.length).toBe(3)
  })
})
