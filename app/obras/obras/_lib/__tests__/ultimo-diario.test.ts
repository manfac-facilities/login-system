import { ultimosDiariosEnviados } from '../ultimo-diario'

function fake(data: unknown[], error: { message: string } | null = null) {
  const chamadas: [string, ...unknown[]][] = []
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'not', 'in']) q[m] = (...a: unknown[]) => (chamadas.push([m, ...a]), q)
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error }).then(ok)
  return { supabase: { from: (t: string) => (chamadas.push(['from', t]), q) } as never, chamadas }
}

describe('ultimosDiariosEnviados', () => {
  it('só conta envio ao cliente com destinatário aceito', async () => {
    const { supabase, chamadas } = fake([
      { obra_id: 'o1', referencia: '2026-10-27' },
      { obra_id: 'o1', referencia: '2026-10-28' },
      { obra_id: 'o2', referencia: null },
    ])
    const r = await ultimosDiariosEnviados(supabase, ['o1', 'o2'])
    expect(chamadas).toEqual(
      expect.arrayContaining([
        ['from', 'obras_envio'],
        ['eq', 'tipo', 'diario'],
        ['eq', 'lado', 'cliente'],
        ['not', 'destinatarios', 'eq', '{}'],
        ['in', 'obra_id', ['o1', 'o2']],
      ]),
    )
    expect(r.ultimo.get('o1')).toBe('2026-10-28')
    expect(r.ultimo.has('o2')).toBe(false)
  })

  it('sem obras: não consulta', async () => {
    const { supabase, chamadas } = fake([])
    expect((await ultimosDiariosEnviados(supabase, [])).ultimo.size).toBe(0)
    expect(chamadas).toHaveLength(0)
  })

  it('repassa o erro', async () => {
    const { supabase } = fake([], { message: 'boom' })
    expect((await ultimosDiariosEnviados(supabase, ['o1'])).error).toEqual({ message: 'boom' })
  })
})
