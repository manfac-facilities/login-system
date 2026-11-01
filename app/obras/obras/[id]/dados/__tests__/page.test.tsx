import { render } from '@testing-library/react'
import { criarFalso, type Falso } from '../../../_lib/__tests__/fixtures/supabase-falso'

let f: Falso
const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => f.cliente(getUserMock)) }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async () => true) }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async () => false) }))
// Os componentes de cliente viram espiões: o que eles recebem é o que vai para o navegador.
const receitaProps = jest.fn()
const orgProps = jest.fn()
jest.mock('../_receita', () => ({ __esModule: true, default: (p: unknown) => (receitaProps(p), null) }))
jest.mock('../_organograma', () => ({ __esModule: true, default: (p: unknown) => (orgProps(p), null) }))

import DadosDaObraPage from '../page'

const OBRA = '11111111-1111-4111-8111-111111111111'
const FILHA = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  jest.clearAllMocks()
  f = criarFalso()
  f.db.obras_obra = [
    { id: OBRA, os: '1026-014683', obra_pai_id: null, valor: 437772.41 },
    { id: FILHA, os: '1126-015102', obra_pai_id: OBRA, valor: 38500, cancelado_em: null },
  ]
  f.db.obras_cliente_pessoa = [{ id: 'p1', obra_id: OBRA, nome: 'Ana', cargo: null, email: null, ordem: 0 }]
  getUserMock.mockResolvedValue({ data: { user: { email: 'sup@manfac.com.br' } } })
})

const montar = async () => render(await DadosDaObraPage({ params: Promise.resolve({ id: OBRA }) }))

describe('Dados da obra: valor receita só para quem vê valores', () => {
  it.each([
    ['false', () => ({ data: false, error: null })],
    ['erro', () => ({ data: null, error: { message: 'x' } })],
  ])('obras_pode_ver_valores = %s → o valor não sai do servidor', async (_n, resp) => {
    f.rpcs.obras_pode_ver_valores = resp
    await montar()
    expect(receitaProps).not.toHaveBeenCalled()
    expect(orgProps).toHaveBeenCalled()
    const enviado = JSON.stringify(orgProps.mock.calls)
    expect(enviado).not.toMatch(/437772|43777241|38500|3850000/)
  })
  it('quem vê valores recebe a receita em centavos; aditivo cancelado fica marcado', async () => {
    f.rpcs.obras_pode_ver_valores = () => ({ data: true, error: null })
    f.db.obras_obra[1].cancelado_em = '2026-10-30T12:00:00Z'
    await montar()
    const { oss } = receitaProps.mock.calls[0][0] as { oss: { id: string; receitaCentavos: number | null; cancelada?: boolean }[] }
    expect(oss).toEqual([
      expect.objectContaining({ id: OBRA, receitaCentavos: 43_777_241, cancelada: false }),
      expect.objectContaining({ id: FILHA, receitaCentavos: 3_850_000, cancelada: true }),
    ])
  })
})
