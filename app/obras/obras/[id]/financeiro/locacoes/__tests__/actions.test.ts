import { criarFalso, type Falso } from '../../../../_lib/__tests__/fixtures/supabase-falso'

let f: Falso
const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => f.cliente(getUserMock)) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async (_s: unknown, e: string) => e === 'adm@manfac.com.br') }))

import { marcarDevolvidaAction, renovarLocacaoAction } from '../_actions'

const MAE = '11111111-1111-4111-8111-111111111111'
const PED = '66666666-6666-4666-8666-666666666666'
const OUTRO_PED = '77777777-7777-4777-8777-777777777777'
const como = (email: string) => getUserMock.mockResolvedValue({ data: { user: { email } } })

beforeEach(() => {
  f = criarFalso()
  f.db.obras_obra = [{ id: MAE, modalidade: 'obra', obra_pai_id: null, engenheiro_email: 'eng@manfac.com.br', valor: null }]
  f.db.obras_locacao_estado = []
  f.rpcs.obras_fin_locacoes = () => ({
    data: [{ obra_id: MAE, pedido_id: PED, solicitacao_motivo: 'Andaime', inicio: '2026-10-06', locacao_fim: '2026-11-06', fim: '2026-11-06', estado: 'ativa' }],
    error: null,
  })
  como('eng@manfac.com.br')
})

describe('locações: marcar devolvida / renovada até', () => {
  it('supervisor (não engenheiro) não marca', async () => {
    como('sup@manfac.com.br')
    expect((await marcarDevolvidaAction(MAE, PED, '2026-10-30')).ok).toBe(false)
    expect(f.db.obras_locacao_estado).toHaveLength(0)
  })
  it('pedido que não está nas locações da obra → recusado', async () => {
    expect(await renovarLocacaoAction(MAE, OUTRO_PED, '2026-12-31')).toEqual({ ok: false, erro: 'Locação não encontrada nesta obra' })
  })
  it('engenheiro marca devolvida e renova (upsert pelo pedido)', async () => {
    expect(await renovarLocacaoAction(MAE, PED, '2026-12-06')).toEqual({ ok: true })
    expect(f.db.obras_locacao_estado[0]).toMatchObject({ cmp_pedido_id: PED, obra_id: MAE, renovada_ate: '2026-12-06' })
    expect(await marcarDevolvidaAction(MAE, PED, '2026-10-30')).toEqual({ ok: true })
    expect(f.db.obras_locacao_estado).toHaveLength(1)
    expect(f.db.obras_locacao_estado[0]).toMatchObject({ devolvida_em: '2026-10-30', renovada_ate: '2026-12-06' })
  })
  it('renovar para antes do fim atual ou devolver no futuro → recusado', async () => {
    expect((await renovarLocacaoAction(MAE, PED, '2026-11-06')).ok).toBe(false)
    expect((await marcarDevolvidaAction(MAE, PED, '2099-01-01')).ok).toBe(false)
  })
  it('devolução antes do início (entrega) → recusada', async () => {
    expect(await marcarDevolvidaAction(MAE, PED, '2026-10-05')).toEqual({ ok: false, erro: 'A devolução não pode ser antes do início da locação' })
    expect(f.db.obras_locacao_estado).toHaveLength(0)
  })
})
