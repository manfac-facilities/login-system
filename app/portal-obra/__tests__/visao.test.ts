/**
 * Visão do cliente (Leva 5 §3.2, §2): sem R$/peso, sem `numero` interno, sem
 * impedimento oculto, sem área interna; atraso por responsável do lado cliente;
 * rascunho de cronograma não aparece; "Aguardando vocês" = impedimentos do
 * cliente abertos + restrições do cliente não liberadas.
 */
import { diasUteisEntre } from '@/app/obras/obras/_lib/calendario'
import { resumirEtapas, type AtividadeCalculada } from '@/app/obras/obras/_lib/cronograma'
import type { PlanoSemana, Restricao } from '@/app/obras/obras/_lib/last-planner'
import type { ObraGrande } from '@/app/obras/obras/_lib/leitura'
import { imp, obraGrandePdf } from '@/app/obras/obras/_pdf/__tests__/fixtures/rdo'
import { montarVisaoCliente } from '../(obra)/_lib/visao'

const ativ = (numero: number, over: Partial<AtividadeCalculada> = {}): AtividadeCalculada => {
  const a = {
    numero, etapa: 'E', descricao: `Atividade ${numero}`, pred1: null, pred2: null, duracao: 5, bloqueiaPorTrava: false,
    pesoValor: 98765, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
    inicioPrevisto: '2026-10-26', fimPrevisto: '2026-10-30', inicioProjetado: '2026-10-26', fimProjetado: '2026-11-20',
    peso: 0.25, percentualPrevisto: 0, situacao: 'no_prazo', travada: false, inicioFixo: null, diasRestantes: null,
    alertaInicioFixo: 'Começa antes da atividade 30 terminar', inicioFixoAjustado: false, ...over,
  } as AtividadeCalculada
  return { ...a, duracao: diasUteisEntre(a.inicioPrevisto, a.fimPrevisto, new Set()) }
}

/** Atividades com numeros "grandes" (30, 40, 77…) para detectar vazamento do numero: o código exibido é 1.1, 2.1… */
function obra(over: Partial<ObraGrande> = {}): ObraGrande {
  const og = obraGrandePdf({
    impedimentos: [
      imp({ id: 'cli', descricao: 'Liberação do estoque', abertoEm: '2026-11-02', encerradoEm: null, atividadeNumero: 77, travaAtividade: false, impactoDias: 1 }),
      imp({ id: 'cliFechado', descricao: 'Chave da loja entregue', abertoEm: '2026-10-27', encerradoEm: '2026-10-29', atividadeNumero: 77, travaAtividade: false, impactoDias: 1 }),
      imp({ id: 'oc', descricao: 'Pedreiro faltou sem avisar', responsavel: 'manfac', tipo: 'Equipe', exibirAoCliente: false, travaAtividade: false, impactoDias: 2, abertoEm: '2026-11-03', atividadeNumero: null }),
      imp({ id: 'ocCli', descricao: 'Pendência oculta do cliente', exibirAoCliente: false, travaAtividade: false, impactoDias: 1, abertoEm: '2026-11-02', atividadeNumero: null }),
      imp({ id: 'mat', descricao: 'Porcelanato entregue com atraso', responsavel: 'manfac', tipo: 'Material Manfac', travaAtividade: false, impactoDias: 2, abertoEm: '2026-10-28', encerradoEm: '2026-10-30', atividadeNumero: 40 }),
    ],
  })
  og.obra = { ...og.obra, data_base: '2026-10-26' }
  const atividades = [
    ativ(30, { etapa: 'Demolição', descricao: 'Demolição do piso', status: 'concluido', percentual: 1, inicioReal: '2026-10-26', fimReal: '2026-10-29', fimPrevisto: '2026-10-30', situacao: 'concluida' }),
    ativ(77, { etapa: 'Alvenaria', descricao: 'Alvenaria do depósito', status: 'em_andamento', percentual: 0.4, fimPrevisto: '2026-11-13', situacao: 'atrasada' }),
    ativ(40, { etapa: 'Alvenaria', descricao: 'Reboco', fimPrevisto: '2026-11-20' }),
  ]
  og.calc = { atividades, previsto: 0.6, realizado: 0.45, desvioPP: -15, terminoPrevisto: '2026-11-20', terminoProjetado: '2026-11-27' }
  og.calcBase = { ...og.calc, atividades: atividades.map((a) => ({ ...a, fimPrevisto: a.numero === 40 ? '2026-11-20' : a.fimPrevisto })) }
  og.etapas = resumirEtapas(atividades, og.feriados)
  og.plano = atividades.map(({ numero, etapa, descricao, pred1, pred2, duracao, bloqueiaPorTrava, pesoValor }) => ({ numero, etapa, descricao, pred1, pred2, duracao, bloqueiaPorTrava, pesoValor }))
  og.terminoBase = '2026-11-20'
  og.sinal = 'vermelho'
  // 5 dias úteis de atraso. Cliente: 2 visíveis + 1 oculto (vira "outros fatores"); o resto é da Manfac.
  og.atraso = { total: 5, cliente: 2, manfac: 3, terceiro: 0, clima: 0 }
  og.hist = [{ numero: 30, dataStatus: '2026-10-29', percentual: 1 }, { numero: 77, dataStatus: '2026-11-04', percentual: 0.4 }]
  og.dadosAte = '2026-11-04'
  return Object.assign(og, over)
}

const restricoes: Restricao[] = [
  { id: 'r1', obraId: 'o1', atividadeNumero: 77, tipo: 'decisao_cliente', descricao: 'Aprovar o layout do balcão', responsavel: 'cliente', prazo: '2026-11-03', situacao: 'identificada', liberadaEm: null, criadoPor: 'eng@manfac.com.br', criadoEm: '2026-10-28T12:00:00Z' },
  { id: 'r2', obraId: 'o1', atividadeNumero: 77, tipo: 'material', descricao: 'Comprar o perfil (fornecedor interno)', responsavel: 'manfac', prazo: null, situacao: 'identificada', liberadaEm: null, criadoPor: null, criadoEm: '2026-10-28T12:00:00Z' },
  { id: 'r3', obraId: 'o1', atividadeNumero: 40, tipo: 'acesso', descricao: 'Liberar a área do caixa', responsavel: 'cliente', prazo: null, situacao: 'liberada', liberadaEm: '2026-11-01', criadoPor: null, criadoEm: '2026-10-28T12:00:00Z' },
]

const planos: PlanoSemana[] = [
  {
    id: 'p1', obraId: 'o1', semanaInicio: '2026-10-26', fechadoEm: 'x', fechadoPor: null,
    itens: [true, true, false, null].map((c, i) => ({ id: `i${i}`, planoId: 'p1', numero: 30 + i, metaPercentual: 1, percentualFinal: 1, cumprido: c, causa: null, avaliadoEm: 'x' })),
  },
]

const HOJE = '2026-11-05'

/** Todas as chaves de um objeto (recursivo). */
const chaves = (v: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => chaves(x, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); chaves(x, out) }
  return out
}

describe('montarVisaoCliente', () => {
  const v = montarVisaoCliente({ obra: obra(), planos, restricoes, hoje: HOJE })
  const json = JSON.stringify(v)

  it('nunca leva R$/peso, valor da obra, numero interno nem e-mail interno', () => {
    expect(json).not.toMatch(/98765|123456|R\$/)
    expect(json).not.toContain('eng@manfac.com.br')
    for (const k of ['numero', 'numeros', 'peso', 'pesoValor', 'id', 'referencia', 'atividadeNumero']) expect(chaves(v).has(k)).toBe(false)
    // O alerta interno do motor ("antes da atividade 30") não vai à tela.
    expect(json).not.toContain('atividade 30')
  })

  it('impedimento oculto e área interna da Manfac não aparecem; restrição da Manfac e liberada também não', () => {
    expect(json).not.toContain('Pedreiro faltou')
    expect(json).not.toContain('Pendência oculta')
    expect(json).not.toContain('Comprar o perfil')
    expect(json).not.toContain('Liberar a área do caixa')
  })

  it('Aguardando vocês: impedimento do cliente aberto + decisão do cliente, com código exibido, desde e prazo', () => {
    expect(v.aguardando).toEqual([
      expect.objectContaining({ tipo: 'impedimento', titulo: 'Liberação do estoque', desde: '02/11/2026', diasUteis: 3, prazo: null }),
      expect.objectContaining({ tipo: 'decisao', titulo: 'Aprovar o layout do balcão', desde: '28/10/2026', prazo: '03/11/2026', vencida: true }),
    ])
    expect(v.aguardando[0].detalhe).toBe('Área não liberada · atividade 2.1 — Alvenaria do depósito')
    expect(v.aguardando[1].detalhe).toContain('atividade 2.1')
    expect(v.aguardando.map((i) => i.titulo)).not.toContain('Chave da loja entregue') // encerrado não aguarda nada
  })

  it('atraso por responsável no lado cliente: oculto que não é da Manfac vira "outros fatores"', () => {
    const a = v.cronograma!.atraso!
    expect(a).toMatchObject({ de: '20/11/2026', para: '27/11/2026', total: 5 })
    const por = Object.fromEntries(a.causas.map((k) => [k.chave, k.dias]))
    expect(por).toEqual({ manfac: 2, cliente: 2, outros: 1 })
    expect(a.causas.find((k) => k.chave === 'cliente')!.motivos).toEqual(['Liberação do estoque (desde 02/11)', 'Chave da loja entregue (27/10 a 29/10)'])
    expect(a.causas.find((k) => k.chave === 'manfac')!.motivos).toEqual(['Porcelanato entregue com atraso (28/10 a 30/10)'])
    expect(v.cronograma!.sinal).toMatchObject({ tom: 'vermelho', titulo: 'Atrasada', resumo: 'Entrega prevista 5 dias úteis depois da base' })
  })

  it('KPIs, PPC da última semana avaliada e etapas com código', () => {
    const c = v.cronograma!
    expect(c).toMatchObject({ previsto: '60%', realizado: '45%', entrega: '27/11', base: '20/11/2026', tomDesvio: 'atraso' })
    expect(c.ppc).toEqual({ valor: '2 de 3', semana: '26/10', naoCumpridos: 1 })
    expect(c.etapas.map((e) => [e.ordem, e.nome, e.atividades.map((a) => a.codigo)])).toEqual([
      [1, 'Demolição', ['1.1']],
      [2, 'Alvenaria', ['2.1', '2.2']],
    ])
    expect(c.etapas[1].atividades[0]).toMatchObject({ situacao: 'Atrasada', tom: 'atraso', realizado: '40%' })
  })

  it('destaques só com texto (o id do highlight nunca vai à tela)', () => {
    expect(v.highlights.length).toBeGreaterThan(0)
    expect(json).not.toMatch(/etapa-antecipada:|atividade-antecipada:|impedimento-resolvido:|ppc:2026/)
  })

  it('cronograma só em rascunho (sem versão salva) não aparece', () => {
    const r = montarVisaoCliente({ obra: obra({ versaoVigente: null, versaoBase: null }), planos, restricoes, hoje: HOJE })
    expect(r.cronograma).toBeNull()
    expect(r.highlights).toEqual([])
    expect(r.aguardando).toHaveLength(2)
  })

  it('situação para o cliente: espaço reservado (Task 6), por enquanto nulo', () => {
    expect(v.situacao).toBeNull()
  })
})
