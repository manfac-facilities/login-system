import { lerFinanceiroDaObra } from '../financeiro-ler'

const OBRA = '11111111-1111-4111-8111-111111111111'
const og = { ok: true as const, dados: { calc: { realizado: 0.5 }, feriados: new Set<string>() } } as never

function fake(resp: (nome: string) => { data: unknown; error: unknown }) {
  const rpc = jest.fn(async (nome: string) => resp(nome))
  const q: Record<string, unknown> = {
    select: () => q,
    or: () => q,
    in: () => q,
    then: (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: [{ id: OBRA, os: '1', loja: 'L', obra_pai_id: null, valor: 1000, cancelado_em: null }], error: null }).then(ok),
  }
  const from = jest.fn(() => q)
  return { supabase: { rpc, from } as never, rpc, from }
}
const fin = (rpc: jest.Mock) => rpc.mock.calls.map((c) => c[0]).filter((n: string) => n.startsWith('obras_fin_'))

describe('lerFinanceiroDaObra', () => {
  it('pode = false → sem_permissao e nenhuma leitura de valor', async () => {
    const f = fake(() => ({ data: false, error: null }))
    expect(await lerFinanceiroDaObra(f.supabase, OBRA, og, '2026-11-04')).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(fin(f.rpc)).toEqual([])
    expect(f.from).not.toHaveBeenCalled()
  })

  it('pode com erro → sem_permissao', async () => {
    const f = fake(() => ({ data: null, error: { message: 'x' } }))
    expect(await lerFinanceiroDaObra(f.supabase, OBRA, og, '2026-11-04')).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(fin(f.rpc)).toEqual([])
  })

  it('obras_fin_notas com erro → ok, faturamento e resumo em leitura', async () => {
    const f = fake((n) => (n === 'obras_pode_ver_valores' ? { data: true, error: null } : n === 'obras_fin_notas' ? { data: null, error: { message: 'x' } } : { data: [], error: null }))
    const r = await lerFinanceiroDaObra(f.supabase, OBRA, og, '2026-11-04')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.fin.faturamento).toEqual({ ok: false, motivo: 'leitura' })
      expect(r.fin.resumo.ok).toBe(false)
      expect(r.obras).toHaveLength(1)
    }
  })
})
