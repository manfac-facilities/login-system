/**
 * Fiação do mapa na página do diário (Leva 6): mapa lido → ronda + ambientes no form de impedimento;
 * leitura do mapa falhando (ex.: SQL da Leva 6 ainda não aplicado) → diário de sempre, sem ronda.
 */
import { render, screen } from '@testing-library/react'

const passosProps = jest.fn()
const formProps = jest.fn()
jest.mock('../_passos', () => ({
  __esModule: true,
  default: (p: { mapa: unknown; impedimentos: React.ReactNode }) => {
    passosProps(p)
    return <div data-testid="passos">{p.impedimentos}</div>
  },
}))
jest.mock('../../impedimentos/_form', () => ({
  __esModule: true,
  default: (p: unknown) => {
    formProps(p)
    return null
  },
}))
jest.mock('../../impedimentos/_lista', () => ({ __esModule: true, default: () => null }))
jest.mock('../_seletor-data', () => ({ __esModule: true, default: () => null }))
jest.mock('../_vem-ai', () => ({ __esModule: true, default: () => null }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))

function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'lt', 'order', 'limit', 'contains']) c[m] = () => c
  c.maybeSingle = async () => ({ data: null, error: null })
  c.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
  return c
}
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { email: 'sup@manfac.com.br' } } }) },
    from: () => chain(),
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
  }),
}))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: async () => true }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: async () => false }))
jest.mock('../../_obra-da-requisicao', () => ({
  lerObraDaRequisicao: async () => ({
    ok: true,
    dados: {
      obra: { id: 'o1', modalidade: 'obra', engenheiro_email: null, atividade_trava: null, data_base: '2026-10-01' },
      calc: { atividades: [] },
      versaoBase: { salvaEm: '2026-10-01T00:00:00Z' },
      plano: [{ numero: 4, descricao: 'Drywall' }],
      exec: [],
      feriados: new Set(),
      impedimentos: [],
    },
  }),
}))
jest.mock('../_preenchimento', () => ({ montarDiario: () => ({ inicial: {}, atividades: [], outras: [] }) }))
jest.mock('../../../_lib/leitura', () => ({ lerPlano: async () => ({ ok: false }) }))
const lerMapa = jest.fn()
const lerReferenciasDosPontos = jest.fn()
jest.mock('../../../_lib/mapa-leitura', () => ({
  lerMapa: (...a: unknown[]) => lerMapa(...a),
  lerReferenciasDosPontos: (...a: unknown[]) => lerReferenciasDosPontos(...a),
}))

import DiarioObraPage from '../page'

const mapa = {
  configurado: true,
  mapa: { modo: 'ambientes', plantaPath: null, plantaLargura: null, plantaAltura: null },
  ambientes: [{ id: 'A', nome: 'Salão', areaM2: null, x: null, y: null, w: null, h: null, ordem: 1 }],
  pontos: [{ id: 'p1', numero: 1, nome: 'Entrada', ambienteId: 'A', x: null, y: null, ativo: true }],
  vinculos: [{ ambienteId: 'A', atividadeNumero: 4 }],
}
const abrir = async () =>
  render(await DiarioObraPage({ params: Promise.resolve({ id: 'o1' }), searchParams: Promise.resolve({ data: '2026-11-01' }) }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

it('com mapa: passa a ronda ao diário e os ambientes ao form de impedimento', async () => {
  lerMapa.mockResolvedValue({ ok: true, dados: mapa })
  lerReferenciasDosPontos.mockResolvedValue({ ok: true, referencias: new Map() })
  await abrir()
  expect(screen.getByTestId('passos')).toBeTruthy()
  expect(passosProps.mock.calls[0][0].mapa).toMatchObject({
    ambientes: [{ id: 'A', nome: 'Salão', atividades: [4] }],
    pontos: [{ id: 'p1', numero: 1 }],
  })
  expect(formProps.mock.calls[0][0]).toMatchObject({ ambientes: [{ id: 'A', nome: 'Salão' }] })
})

it('mapa ilegível (SQL da Leva 6 não aplicado): diário de sempre, sem ronda nem ambientes', async () => {
  lerMapa.mockResolvedValue({ ok: false, erro: 'relation "obras_mapa" does not exist' })
  await abrir()
  expect(screen.getByTestId('passos')).toBeTruthy()
  expect(passosProps.mock.calls[0][0].mapa).toBeNull()
  expect(formProps.mock.calls[0][0]).toMatchObject({ ambientes: [] })
  expect(lerReferenciasDosPontos).not.toHaveBeenCalled()
})

it('referências da ronda ilegíveis: a ronda continua, só sem a miniatura', async () => {
  lerMapa.mockResolvedValue({ ok: true, dados: mapa })
  lerReferenciasDosPontos.mockResolvedValue({ ok: false, erro: 'x' })
  await abrir()
  expect(passosProps.mock.calls[0][0].mapa.pontos).toEqual([
    { id: 'p1', numero: 1, nome: 'Entrada', ambienteId: 'A', referenciaUrl: null, referenciaData: null },
  ])
})
