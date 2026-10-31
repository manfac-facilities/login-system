import type { Restricao } from '../last-planner'
import { comDatasDoPedido, pedidoDeLinha, prontaParaLiberar, textoDatasPedido, type PedidoDaRestricao } from '../restricao-pedido'

const ped = (over: Partial<PedidoDaRestricao> = {}): PedidoDaRestricao => ({
  pedidoId: 'p1', solicitacaoNumero: 42, pedidoSequencia: 1, fornecedor: 'Casa Forte', situacao: 'emitido',
  previsaoEntrega: '2026-11-05', entregaSituacao: 'pendente', entregaEm: null, ...over,
})
const r = (over: Partial<Restricao> = {}): Restricao => ({
  id: 'r1', obraId: 'o1', atividadeNumero: 3, tipo: 'material', descricao: 'Porcelanato', responsavel: 'manfac',
  prazo: '2026-11-01', situacao: 'em_tratativa', liberadaEm: null, criadoPor: null, criadoEm: '2026-10-20T10:00:00Z',
  cmpPedidoId: 'p1', pedido: ped(), ...over,
})
const entregue = { entregaSituacao: 'confirmada', entregaEm: '2026-11-04T15:00:00Z' }

describe('Pronta para liberar', () => {
  it('só quando o pedido está entregue (confirmada/resolvida com data)', () => {
    expect(prontaParaLiberar(r())).toBe(false)
    expect(prontaParaLiberar(r({ pedido: ped({ entregaSituacao: 'divergencia', entregaEm: '2026-11-04T15:00:00Z' }) }))).toBe(false)
    expect(prontaParaLiberar(r({ pedido: ped({ entregaSituacao: 'confirmada', entregaEm: null }) }))).toBe(false)
    expect(prontaParaLiberar(r({ pedido: ped(entregue) }))).toBe(true)
    expect(prontaParaLiberar(r({ pedido: ped({ ...entregue, entregaSituacao: 'resolvida' }) }))).toBe(true)
    expect(prontaParaLiberar(r({ pedido: null, cmpPedidoId: null }))).toBe(false)
  })
  it('restrição já liberada não mostra o selo; entregue nunca muda a situação', () => {
    expect(prontaParaLiberar(r({ situacao: 'liberada', pedido: ped(entregue) }))).toBe(false)
    expect(comDatasDoPedido([r({ pedido: ped(entregue) })])[0].situacao).toBe('em_tratativa')
  })
})

describe('datas do pedido nos textos', () => {
  it('"previsto X · entregue Y"', () => {
    expect(textoDatasPedido(ped())).toBe('previsto 05/11/2026 · entrega pendente')
    expect(textoDatasPedido(ped(entregue))).toBe('previsto 05/11/2026 · entregue 04/11/2026')
  })
  it('com pedido: prazo = previsão; liberada em = entrega (dia de Brasília); sem pedido: inalterada', () => {
    const [a, b] = comDatasDoPedido([
      r({ pedido: ped({ entregaSituacao: 'confirmada', entregaEm: '2026-11-05T01:30:00Z' }) }),
      r({ pedido: null }),
    ])
    expect(a.prazo).toBe('2026-11-05')
    expect(a.liberadaEm).toBe('2026-11-04')
    expect(b.prazo).toBe('2026-11-01')
    expect(b.liberadaEm).toBeNull()
  })
})

it('pedidoDeLinha não carrega nenhum campo de valor', () => {
  const p = pedidoDeLinha({ pedido_id: 'p1', solicitacao_numero: 42, total_centavos: 999, valor_estimado_centavos: 1 })
  expect(Object.keys(p).some((k) => /valor|total|centavos/i.test(k))).toBe(false)
  expect(JSON.stringify(p)).not.toMatch(/999/)
})

describe('lerRestricoes anexa as datas do pedido ligado', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { lerRestricoes } = require('../leitura') as typeof import('../leitura')
  const cliente = (linhas: Record<string, unknown>[], rpc: jest.Mock) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      order: async () => ({ data: linhas, error: null }),
    }
    return { from: () => q, rpc } as never
  }
  const linha = (over: Record<string, unknown> = {}) => ({
    id: 'r1', obra_id: 'o1', atividade_numero: 3, tipo: 'material', descricao: 'x', responsavel: 'manfac',
    prazo: '2026-11-01', situacao: 'identificada', liberada_em: null, criado_por: null, criado_em: '2026-10-20', ...over,
  })

  it('sem vínculo não consulta o Compras', async () => {
    const rpc = jest.fn()
    const r = await lerRestricoes(cliente([linha()], rpc), 'o1')
    expect(rpc).not.toHaveBeenCalled()
    expect(r.ok && r.restricoes[0].pedido).toBeNull()
  })

  it('com vínculo consulta obras_restricao_pedidos (sessão) e anexa; falha da consulta só tira as datas', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ pedido_id: 'p1', previsao_entrega: '2026-11-05', entrega_situacao: 'confirmada', entrega_em: '2026-11-04T15:00:00Z' }], error: null })
    const r = await lerRestricoes(cliente([linha({ cmp_pedido_id: 'p1' })], rpc), 'o1')
    expect(rpc).toHaveBeenCalledWith('obras_restricao_pedidos', { p_obra: 'o1' })
    expect(r.ok && prontaParaLiberar(r.restricoes[0])).toBe(true)
    const falha = jest.fn().mockResolvedValue({ data: null, error: { message: 'x' } })
    const r2 = await lerRestricoes(cliente([linha({ cmp_pedido_id: 'p1' })], falha), 'o1')
    expect(r2.ok && r2.restricoes[0].pedido).toBeNull()
  })
})
