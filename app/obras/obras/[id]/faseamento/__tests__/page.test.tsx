/**
 * Página do faseamento (revisão da Task 3): sem o SQL da 6b mostra "ainda não está disponível" em vez de
 * quebrar (I1); camadas gravadas que o schema recusa não somem em silêncio (M3).
 */
import { criarBanco, type Banco } from './fixtures/banco'

let b: Banco
const telaProps = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => b.cliente(async () => ({ data: { user: { email: 'eng@manfac.com.br' } } }))),
}))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async () => true) }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async () => false) }))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image', Svg: 'Svg', G: 'G', Rect: 'Rect', Path: 'Path',
  Polygon: 'Polygon', Polyline: 'Polyline', Circle: 'Circle', Line: 'Line',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))
jest.mock('../_tela', () => ({ __esModule: true, default: (p: unknown) => (telaProps(p), null) }))

import { render, screen } from '@testing-library/react'
import FaseamentoPage from '../page'
import type { RevisaoTela } from '../_tipos'

const OBRA = '11111111-2222-4333-8444-555555555555'
const FASE = '22222222-2222-4222-8222-222222222222'
const R0 = '33333333-3333-4333-8333-333333333333'
const montar = async () => render(await FaseamentoPage({ params: Promise.resolve({ id: OBRA }), searchParams: Promise.resolve({}) }))
const revisaoNaTela = () => (telaProps.mock.calls.at(-1)![0] as { revisao: RevisaoTela }).revisao

beforeEach(() => {
  jest.clearAllMocks()
  b = criarBanco()
  b.db = {
    obras_obra: [{ id: OBRA, os: '24.0871', loja: 'Macaé 3', modalidade: 'obra', engenheiro_email: 'eng@manfac.com.br', coordenador_email: null, atividade_trava: null }],
    obras_fase: [{ id: FASE, obra_id: OBRA, numero: 1, nome: 'Demolição', ordem: 1 }],
    obras_fase_revisao: [{ id: R0, fase_id: FASE, obra_id: OBRA, revisao: 0, status: 'rascunho', camadas: [{ id: 'c1', t: 'extintor', at: [0.5, 0.5] }], regras: [], carimbo: {}, usa_trava: false }],
    obras_mapa: [],
    obras_envio: [],
  }
})

it.each([
  ['tabela obras_fase ausente', 'obras_fase.select', { code: '42P01', message: 'relation "public.obras_fase" does not exist' }],
  ['coluna coordenador_email ausente', 'obras_obra.select', { code: '42703', message: 'column obras_obra.coordenador_email does not exist' }],
])('sem o SQL da 6b (%s): aviso de indisponível, sem a tela', async (_n, chave, erro) => {
  b.erro[chave] = erro
  await montar()
  expect(screen.getByText('Faseamento ainda não está disponível nesta obra.')).toBeTruthy()
  expect(telaProps).not.toHaveBeenCalled()
})

it('outro erro de leitura continua o aviso genérico', async () => {
  b.erro['obras_fase.select'] = { message: 'timeout', code: '57014' }
  await montar()
  expect(screen.getByText('Não deu para carregar o faseamento. Recarregue a página.')).toBeTruthy()
})

it('tudo legível: revisão sem aviso', async () => {
  await montar()
  expect(revisaoNaTela()).toMatchObject({ ilegivel: null, camadas: [{ id: 'c1' }] })
})

it('camada gravada que o schema recusa: mostra só as válidas e avisa (leitura até corrigir)', async () => {
  b.db.obras_fase_revisao[0].camadas = [{ id: 'c1', t: 'extintor', at: [0.5, 0.5] }, { t: 'emerg', at: [0.2, 0.2] }]
  await montar()
  const r = revisaoNaTela()
  expect(r.camadas.map((c) => c.id)).toEqual(['c1'])
  expect(r.ilegivel).toContain('Há camadas que não puderam ser lidas')
})
