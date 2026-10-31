/**
 * Relatórios de período (Leva 4 §2.1) e highlights (§2.3): lado cliente sem
 * R$, sem oculto, sem área interna, só código exibido; marcos base × real;
 * PPC médio; comparativo da entrega; conteúdo congelado validado por esquema.
 */
import { diasUteisEntre } from '../calendario'
import { resumirEtapas, type AtividadeCalculada } from '../cronograma'
import type { PlanoSemana, Restricao } from '../last-planner'
import type { ObraGrande } from '../leitura'
import { conteudoPeriodoValido, etapasDaObra, montarConteudoPeriodo } from '../relatorio-periodo'
import { highlightsDoPeriodo } from '../highlights'
import { agendaDaObra } from '../agenda'
import { imp, obraGrandePdf } from '../../_pdf/__tests__/fixtures/rdo'

const ativ = (numero: number, over: Partial<AtividadeCalculada> = {}): AtividadeCalculada => {
  const a = {
    numero, etapa: 'E', descricao: `Atividade ${numero}`, pred1: null, pred2: null, duracao: 5, bloqueiaPorTrava: false,
    pesoValor: 98765, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
    inicioPrevisto: '2026-10-26', fimPrevisto: '2026-10-30', inicioProjetado: '2026-10-26', fimProjetado: '2026-11-20',
    peso: 0.25, percentualPrevisto: 0, situacao: 'no_prazo', travada: false, inicioFixo: null, diasRestantes: null,
    alertaInicioFixo: null, inicioFixoAjustado: false, ...over,
  } as AtividadeCalculada
  // Duração coerente com as datas previstas (a curva planejada não passa de 100%).
  return { ...a, duracao: diasUteisEntre(a.inicioPrevisto, a.fimPrevisto, new Set()) }
}

const plano = (segunda: string, cumpridos: (boolean | null)[]): PlanoSemana => ({
  id: segunda, obraId: 'o1', semanaInicio: segunda, fechadoEm: 'x', fechadoPor: null,
  itens: cumpridos.map((c, i) => ({ id: `${segunda}${i}`, planoId: segunda, numero: i + 1, metaPercentual: 1, percentualFinal: 1, cumprido: c, causa: null, avaliadoEm: 'x' })),
})

const restricoes: Restricao[] = [
  { id: 'r1', obraId: 'o1', atividadeNumero: 30, tipo: 'decisao_cliente', descricao: 'Aprovar o layout', responsavel: 'cliente', prazo: '2026-11-10', situacao: 'identificada', liberadaEm: null, criadoPor: null, criadoEm: 'x' },
  { id: 'r2', obraId: 'o1', atividadeNumero: 30, tipo: 'material', descricao: 'Comprar o perfil', responsavel: 'manfac', prazo: null, situacao: 'identificada', liberadaEm: null, criadoPor: null, criadoEm: 'x' },
]

/** Duas etapas: A (numeros 10, 20) concluída em 06/11, base 11/11; B (30, 40) em andamento. */
function obra(): ObraGrande {
  const og = obraGrandePdf({
    impedimentos: [
      imp({ id: 'cli', descricao: 'Liberação do estoque', abertoEm: '2026-10-27', encerradoEm: '2026-11-04', atividadeNumero: 30 }),
      imp({ id: 'oc', descricao: 'Pedreiro faltou sem avisar', responsavel: 'manfac', tipo: 'Equipe', exibirAoCliente: false, abertoEm: '2026-11-03', encerradoEm: '2026-11-04', atividadeNumero: null }),
      imp({ id: 'ocCli', descricao: 'Pendência oculta do cliente', exibirAoCliente: false, abertoEm: '2026-11-02', encerradoEm: '2026-11-05', atividadeNumero: null }),
    ],
  })
  og.obra = { ...og.obra, data_base: '2026-10-26' }
  const atividades = [
    ativ(10, { etapa: 'Demolição', descricao: 'Demolição do piso', status: 'concluido', percentual: 1, inicioReal: '2026-10-26', fimReal: '2026-11-03', fimPrevisto: '2026-11-04' }),
    ativ(20, { etapa: 'Demolição', descricao: 'Retirada de entulho', status: 'concluido', percentual: 1, inicioReal: '2026-10-28', fimReal: '2026-11-06', fimPrevisto: '2026-11-06' }),
    ativ(30, { etapa: 'Alvenaria', descricao: 'Alvenaria do depósito', status: 'em_andamento', percentual: 0.5, fimPrevisto: '2026-11-20' }),
    ativ(40, { etapa: 'Alvenaria', descricao: 'Reboco', fimPrevisto: '2026-11-27' }),
  ]
  og.calc = { ...og.calc!, atividades, previsto: 0.6, realizado: 0.62, terminoProjetado: '2026-11-27' }
  og.calcBase = {
    ...og.calc,
    atividades: [ativ(10, { fimPrevisto: '2026-11-05' }), ativ(20, { fimPrevisto: '2026-11-11' }), ativ(30, { fimPrevisto: '2026-11-20' }), ativ(40, { fimPrevisto: '2026-11-27' })],
  }
  og.etapas = resumirEtapas(atividades, og.feriados)
  og.plano = atividades.map(({ numero, etapa, descricao, pred1, pred2, duracao, bloqueiaPorTrava, pesoValor }) => ({ numero, etapa, descricao, pred1, pred2, duracao, bloqueiaPorTrava, pesoValor }))
  og.hist = [
    { numero: 10, dataStatus: '2026-10-30', percentual: 0.2 },
    { numero: 10, dataStatus: '2026-11-03', percentual: 1 },
    { numero: 20, dataStatus: '2026-11-06', percentual: 1 },
    { numero: 30, dataStatus: '2026-11-06', percentual: 0.5 },
  ]
  return og
}

/** A mesma obra com uma etapa nova (atividade 50) inserida antes da Demolição. */
function comEtapaAntes(): ObraGrande {
  const og = obra()
  const nova = ativ(50, { etapa: 'Proteção', descricao: 'Proteção do piso', peso: 0, fimPrevisto: '2026-10-27' })
  const atividades = [nova, ...og.calc!.atividades]
  og.calc = { ...og.calc!, atividades }
  og.etapas = resumirEtapas(atividades, og.feriados)
  return og
}

const planos = [
  plano('2026-10-26', [true, true, true, true, false]),
  plano('2026-11-02', [true, false]),
  plano('2026-11-09', [null]),
  plano('2026-11-16', [true]),
]

function conteudo(lado: 'cliente' | 'interno', over: Partial<Parameters<typeof montarConteudoPeriodo>[0]> = {}) {
  return montarConteudoPeriodo({
    lado, tipo: 'mensal', referencia: '2026-11', obra: obra(), inicio: '2026-11-01', fim: '2026-11-30', ref: '2026-11-10', hoje: '2026-11-10',
    planos, restricoes, highlights: ['Etapa 1 — Demolição concluída antes', '  ', 'Livre do engenheiro'], observacoes: ' Seguimos. ',
    ...over,
  })
}

describe('etapasDaObra', () => {
  it('conclusão, fim previsto, fim da base e início/fim reais', () => {
    expect(etapasDaObra(obra())).toEqual([
      { referencia: '10', ordem: 1, nome: 'Demolição', numeros: [10, 20], fimPrevisto: '2026-11-06', fimBase: '2026-11-11', concluida: true, inicioReal: '2026-10-26', fimReal: '2026-11-06' },
      { referencia: '30', ordem: 2, nome: 'Alvenaria', numeros: [30, 40], fimPrevisto: '2026-11-27', fimBase: '2026-11-27', concluida: false, inicioReal: null, fimReal: null },
    ])
  })
})

describe('fase: identidade pelo menor numero da etapa', () => {
  it('etapa inserida antes: a referência da fase não muda e o envio feito continua casando com ela', () => {
    const e = etapasDaObra(comEtapaAntes())
    expect(e.map((x) => [x.referencia, x.ordem, x.nome])).toEqual([['50', 1, 'Proteção'], ['10', 2, 'Demolição'], ['30', 3, 'Alvenaria']])
    const a = agendaDaObra({
      dataBase: '2026-10-26', terminoProjetado: '2026-11-27', obraConcluida: false, etapas: e, feriados: new Set(), hojeIso: '2026-11-10',
      envios: [{ tipo: 'fase', referencia: '10', enviadoEm: '2026-11-06T15:00:00Z' }],
    })
    const fases = a.filter((i) => i.tipo === 'fase')
    expect(fases.find((i) => i.referencia === '10')).toMatchObject({ dataReal: '2026-11-06', situacao: 'no_prazo' })
    expect(fases.find((i) => i.referencia === '50')).toMatchObject({ dataReal: null })
    expect(fases).toHaveLength(3)
    // O rótulo mostra a posição atual.
    expect(montarConteudoPeriodo({
      lado: 'cliente', tipo: 'fase', referencia: '10', obra: comEtapaAntes(), inicio: '2026-10-26', fim: '2026-11-06', ref: '2026-11-06', hoje: '2026-11-10',
      planos: [], restricoes: [], highlights: [], observacoes: null,
    }).titulo).toBe('DP Macaé 3 — etapa 2 — Demolição')
  })
})

describe('montarConteudoPeriodo', () => {
  it('mensal: títulos, marcos base × real, PPC médio das semanas avaliadas, highlights e observações', () => {
    const c = conteudo('cliente')
    expect(c.assunto).toBe('Relatório mensal · DP Macaé 3 · novembro de 2026')
    expect(c.subtitulo).toBe('Período de 01/11/2026 a 30/11/2026 · dados até 10/11/2026')
    expect(c.avanco).toEqual({ previsto: '60%', realizado: '62%', desvio: '2 p.p. acima do previsto', ate: '10/11/2026' })
    expect(c.marcos).toEqual([{ etapa: '1 — Demolição', base: '11/11/2026', real: '06/11/2026', desvio: '3 dias úteis antes da base' }])
    expect(c.concluidas.map((x) => x.descricao)).toEqual(['Demolição do piso', 'Retirada de entulho'])
    // Semana conta pelo dia de envio do semanal: 26/10 (sexta 30/10) é de outubro; 02/11 (50%) e 16/11 (100%)
    // contam; a de 09/11 sem avaliação fica fora.
    expect(c.ppc).toEqual({ valor: '75%', semanas: 2 })
    // Nenhuma semana conta em dois meses: a de 26/10 entra só em outubro.
    expect(conteudo('cliente', { referencia: '2026-10', inicio: '2026-10-26', fim: '2026-10-30', ref: '2026-10-30' }).ppc).toEqual({ valor: '80%', semanas: 1 })
    expect(c.highlights).toEqual(['Etapa 1 — Demolição concluída antes', 'Livre do engenheiro'])
    expect(c.observacoes).toBe('Seguimos.')
    expect(c.comparativo).toBeNull()
  })

  it('cliente: sem R$, sem oculto, sem restrição da Manfac, só código exibido', () => {
    const c = conteudo('cliente')
    const s = JSON.stringify(c)
    expect(s).not.toMatch(/R\$|98765|98\.765|123456/)
    expect(s).not.toContain('Pedreiro faltou')
    expect(s).not.toContain('Pendência oculta do cliente')
    expect(s).not.toContain('Comprar o perfil')
    expect(s).not.toMatch(/atividade 30|Atividade 30/)
    expect(c.doCliente[0].atividade).toBe('2.1 — Alvenaria do depósito')
    expect(c.impedimentos.map((i) => i.corpo)).toEqual(['Liberação do estoque — Área não liberada · atividade 2.1 (Alvenaria do depósito)'])
    expect(c.ocultos).toEqual([])
  })

  it('interno: mostra os ocultos do período', () => {
    const c = conteudo('interno')
    expect(c.ocultos.map((o) => o.corpo).join()).toContain('Pedreiro faltou')
    expect(c.assunto).toMatch(/· interno$/)
  })

  it('curva S da data-base até a referência, sem NaN; base e realizado presentes', () => {
    const c = conteudo('cliente')
    expect(c.curva.map((p) => p.data)).toEqual(['2026-10-30', '2026-11-06', '2026-11-10'])
    for (const p of c.curva) {
      expect(Number.isFinite(p.previsto)).toBe(true)
      expect(p.base === null || Number.isFinite(p.base)).toBe(true)
    }
    expect(c.curva[1].realizado).toBeCloseTo(0.25 + 0.25 + 0.125)
    const semCalc = montarConteudoPeriodo({ ...{ lado: 'cliente', tipo: 'mensal', referencia: '2026-11', inicio: '2026-11-01', fim: '2026-11-30', ref: '2026-11-10', hoje: '2026-11-10', planos: [], restricoes: [], highlights: [], observacoes: null }, obra: { ...obra(), calc: null, etapas: [] } })
    expect(semCalc.curva).toEqual([])
    expect(semCalc.ppc).toBeNull()
    expect(semCalc.marcos).toEqual([])
  })

  it('fase: título com a etapa; entrega: comparativo base × final com a quebra por responsável', () => {
    expect(conteudo('cliente', { tipo: 'fase', referencia: '10', inicio: '2026-10-26', fim: '2026-11-06', ref: '2026-11-06' }).titulo).toBe('DP Macaé 3 — etapa 1 — Demolição')
    const og = obra()
    og.atraso = { total: 3, cliente: 2, manfac: 1, terceiro: 0, clima: 0 }
    og.terminoBase = '2026-11-24'
    const e = montarConteudoPeriodo({
      lado: 'cliente', tipo: 'entrega', referencia: 'entrega', obra: og, inicio: '2026-10-26', fim: '2026-11-27', ref: '2026-11-27', hoje: '2026-11-30',
      planos: [], restricoes: [], highlights: [], observacoes: null,
    })
    // Ao cliente, a quebra sai dos impedimentos visíveis (o do cliente cobre os 3 dias).
    expect(e.comparativo).toEqual({ base: '24/11/2026', final: '27/11/2026', atraso: '+3 dias: 3 do cliente' })
    expect(conteudo('cliente').comparativo).toBeNull()
  })
})

describe('conteudoPeriodoValido (entrada não confiável)', () => {
  it('aceita o montado, ida e volta por JSON', () => {
    for (const lado of ['cliente', 'interno'] as const) {
      expect(conteudoPeriodoValido(JSON.parse(JSON.stringify(conteudo(lado))), lado, { tipo: 'mensal', referencia: '2026-11' })).toBe(true)
    }
  })

  it('recusa lado/tipo/referência trocados, sinal estranho, curva com NaN, oculto no cliente e comparativo fora da entrega', () => {
    const c = conteudo('cliente')
    expect(conteudoPeriodoValido(c, 'interno')).toBe(false)
    expect(conteudoPeriodoValido(c, 'cliente', { tipo: 'fase', referencia: '2026-11' })).toBe(false)
    expect(conteudoPeriodoValido(c, 'cliente', { tipo: 'mensal', referencia: '2026-12' })).toBe(false)
    expect(conteudoPeriodoValido({ ...c, referencia: '2026-11<x>' }, 'cliente')).toBe(false)
    expect(conteudoPeriodoValido({ ...c, tipo: 'semanal' }, 'cliente')).toBe(false)
    expect(conteudoPeriodoValido({ ...c, sinal: { ...c.sinal, fundo: 'red;x' } }, 'cliente')).toBe(false)
    expect(conteudoPeriodoValido({ ...c, curva: [{ data: '2026-11-06', base: null, previsto: NaN, realizado: null }] }, 'cliente')).toBe(false)
    expect(conteudoPeriodoValido({ ...c, ocultos: [{ rotulo: 'a', corpo: 'b' }] }, 'cliente')).toBe(false)
    expect(conteudoPeriodoValido({ ...c, highlights: [1] }, 'cliente')).toBe(false)
    expect(conteudoPeriodoValido({ ...c, comparativo: { base: null, final: 'x', atraso: 'y' } }, 'cliente')).toBe(false)
    expect(conteudoPeriodoValido({ ...c, tipo: 'entrega', referencia: 'entrega' }, 'cliente')).toBe(false) // entrega sem comparativo
    expect(conteudoPeriodoValido(null, 'cliente')).toBe(false)
  })
})

describe('highlightsDoPeriodo', () => {
  const hl = (over: Partial<Parameters<typeof highlightsDoPeriodo>[0]> = {}) =>
    highlightsDoPeriodo({ obra: obra(), inicio: '2026-11-01', fim: '2026-11-30', ref: '2026-11-10', planos, ...over })

  it('etapa antes da base, atividade antes do previsto, PPC ≥ 80%, impedimento do cliente resolvido', () => {
    const h = hl()
    expect(h.map((x) => x.id)).toEqual([
      'etapa-antecipada:10',
      'atividade-antecipada:10',
      'atividade-antecipada:20',
      'ppc:2026-11-16',
      'impedimento-resolvido:cli',
      'desvio-recuperado',
    ])
    expect(h[0].texto).toBe('Etapa 1 — Demolição concluída em 06/11/2026, 3 dias úteis antes do previsto na base')
    expect(h[1].texto).toBe('1.1 — Demolição do piso concluída em 03/11/2026, antes do previsto (05/11/2026)')
    expect(h[2].texto).toBe('1.2 — Retirada de entulho concluída em 06/11/2026, antes do previsto (11/11/2026)')
    expect(h[3].texto).toBe('Semana de 16/11: 100% do plano cumprido (PPC)')
    expect(h[4].texto).toBe('Resolvido em 04/11/2026: Liberação do estoque')
  })

  it('só lado cliente: sem oculto, sem R$, sem numero no texto', () => {
    const s = hl().map((x) => x.texto).join(' | ')
    expect(s).not.toContain('Pendência oculta do cliente')
    expect(s).not.toMatch(/R\$|98765/)
    // Cada texto de atividade começa pelo código exibido, nunca pelo numero.
    expect(hl().filter((x) => x.id.startsWith('atividade')).map((x) => x.texto.split(' — ')[0])).toEqual(['1.1', '1.2'])
  })

  it('ids estáveis: etapa inserida antes muda o código no texto, não o id', () => {
    const antes = hl()
    const depois = highlightsDoPeriodo({ obra: comEtapaAntes(), inicio: '2026-11-01', fim: '2026-11-30', ref: '2026-11-10', planos })
    const ids = (h: typeof antes) => h.map((x) => x.id).filter((id) => id !== 'desvio-recuperado')
    expect(ids(depois)).toEqual(ids(antes))
    expect(depois.find((x) => x.id === 'atividade-antecipada:10')!.texto).toMatch(/^2\.1 — Demolição do piso/)
    expect(depois.find((x) => x.id === 'etapa-antecipada:10')!.texto).toMatch(/^Etapa 2 — Demolição/)
  })

  it('desvio recuperado (≥ 2 p.p.) entra; abaixo disso, não', () => {
    // 01/11 → 10/11: a conclusão da Demolição tira a obra de 34,4 para 14,5 p.p. abaixo.
    const d = hl().find((x) => x.id === 'desvio-recuperado')
    expect(d?.texto).toBe('Desvio recuperado em 19,9 p.p. no período: de 34,4 p.p. abaixo do previsto para 14,5 p.p. abaixo do previsto')
    // 26/10 → 06/11: o desvio piora.
    expect(hl({ inicio: '2026-10-26', fim: '2026-11-06', ref: '2026-11-06' }).some((x) => x.id === 'desvio-recuperado')).toBe(false)
    expect(hl({ inicio: '2026-11-09', fim: '2026-11-10', ref: '2026-11-10' }).some((x) => x.id === 'desvio-recuperado')).toBe(false)
  })

  it('período sem nada: lista vazia', () => {
    expect(highlightsDoPeriodo({ obra: { ...obra(), calc: null, etapas: [], impedimentos: [] }, inicio: '2026-12-01', fim: '2026-12-31', ref: '2026-12-31', planos: [] })).toEqual([])
  })
})
