import { render, screen, within } from '@testing-library/react'

const OBRA = '11111111-1111-4111-8111-111111111111'
const rpcMock = jest.fn()
const getUserMock = jest.fn()
let obrasLinhas: Record<string, unknown>[] = []

function consultaObras() {
  const q: Record<string, unknown> = {
    select: () => q,
    or: () => q,
    then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: obrasLinhas, error: null }).then(ok),
  }
  return q
}

// Só o cliente da SESSÃO existe neste mock: se a página usasse o admin, o import falharia.
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, rpc: rpcMock, from: () => consultaObras() })),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    throw new Error('a aba Financeiro nunca usa o admin')
  },
}))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async () => true) }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async () => false) }))

import FinanceiroPage from '../page'
import TelaFinanceiro from '../_tela'
import { montarFinanceiro } from '../../../_lib/financeiro-tela'

const montar = async () => render(await FinanceiroPage({ params: Promise.resolve({ id: OBRA }) }))
const funcoesFin = () => rpcMock.mock.calls.map((c) => c[0]).filter((n: string) => n.startsWith('obras_fin_'))

beforeEach(() => {
  rpcMock.mockReset()
  getUserMock.mockResolvedValue({ data: { user: { email: 'eng@manfac.com.br' } } })
  obrasLinhas = [{ id: OBRA, os: '0526-1', loja: 'Macaé 3', obra_pai_id: null }]
})

describe('aba Financeiro: permissão (Review Focus 1)', () => {
  it.each([
    ['false', { data: false, error: null }],
    ['null', { data: null, error: null }],
    ['erro', { data: null, error: { message: 'x' } }],
  ])('obras_pode_ver_valores = %s → aviso, nenhuma leitura de valor', async (_n, resp) => {
    rpcMock.mockResolvedValue(resp)
    await montar()
    expect(screen.getByText(/só para o engenheiro da obra/)).toBeInTheDocument()
    expect(rpcMock).toHaveBeenCalledWith('obras_pode_ver_valores', { p_obra: OBRA })
    expect(funcoesFin()).toEqual([])
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('pode ver: chama as 3 leituras com o cliente da sessão e mostra "sem lançamentos" sem NaN', async () => {
    rpcMock.mockImplementation(async (nome: string) => (nome === 'obras_pode_ver_valores' ? { data: true, error: null } : { data: [], error: null }))
    const { container } = await montar()
    expect(funcoesFin().sort()).toEqual(['obras_fin_compras', 'obras_fin_fornecedores', 'obras_fin_notas'])
    expect(screen.getByText('Sem lançamentos financeiros nesta obra ainda.')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/NaN/)
    expect(screen.getByText(/Dados até/)).toBeInTheDocument()
  })

  it('leitura que falha avisa no bloco e no resumo, não vira "sem lançamentos"', async () => {
    rpcMock.mockImplementation(async (nome: string) =>
      nome === 'obras_pode_ver_valores' ? { data: true, error: null } : nome === 'obras_fin_notas' ? { data: null, error: { message: 'x' } } : { data: [], error: null },
    )
    await montar()
    expect(screen.queryByText('Sem lançamentos financeiros nesta obra ainda.')).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Faturamento' })).getByRole('alert')).toHaveTextContent('Não deu para ler')
    expect(within(screen.getByRole('region', { name: 'Resumo' })).getByRole('alert')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Compras' })).queryByRole('alert')).toBeNull()
  })
})

describe('TelaFinanceiro', () => {
  const obras = [{ id: 'o1', os: '0526-1', loja: 'Macaé 3', paiId: null }]
  it('bloco inconsistente mostra "dados inconsistentes" e os outros seguem; link do Compras é <a> comum', () => {
    const fin = montarFinanceiro({
      obraId: 'o1', obras, fornecedores: [], notas: [],
      compras: [{ obra_id: 'o1', solicitacao_id: 's', solicitacao_numero: 42, pedido_id: 'p', pedido_situacao: 'emitido', total_centavos: 'x' }],
    })
    render(<TelaFinanceiro fin={fin} obras={obras} obraId="o1" lidoEm="2026-10-31T15:00:00Z" />)
    expect(within(screen.getByRole('region', { name: 'Compras' })).getByRole('alert')).toHaveTextContent('Dados inconsistentes')
    expect(within(screen.getByRole('region', { name: 'Faturamento' })).getByText('Sem lançamentos.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir material' })).toHaveAttribute('href', '/compras/solicitacoes/nova?obra=o1')
  })

  it('compras com valor em R$ e "abrir no Compras" para a solicitação', () => {
    const fin = montarFinanceiro({
      obraId: 'o1', obras, fornecedores: [], notas: [],
      compras: [{ obra_id: 'o1', solicitacao_id: 's', solicitacao_numero: 42, solicitacao_motivo: 'Porcelanato', pedido_id: 'p', pedido_situacao: 'emitido', total_centavos: 123456, fornecedor_razao_social: 'Casa Forte' }],
    })
    render(<TelaFinanceiro fin={fin} obras={obras} obraId="o1" lidoEm="2026-10-31T15:00:00Z" />)
    const compras = screen.getByRole('region', { name: 'Compras' })
    expect(within(compras).getByRole('link', { name: 'abrir no Compras' })).toHaveAttribute('href', '/compras/solicitacoes/42')
    expect(within(compras).getByText(/1\.234,56/)).toBeInTheDocument()
  })
})
