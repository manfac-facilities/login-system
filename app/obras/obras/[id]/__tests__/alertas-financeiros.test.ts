import { lerAlertasFinanceiros } from '../_alertas-financeiros'

const ID = '11111111-1111-4111-8111-111111111111'

function falso(dados: { obras?: unknown[]; medicoes?: unknown[]; atrasadas?: unknown[]; erroAtrasadas?: boolean }) {
  const chamadas: string[] = []
  const filtros: unknown[] = []
  const consulta = (tabela: string) => {
    const data = tabela === 'obras_obra' ? dados.obras ?? [] : dados.medicoes ?? []
    const q: Record<string, unknown> = {
      select: () => q,
      or: () => q,
      in: (_c: string, v: unknown) => { filtros.push(v); return q },
      eq: () => q,
      then: (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok),
    }
    return q
  }
  const supabase = {
    from: (t: string) => { chamadas.push(`from:${t}`); return consulta(t) },
    rpc: async (n: string) => {
      chamadas.push(`rpc:${n}`)
      return dados.erroAtrasadas ? { data: null, error: { message: 'x' } } : { data: dados.atrasadas ?? [], error: null }
    },
  }
  return { supabase: supabase as never, chamadas, filtros }
}

describe('lerAlertasFinanceiros (painel da obra)', () => {
  it('quem não vê valores: nenhuma consulta e nenhum alerta', async () => {
    const f = falso({ medicoes: [{ numero: 1, obra_id: ID, enviada_em: '2026-10-01T12:00:00Z', situacao: 'enviada' }] })
    expect(await lerAlertasFinanceiros(f.supabase, ID, false)).toEqual({ medicoesCliente: null, medicoesFornecedor: null })
    expect(f.chamadas).toEqual([])
  })

  it('quem vê valores: lê medições (sem OS cancelada) e atrasadas do fornecedor', async () => {
    const f = falso({
      obras: [{ id: ID, os: '100', cancelado_em: null }, { id: 'cancelada', os: '100-A', cancelado_em: '2026-10-10T00:00:00Z' }],
      medicoes: [{ numero: 2, obra_id: ID, enviada_em: '2026-10-01T12:00:00Z', situacao: 'enviada' }],
      atrasadas: [{ fornecedor_razao_social: 'Eletro', dias_aguardando: 12, aguardando: 'engenheiro' }],
    })
    const r = await lerAlertasFinanceiros(f.supabase, ID, true)
    expect(f.filtros).toEqual([[ID]])
    expect(r.medicoesCliente).toEqual([{ numero: 2, os: '100', enviadaEm: '2026-10-01T12:00:00Z', situacao: 'enviada' }])
    expect(r.medicoesFornecedor).toEqual([{ fornecedor: 'Eletro', dias: 12, aguardando: 'engenheiro' }])
    expect(f.chamadas).toContain('rpc:obras_fin_medicoes_fornecedor_atrasadas')
  })

  it('família só com OS cancelada: não lê medições; atrasadas com erro → null', async () => {
    const f = falso({ obras: [{ id: ID, os: '100', cancelado_em: '2026-10-10T00:00:00Z' }], erroAtrasadas: true })
    const r = await lerAlertasFinanceiros(f.supabase, ID, true)
    expect(r).toEqual({ medicoesCliente: [], medicoesFornecedor: null })
    expect(f.chamadas).not.toContain('from:obras_medicao_cliente')
  })
})
