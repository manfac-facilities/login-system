/**
 * Comunicação sem o SQL da Leva 6b (revisão da Task 3, I1): o select de envios com `fase_revisao_id`
 * dá 42703; a página relê sem a coluna e segue (faseRevisao null), em vez de cair inteira.
 */
type Linha = Record<string, unknown>
let semColuna6b = false
let selects: string[] = []
const db: Record<string, Linha[]> = {}

function consulta(tabela: string) {
  let colunas = ''
  const executar = () => {
    if (tabela === 'obras_envio') selects.push(colunas)
    if (semColuna6b && tabela === 'obras_envio' && colunas.includes('fase_revisao_id')) {
      return { data: null, error: { code: '42703', message: 'column obras_envio.fase_revisao_id does not exist' } }
    }
    if (semColuna6b && tabela === 'obras_fase_revisao') {
      return { data: null, error: { code: '42P01', message: 'relation "public.obras_fase_revisao" does not exist' } }
    }
    return { data: db[tabela] ?? [], error: null }
  }
  const q: Record<string, unknown> = {
    select: (c: string) => ((colunas = c), q),
    eq: () => q,
    order: () => q,
    limit: () => q,
    contains: () => q,
    maybeSingle: async () => ({ ...executar(), data: null }),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, ko),
  }
  return q
}

const linhaProps = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { email: 'eng@manfac.com.br' } } }) },
    from: (t: string) => consulta(t),
  })),
}))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async () => true) }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async () => false) }))
jest.mock('../../_obra-da-requisicao', () => ({
  lerObraDaRequisicao: async () => ({ ok: true, dados: { obra: { engenheiro_email: 'eng@manfac.com.br' }, plano: [], impedimentos: [] } }),
}))
jest.mock('../../../_lib/envios-agenda', () => ({ lerAgenda: jest.fn(async () => null) }))
jest.mock('../../../_lib/relatorio-periodo', () => ({ etapasDaObra: () => [] }))
jest.mock('../../../_pdf/carregar-periodo', () => ({ obraConcluida: () => false, relatorioValido: () => true, ultimoMesDoMensal: () => null }))
jest.mock('../_linha-do-tempo', () => ({ __esModule: true, default: (p: unknown) => (linhaProps(p), null) }))
jest.mock('../_agenda', () => ({ __esModule: true, default: () => null, tipoAgendaDe: () => null }))
jest.mock('../_imediata-form', () => ({ __esModule: true, default: () => null }))
jest.mock('../_responder-form', () => ({ __esModule: true, default: () => null }))
jest.mock('../_registro-form', () => ({ __esModule: true, default: () => null, botaoSecundario: '' }))
jest.mock('../../configuracoes/_documentos', () => ({ __esModule: true, default: () => null }))

import { render, screen } from '@testing-library/react'
import ComunicacaoPage from '../page'

const OBRA = '11111111-2222-4333-8444-555555555555'
const montar = async () =>
  render(await ComunicacaoPage({ params: Promise.resolve({ id: OBRA }), searchParams: Promise.resolve({}) }))
type ItemEnvio = { tipo: string; envio: { id: string; faseRevisao?: unknown } }
const enviosNaLinha = () => ((linhaProps.mock.calls.at(-1)![0] as { itens: ItemEnvio[] }).itens).filter((i) => i.tipo === 'envio').map((i) => i.envio)

beforeEach(() => {
  jest.clearAllMocks()
  selects = []
  db.obras_envio = [
    { id: 'e1', tipo: 'diario', referencia: '2026-10-30', lado: 'cliente', enviado_em: '2026-10-30T20:00:00Z', destinatarios: ['c@x.com'], resultado: 'ok' },
    { id: 'e2', tipo: 'faseamento', referencia: '2026-11-01', lado: 'cliente', enviado_em: '2026-11-01T20:00:00Z', destinatarios: ['c@x.com'], resultado: 'ok', fase_revisao_id: 'r1' },
  ]
  db.obras_fase_revisao = [{ id: 'r1', revisao: 0, fase_numero: 1, fase_nome: 'Demolição' }]
})

it('sem o SQL da 6b: relê os envios sem fase_revisao_id e a linha do tempo aparece (faseRevisao null)', async () => {
  semColuna6b = true
  delete db.obras_envio[1].fase_revisao_id
  await montar()
  expect(selects).toHaveLength(2)
  expect(selects[0]).toContain('fase_revisao_id')
  expect(selects[1]).not.toContain('fase_revisao_id')
  expect(screen.queryByText('Não foi possível carregar a comunicação desta obra')).toBeNull()
  expect(enviosNaLinha().map((e) => [e.id, e.faseRevisao])).toEqual([
    ['e2', null],
    ['e1', null],
  ])
})

it('com o SQL: uma leitura só e o envio de faseamento ganha o rótulo da revisão', async () => {
  semColuna6b = false
  await montar()
  expect(selects).toHaveLength(1)
  expect(enviosNaLinha().find((e) => e.id === 'e2')?.faseRevisao).toEqual({ id: 'r1', rotulo: 'Fase 1 · Demolição · R0' })
})
