import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
jest.mock('../_actions', () => ({
  marcarDevolvidaSpotAction: jest.fn(async () => ({ ok: true })),
  renovarLocacaoSpotAction: jest.fn(async () => ({ ok: true })),
}))

import BlocoFinanceiroSpot from '../bloco'
import { marcarDevolvidaSpotAction } from '../_actions'
import type { FinanceiroSpot } from '../dados'

const OBRA = '11111111-1111-4111-8111-111111111111'
const PEDIDO = '22222222-2222-4222-8222-222222222222'
const custo = { comprometido: 8000000, realizado: 5000000, pago: 3000000 }
const zero = { comprometido: 0, realizado: 0, pago: 0 }

const dados = {
  ok: true,
  lidoEm: '2026-11-01T15:00:00Z',
  fin: {
    semLancamentos: false,
    resumo: { ok: true, dados: { origens: { compras: custo, fornecedores: zero, pagamentos: zero, caixinha: zero, locacoes: zero } } },
    pendencias: { comprasSemEntrega: 3, medicoesFornecedorAtrasadas: { quantidade: 1, maisDias: 12 }, caixinhaSemObra: 2, locacoes: null },
    compras: { ok: true, dados: [{ chave: 'c1', os: 'x', solicitacaoNumero: 7, descricao: 'Cimento', etapa: null, fornecedor: 'Forn', valorCentavos: 1000, valorEstimado: false, previsao: null, entrega: 'Entregue', entregaEm: null, nf: '55', pagoEm: '2026-10-20', status: 'Pago', link: null }] },
    fornecedores: { ok: true, dados: [] },
    faturamento: { ok: true, dados: [{ chave: 'n1', os: 'x', numero: '700', tomador: null, situacao: 'Autorizada', parcelaCentavos: 1000000, totalCentavos: 2500000, emitidaEm: '2026-10-02', contaNaReceita: true }] },
  },
  resumo: {
    valorCentavos: 17205355, faturadoCentavos: 15641232, faturadoPct: 90, faltaCentavos: 1564123, acimaDoValorCentavos: null,
    notas: 2, foraDoSistema: true, custo, margemPrevistaCentavos: 9205355, margemPrevistaPct: 53.5,
    margemRealizadaCentavos: 10641232, margemRealizadaPct: 68,
  },
  locacoes: [{
    pedidoId: 'p-dev', obraId: OBRA, os: null, item: 'Betoneira', solicitacaoNumero: 2, fornecedor: 'Loc SA', totalCentavos: null,
    inicio: '2026-04-01', locacaoFim: '2026-05-09', fim: '2026-05-09', semPeriodo: false, estado: 'devolvida', devolvidaEm: '2026-05-09', renovadaAte: null,
  }, {
    pedidoId: PEDIDO, obraId: OBRA, os: null, item: 'Andaime', solicitacaoNumero: 1, fornecedor: 'Loc SA', totalCentavos: 100000,
    inicio: '2026-10-01', locacaoFim: '2026-11-10', fim: '2026-11-10', semPeriodo: false, estado: 'ativa', devolvidaEm: null, renovadaAte: null,
  }],
  externas: [{ nfse: '735', emitidaEm: '2026-10-05', valorCentavos: 5000000 }],
} as unknown as FinanceiroSpot

beforeEach(() => jest.clearAllMocks())

describe('BlocoFinanceiroSpot', () => {
  it('totais e avisos', () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    expect(screen.getByText('R$ 156.412,32')).toBeInTheDocument()
    expect(screen.getByText(/90% · 2 notas · falta R\$ 15\.641,23/)).toBeInTheDocument()
    expect(screen.getByText('Nota fora do sistema: faturado considerado pelo valor da OS.')).toBeInTheDocument()
    expect(screen.getByText(/Dados até/)).toBeInTheDocument()
  })

  it('Resumo: coluna Pendências, Realizado (NF) e linha Total', () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    expect(screen.getByRole('columnheader', { name: 'Pendências' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Realizado (NF)' })).toBeInTheDocument()
    expect(screen.getByText('3 sem entrega')).toBeInTheDocument()
    expect(screen.getByText('1 medição há 12 dias em aprovação')).toBeInTheDocument()
    const total = screen.getByRole('cell', { name: 'Total' }).closest('tr') as HTMLElement
    expect(total).toHaveTextContent('R$ 80.000,00')
    expect(total).toHaveTextContent('R$ 50.000,00')
    expect(total).toHaveTextContent('R$ 30.000,00')
  })

  it('Compras mostra a data de pagamento', async () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    await userEvent.click(screen.getByRole('tab', { name: 'Compras' }))
    expect(screen.getByRole('columnheader', { name: 'Pago' })).toBeInTheDocument()
    expect(screen.getByText('20/10/2026')).toBeInTheDocument()
  })

  it('Faturamento: barra, Valor da nota e Falta faturar', async () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    await userEvent.click(screen.getByRole('tab', { name: 'Faturamento' }))
    expect(screen.getByText('Faturado sobre o valor da OS')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Valor da nota' })).toBeInTheDocument()
    expect(screen.getByText('R$ 25.000,00')).toBeInTheDocument()
    expect(screen.getByText('Falta faturar').closest('tr')).toHaveTextContent('R$ 15.641,23')
  })

  it('Locações: devolvida mostra a data', async () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    await userEvent.click(screen.getByRole('tab', { name: 'Locações' }))
    expect(screen.getByText('devolvida 09/05')).toBeInTheDocument()
  })

  it('Dados até mostra data e hora', () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    expect(screen.getByText('Dados até 01/11/2026 12:00')).toBeInTheDocument()
  })

  it('sub-aba Faturamento mostra a NFS-e 735', async () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    await userEvent.click(screen.getByRole('tab', { name: 'Faturamento' }))
    expect(screen.getByText('NFS-e 735')).toBeInTheDocument()
  })

  it('Pagamentos e caixinha mostra despesas sem obra', async () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    await userEvent.click(screen.getByRole('tab', { name: 'Pagamentos e caixinha' }))
    expect(screen.getByText('2 despesas sem obra no CC')).toBeInTheDocument()
  })

  it('Devolvida chama a action com (obraId, pedidoId, hoje) e atualiza', async () => {
    render(<BlocoFinanceiroSpot obraId={OBRA} dados={dados} hoje="2026-11-01" />)
    await userEvent.click(screen.getByRole('tab', { name: 'Locações' }))
    await userEvent.click(screen.getByRole('button', { name: 'Devolvida' }))
    expect(marcarDevolvidaSpotAction).toHaveBeenCalledWith(OBRA, PEDIDO, '2026-11-01')
    expect(refresh).toHaveBeenCalled()
  })

  it('sem-permissao não renderiza; leitura mostra aviso', () => {
    const { container, rerender } = render(<BlocoFinanceiroSpot obraId={OBRA} dados={{ ok: false, motivo: 'sem-permissao' }} hoje="2026-11-01" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<BlocoFinanceiroSpot obraId={OBRA} dados={{ ok: false, motivo: 'leitura' }} hoje="2026-11-01" />)
    expect(screen.getByText('Não foi possível ler o financeiro agora.')).toBeInTheDocument()
  })
})
