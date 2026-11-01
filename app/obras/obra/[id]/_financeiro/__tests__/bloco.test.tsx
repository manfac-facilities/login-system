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
    pendencias: { comprasSemEntrega: 0, medicoesFornecedorAtrasadas: null, caixinhaSemObra: 2, locacoes: null },
    compras: { ok: true, dados: [] },
    fornecedores: { ok: true, dados: [] },
    faturamento: { ok: true, dados: [] },
  },
  resumo: {
    valorCentavos: 17205355, faturadoCentavos: 15641232, faturadoPct: 90, faltaCentavos: 1564123, acimaDoValorCentavos: null,
    notas: 2, foraDoSistema: true, custo, margemPrevistaCentavos: 9205355, margemPrevistaPct: 53.5,
    margemRealizadaCentavos: 10641232, margemRealizadaPct: 68,
  },
  locacoes: [{
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
