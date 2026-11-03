/** Trilha da restrição de material no Lookahead (spec §5.3). */
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('../_actions', () => ({
  ligarPedidoAction: jest.fn(),
  desfazerNaoPrecisaAction: jest.fn(async () => ({ ok: true })),
}))
const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { DesfazerNaoPrecisa, TrilhaMaterial } from '../_pedido'
import { desfazerNaoPrecisaAction } from '../_actions'
import { linkPedirMaterial, type CompraDaRestricao, type PrazosCompras } from '../../../_lib/material'
import type { Restricao } from '../../../_lib/last-planner'

const prazos: PrazosCompras = { diasExpediente: [1, 2, 3, 4, 5], folga: 3, entregaMaterial: 2 }
const restricao = (over: Partial<Restricao> = {}): Restricao => ({
  id: 'r15', obraId: 'o1', atividadeNumero: 15, tipo: 'material', descricao: 'Brita 1 (12 m³)', responsavel: 'manfac',
  prazo: '2026-11-05', situacao: 'identificada', liberadaEm: null, criadoPor: null, criadoEm: '2026-10-20T10:00:00Z', ...over,
})
const atividade = { numero: 15, nome: 'Base de brita', inicio: '2026-11-12' }
const compra = (over: Partial<CompraDaRestricao> = {}): CompraDaRestricao => ({
  solicitacaoNumero: 401, etapa: 'em_cotacao', enviadoEm: '2026-10-23T12:00:00Z', dataMinima: '2026-10-30', pedidos: [], ...over,
})
const montar = (r: Restricao, compras: CompraDaRestricao[] | null) =>
  render(<TrilhaMaterial obraId="o1" restricao={r} atividade={atividade} compras={compras} hoje="2026-11-03" prazos={prazos} />)

beforeEach(() => jest.clearAllMocks())

describe('TrilhaMaterial', () => {
  it('compra parada: "Cotação parada" com a data mínima do Compras e "Ver no Compras"', () => {
    montar(restricao(), [compra()])
    expect(screen.getByText('Cotação parada')).toBeInTheDocument()
    expect(screen.getByText(/data mínima do Compras era 30\/10/)).toBeInTheDocument()
    expect(screen.getByText('Solicitação #401')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver no Compras' })).toHaveAttribute('href', '/compras/solicitacoes/401')
  })

  it('pedido entregue na solicitação ligada: "Pronta para liberar"', () => {
    montar(restricao(), [compra({ etapa: 'pedido_emitido', pedidos: [{ previsaoEntrega: '2026-11-05', entregue: true }] })])
    expect(screen.getByText('Pronta para liberar')).toBeInTheDocument()
  })

  it('pedido ligado à mão e entregue (comportamento atual): "Pronta para liberar"', () => {
    const r = restricao({
      cmpPedidoId: 'p1',
      pedido: {
        pedidoId: 'p1', solicitacaoNumero: 300, pedidoSequencia: 1, fornecedor: 'Pedreira X', situacao: 'emitido',
        previsaoEntrega: '2026-11-05', entregaSituacao: 'confirmada', entregaEm: '2026-11-04',
      },
    })
    montar(r, [])
    expect(screen.getByText('Pronta para liberar')).toBeInTheDocument()
  })

  it('pedido que chega depois do início: dias úteis de atraso', () => {
    montar(restricao(), [compra({ etapa: 'pedido_emitido', pedidos: [{ previsaoEntrega: '2026-11-17', entregue: false }] })])
    expect(screen.getByText(/3 dia\(s\) útil\(eis\) depois do início/)).toBeInTheDocument()
  })

  it('sem solicitação: "Pedir até" e "Pedir no Compras" com o link preenchido', () => {
    montar(restricao(), [])
    expect(screen.getByText('Pedir até 05/11')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir no Compras' })).toHaveAttribute(
      'href',
      linkPedirMaterial({ obraId: 'o1', restricao: restricao(), atividade }),
    )
  })

  it('prazos do Compras não lidos: "Pedir até —", sem selo de vencido, botão de pedir segue', () => {
    render(
      <TrilhaMaterial obraId="o1" restricao={restricao()} atividade={{ ...atividade, inicio: '2026-11-04' }} compras={[]} hoje="2026-11-03" prazos={null} />,
    )
    expect(screen.getByText('Pedir até —')).toBeInTheDocument()
    expect(screen.queryByText(/Pedir hoje|vencido/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir no Compras' })).toBeInTheDocument()
  })

  it('leitura do Compras falhou: "andamento indisponível agora", sem botão de pedir', () => {
    montar(restricao(), null)
    expect(screen.getByText(/andamento indisponível agora/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pedir no Compras' })).not.toBeInTheDocument()
  })

  it('nunca mostra valores', () => {
    const { container } = montar(restricao(), [compra({ etapa: 'pedido_emitido', pedidos: [{ previsaoEntrega: '2026-11-10', entregue: false }] })])
    expect(container.textContent).not.toContain('R$')
  })
})

describe('DesfazerNaoPrecisa', () => {
  it('chama a action, fica desabilitado enquanto roda e atualiza a tela', async () => {
    let soltar: (v: { ok: true }) => void = () => {}
    ;(desfazerNaoPrecisaAction as jest.Mock).mockImplementationOnce(() => new Promise((r) => (soltar = r)))
    render(<DesfazerNaoPrecisa obraId="o1" numero={13} />)
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer não precisa' }))
    expect(desfazerNaoPrecisaAction).toHaveBeenCalledWith('o1', 13)
    expect(screen.getByRole('button')).toBeDisabled()
    soltar({ ok: true })
    await screen.findByRole('button', { name: 'Desfazer não precisa' })
    expect(refresh).toHaveBeenCalled()
  })
})
