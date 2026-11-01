import { criarFalso, type Falso } from '../../../../obras/_lib/__tests__/fixtures/supabase-falso'

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => { throw new Error('admin não pode ser usado') },
}))

import { lerFinanceiroSpot } from '../dados'

const OBRA = '11111111-1111-4111-8111-111111111111'
const obra = { id: OBRA, valor: 10000, etapa: 'faturado', fat_nfse: null }
let f: Falso
const chamadas: string[] = []
const cli = () => f.cliente(async () => ({ data: { user: { email: 'a@manfac.com.br' } } })) as never

beforeEach(() => {
  f = criarFalso()
  chamadas.length = 0
  const vazio = (n: string, data: unknown = []) => (f.rpcs[n] = () => (chamadas.push(n), { data, error: null }))
  f.rpcs.obras_pode_ver_valores = () => (chamadas.push('obras_pode_ver_valores'), { data: true, error: null })
  for (const n of ['obras_fin_compras', 'obras_fin_fornecedores', 'obras_fin_vinculos', 'obras_fin_locacoes', 'obras_fin_medicoes_fornecedor_atrasadas']) vazio(n)
  vazio('obras_fin_caixinha_sem_obra', [{ quantidade: 0 }])
  vazio('obras_fin_notas', [{ nota_id: 'n1', obra_id: OBRA, nota_situacao: 'autorizada', parcela_centavos: 600000, nfse_numero: '1' }])
  f.db.obras_nota_externa = [
    { obra_id: OBRA, nfse: '9', emitida_em: '2026-10-01', valor_centavos: 250000 },
    { obra_id: 'outra', nfse: '8', emitida_em: '2026-10-01', valor_centavos: 999 },
  ]
})

describe('lerFinanceiroSpot', () => {
  it('sem permissão: sem-permissao e nenhuma outra RPC', async () => {
    f.rpcs.obras_pode_ver_valores = () => (chamadas.push('obras_pode_ver_valores'), { data: false, error: null })
    expect(await lerFinanceiroSpot(cli(), obra, '2026-11-01')).toEqual({ ok: false, motivo: 'sem-permissao' })
    expect(chamadas).toEqual(['obras_pode_ver_valores'])
  })

  it('erro numa RPC: leitura', async () => {
    f.rpcs.obras_fin_compras = () => ({ data: null, error: { message: 'x' } })
    expect(await lerFinanceiroSpot(cli(), obra, '2026-11-01')).toEqual({ ok: false, motivo: 'leitura' })
  })

  it('erro na tabela de notas externas: leitura', async () => {
    f.erroLeitura.obras_nota_externa = { message: 'x' }
    expect(await lerFinanceiroSpot(cli(), obra, '2026-11-01')).toEqual({ ok: false, motivo: 'leitura' })
  })

  it('caminho feliz: faturado = nota autorizada + externa', async () => {
    const r = await lerFinanceiroSpot(cli(), obra, '2026-11-01')
    if (!r.ok) throw new Error('esperava ok')
    expect(r.resumo.faturadoCentavos).toBe(850000)
    expect(r.externas).toHaveLength(1)
    expect(r.externas[0]).toEqual({ nfse: '9', emitidaEm: '2026-10-01', valorCentavos: 250000 })
  })
})
