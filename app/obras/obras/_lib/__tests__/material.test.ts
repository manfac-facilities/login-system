import {
  PRAZOS_PADRAO_COMPRAS,
  avisosMaterial,
  comprasDeLinhas,
  linkPedirMaterial,
  listaVemAi,
  pedirAte,
  prazosDeLinha,
  type CompraDaRestricao,
  type PrazosCompras,
} from '../material'
import type { AtividadeCalculada } from '../cronograma'
import type { Restricao } from '../last-planner'

const P32: PrazosCompras = { diasExpediente: [1, 2, 3, 4, 5], folga: 3, entregaMaterial: 2 }
const HOJE = '2026-11-03'

// Mesma aritmética do Compras (lib/solicitacoes/prazos.ts), só para a propriedade.
function somarDiasDeExpediente(data: string, n: number, dias: number[]): string {
  let d = data
  for (let i = 0; i < n; i++) {
    for (;;) {
      const x = new Date(`${d}T12:00:00Z`)
      x.setUTCDate(x.getUTCDate() + 1)
      d = x.toISOString().slice(0, 10)
      const w = new Date(`${d}T12:00:00Z`).getUTCDay()
      if (dias.includes(w === 0 ? 7 : w)) break
    }
  }
  return d
}

const ativ = (numero: number, inicio: string, o: Partial<AtividadeCalculada> = {}) =>
  ({ numero, descricao: `Atividade ${numero}`, status: 'nao_iniciado', inicioProjetado: inicio, inicioPrevisto: inicio, ...o }) as unknown as AtividadeCalculada

const rest = (id: string, atividadeNumero: number, o: Partial<Restricao> = {}): Restricao => ({
  id,
  obraId: 'o1',
  atividadeNumero,
  tipo: 'material',
  descricao: 'Cimento',
  responsavel: 'manfac',
  prazo: null,
  situacao: 'identificada',
  liberadaEm: null,
  criadoPor: null,
  criadoEm: '2026-10-01T00:00:00Z',
  ...o,
})

const compra = (o: Partial<CompraDaRestricao> = {}): CompraDaRestricao => ({
  solicitacaoNumero: 7,
  etapa: 'cotacao',
  enviadoEm: '2026-10-28T12:00:00Z',
  dataMinima: '2026-11-09',
  pedidos: [],
  ...o,
})

describe('pedirAte', () => {
  it('valores da spec', () => {
    expect(pedirAte('2026-11-10', P32)).toBe('2026-11-03')
    expect(pedirAte('2026-11-06', P32)).toBe('2026-10-30')
    expect(pedirAte('2026-11-10', PRAZOS_PADRAO_COMPRAS)).toBe('2026-10-28')
  })
  it('é o inverso de somarDiasDeExpediente', () => {
    for (const ini of ['2026-11-10', '2026-11-06', '2026-11-16']) {
      for (const p of [P32, PRAZOS_PADRAO_COMPRAS]) {
        expect(somarDiasDeExpediente(pedirAte(ini, p), p.folga + p.entregaMaterial, p.diasExpediente)).toBe(ini)
      }
    }
  })
})

describe('prazosDeLinha', () => {
  it('null = padrão', () => expect(prazosDeLinha(null)).toEqual(PRAZOS_PADRAO_COMPRAS))
  it('lê prazos e usa padrão de expediente', () => {
    expect(prazosDeLinha({ prazos: { folga_processo_dias: 3, entrega_material_dias: 2 }, expediente: null })).toEqual({
      diasExpediente: [1, 2, 3, 4, 5],
      folga: 3,
      entregaMaterial: 2,
    })
  })
  it('lê expediente', () => {
    expect(prazosDeLinha({ prazos: null, expediente: { dias: [1, 2, 3, 4, 5, 6] } }).diasExpediente).toEqual([1, 2, 3, 4, 5, 6])
  })
  it('negativo ou não inteiro vira o padrão do campo', () => {
    expect(prazosDeLinha({ prazos: { folga_processo_dias: -1, entrega_material_dias: 1.5 }, expediente: { dias: [] } })).toEqual(
      PRAZOS_PADRAO_COMPRAS,
    )
  })
})

describe('comprasDeLinhas', () => {
  it('agrupa pedidos por solicitação e aplica a regra de entregue', () => {
    const base = { restricao_id: 'r1', solicitacao_id: 's1', solicitacao_numero: 7, etapa: 'pedido', enviado_em: '2026-10-28T12:00:00Z', data_minima: '2026-11-09' }
    const m = comprasDeLinhas([
      { ...base, pedido_id: 'p1', previsao_entrega: '2026-11-05', entrega_situacao: 'confirmada', entrega_em: '2026-11-04T10:00:00Z' },
      { ...base, pedido_id: 'p2', previsao_entrega: '2026-11-08', entrega_situacao: 'divergencia', entrega_em: '2026-11-04T10:00:00Z' },
      { ...base, solicitacao_id: 's2', solicitacao_numero: 8, etapa: 'cotacao', pedido_id: null },
    ])
    const r1 = m.get('r1')!
    expect(r1).toHaveLength(2)
    expect(r1[0].pedidos).toEqual([
      { previsaoEntrega: '2026-11-05', entregue: true },
      { previsaoEntrega: '2026-11-08', entregue: false },
    ])
    expect(r1[1]).toMatchObject({ solicitacaoNumero: 8, etapa: 'cotacao', pedidos: [] })
  })
})

describe('listaVemAi', () => {
  const base = { restricoes: [] as Restricao[], naoPrecisa: new Set<number>(), hoje: HOJE, prazos: P32 }
  it('entra nao_iniciado na janela, inclusive início passado, ordenado por pedirAte', () => {
    const r = listaVemAi({ ...base, atividades: [ativ(1, '2026-11-10'), ativ(2, '2026-10-30')] })
    expect(r.map((x) => x.numero)).toEqual([2, 1])
    expect(r[1]).toMatchObject({ nome: 'Atividade 1', inicio: '2026-11-10', pedirAte: '2026-11-03' })
  })
  it('fica fora o que não se aplica', () => {
    const r = listaVemAi({
      ...base,
      atividades: [ativ(1, '2026-12-02'), ativ(2, '2026-11-10', { status: 'em_andamento' }), ativ(3, '2026-11-10', { status: 'concluido' }), ativ(4, '2026-11-10'), ativ(5, '2026-11-10')],
      naoPrecisa: new Set([4]),
      restricoes: [rest('x', 5, { situacao: 'liberada' })],
    })
    expect(r).toEqual([])
  })
})

describe('avisosMaterial', () => {
  const base = { naoPrecisa: new Set<number>(), hoje: HOJE, prazos: P32 }
  const av = (atividades: AtividadeCalculada[], restricoes: Restricao[], compras: Map<string, CompraDaRestricao[]> | null) =>
    avisosMaterial({ ...base, atividades, restricoes, compras })

  it('sem resposta vence hoje', () => {
    const r = av([ativ(1, '2026-11-10')], [], new Map())
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ tipo: 'sem_resposta', nivel: 'vermelho', atividade: 1, destino: 'diario', restricaoId: null })
    expect(r[0].titulo).toMatch(/vence hoje/)
  })
  it('sem resposta com prazo à frente não avisa', () => {
    expect(av([ativ(1, '2026-11-24')], [], new Map())).toEqual([])
  })
  it('pedir amarelo e vermelho', () => {
    const a = av([ativ(1, '2026-11-17')], [rest('r1', 1)], new Map())
    expect(a[0]).toMatchObject({ tipo: 'pedir', nivel: 'amarelo', titulo: 'Pedir até 10/11: Cimento', destino: 'compras', restricaoId: 'r1' })
    const b = av([ativ(1, '2026-11-10')], [rest('r1', 1)], new Map())
    expect(b[0]).toMatchObject({ tipo: 'pedir', nivel: 'vermelho', titulo: 'Pedir hoje: Cimento' })
  })
  it('não chega a tempo', () => {
    const c = new Map([['r1', [compra({ etapa: 'pedido', pedidos: [{ previsaoEntrega: '2026-11-11', entregue: false }] })]]])
    const a = av([ativ(1, '2026-11-06')], [rest('r1', 1)], c)
    expect(a[0]).toMatchObject({ tipo: 'nao_chega', nivel: 'vermelho', destino: 'lookahead', titulo: 'Material chega 3 dia(s) útil(eis) depois do início' })
    expect(a[0].cadeia[0]).toBe('Atividade 1 começa 06/11/2026')
  })
  it('dois pedidos, um entregue e outro atrasado', () => {
    const c = new Map([['r1', [compra({ etapa: 'pedido', pedidos: [{ previsaoEntrega: '2026-11-04', entregue: true }, { previsaoEntrega: '2026-11-11', entregue: false }] })]]])
    expect(av([ativ(1, '2026-11-06')], [rest('r1', 1)], c)[0].tipo).toBe('nao_chega')
  })
  it('todos entregues ou no prazo: nada', () => {
    const c = new Map([['r1', [compra({ etapa: 'pedido', pedidos: [{ previsaoEntrega: '2026-11-11', entregue: true }] })]]])
    expect(av([ativ(1, '2026-11-06')], [rest('r1', 1)], c)).toEqual([])
  })
  it('parada só depois da data mínima', () => {
    const mk = (dataMinima: string) => new Map([['r1', [compra({ dataMinima })]]])
    const a = av([ativ(1, '2026-11-20')], [rest('r1', 1)], mk('2026-10-30'))
    expect(a[0]).toMatchObject({ tipo: 'parada', nivel: 'amarelo', destino: 'lookahead' })
    expect(av([ativ(1, '2026-11-20')], [rest('r1', 1)], mk('2026-11-09'))).toEqual([])
  })
  it('atendida_estoque e concluida: nada', () => {
    for (const etapa of ['atendida_estoque', 'concluida']) {
      expect(av([ativ(1, '2026-11-06')], [rest('r1', 1)], new Map([['r1', [compra({ etapa, dataMinima: '2026-10-01' })]]]))).toEqual([])
    }
  })
  it('todas canceladas/recusadas voltam a pedir', () => {
    const c = new Map([['r1', [compra({ etapa: 'cancelada' }), compra({ etapa: 'recusada', solicitacaoNumero: 8 })]]])
    expect(av([ativ(1, '2026-11-17')], [rest('r1', 1)], c)[0].tipo).toBe('pedir')
  })
  it('restrição liberada: nada', () => {
    expect(av([ativ(1, '2026-11-10')], [rest('r1', 1, { situacao: 'liberada' })], new Map())).toEqual([])
  })
  it('compras null: só sem_resposta/pedir; ligação antiga não vira pedir', () => {
    const a = av([ativ(1, '2026-11-17'), ativ(2, '2026-11-17')], [rest('r1', 1), rest('r2', 2, { cmpPedidoId: 'p9' })], null)
    expect(a.map((x) => x.restricaoId)).toEqual(['r1'])
  })
  it('ordem: vermelhos antes, depois início', () => {
    const a = av([ativ(1, '2026-11-17'), ativ(2, '2026-11-10'), ativ(3, '2026-11-12')], [rest('r1', 1), rest('r2', 2), rest('r3', 3)], new Map())
    expect(a.map((x) => `${x.nivel}:${x.inicio}`)).toEqual(['vermelho:2026-11-10', 'amarelo:2026-11-12', 'amarelo:2026-11-17'])
  })
})

describe('linkPedirMaterial', () => {
  it('monta a URL com encode', () => {
    const u = linkPedirMaterial({ obraId: 'o 1', restricao: rest('r1', 1, { descricao: 'Cimento & areia' }), atividade: { numero: 4, nome: 'Piso áspero', inicio: '2026-11-10' } })
    expect(u).toBe(
      '/compras/solicitacoes/nova?obra=o%201&tipo=material&prazo=2026-11-10&restricao=r1&atividade=4&nome=Piso%20%C3%A1spero&inicio=2026-11-10&material=Cimento%20%26%20areia',
    )
  })
})
