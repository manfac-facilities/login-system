import { criarFalso, type Falso } from '../../../../obras/_lib/__tests__/fixtures/supabase-falso'

let f: Falso
const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => f.cliente(getUserMock)) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async (_s: unknown, e: string) => e === 'adm@manfac.com.br') }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async (_s: unknown, e: string) => e === 'eng@manfac.com.br') }))

import { revalidatePath } from 'next/cache'
import { marcarDevolvidaSpotAction, renovarLocacaoSpotAction } from '../_actions'

const SPOT = '11111111-1111-4111-8111-111111111111'
const PED = '66666666-6666-4666-8666-666666666666'
const como = (email: string | null) => getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } })

beforeEach(() => {
  f = criarFalso()
  f.db.obras_obra = [{ id: SPOT, modalidade: 'spot' }]
  f.db.obras_locacao_estado = []
  f.rpcs.obras_fin_locacoes = () => ({
    data: [{ obra_id: SPOT, pedido_id: PED, solicitacao_motivo: 'Andaime', inicio: '2026-10-06', locacao_fim: '2026-11-06', fim: '2026-11-06', estado: 'ativa' }],
    error: null,
  })
  como('eng@manfac.com.br')
  jest.mocked(revalidatePath).mockClear()
})

describe('locação do SPOT: devolver / renovar', () => {
  it('sem sessão ou sem acesso ao Obras → recusado', async () => {
    como(null)
    expect((await marcarDevolvidaSpotAction(SPOT, PED, '2026-10-30')).ok).toBe(false)
    como('x@manfac.com.br')
    expect((await renovarLocacaoSpotAction(SPOT, PED, '2026-12-06')).ok).toBe(false)
    expect(f.db.obras_locacao_estado).toHaveLength(0)
  })
  it('obra de modalidade obra → recusada', async () => {
    f.db.obras_obra = [{ id: SPOT, modalidade: 'obra' }]
    expect((await marcarDevolvidaSpotAction(SPOT, PED, '2026-10-30')).ok).toBe(false)
    expect(f.db.obras_locacao_estado).toHaveLength(0)
  })
  it('devolução futura e renovação antes do fim → recusadas', async () => {
    expect((await marcarDevolvidaSpotAction(SPOT, PED, '2099-01-01')).ok).toBe(false)
    expect((await renovarLocacaoSpotAction(SPOT, PED, '2026-11-06')).ok).toBe(false)
  })
  it('erro 42501 do banco vira a mensagem de permissão', async () => {
    f.erroEscrita.obras_locacao_estado = { message: 'x', code: '42501' }
    expect(await marcarDevolvidaSpotAction(SPOT, PED, '2026-10-30')).toEqual({
      ok: false,
      erro: 'Só quem tem acesso ao Gestão de Obras ou um administrador marca a locação.',
    })
  })
  it('caminho feliz grava e revalida a ficha', async () => {
    expect(await renovarLocacaoSpotAction(SPOT, PED, '2026-12-06')).toEqual({ ok: true })
    expect(await marcarDevolvidaSpotAction(SPOT, PED, '2026-10-30')).toEqual({ ok: true })
    expect(f.db.obras_locacao_estado).toHaveLength(1)
    expect(f.db.obras_locacao_estado[0]).toMatchObject({ cmp_pedido_id: PED, obra_id: SPOT, devolvida_em: '2026-10-30', renovada_ate: '2026-12-06' })
    expect(revalidatePath).toHaveBeenCalledWith(`/obras/obra/${SPOT}`)
  })
})
