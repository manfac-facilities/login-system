import {
  contarTravas, dinheiroDaCarteira, estadoDaObra, etapasDaCarteira, excecoesDoDia, ficaNaCarteira,
  filtrarCarteira, grupoDe, ordenarCarteira, resumoCarteira, semanaDe, sinaisDoCliente, travaPrincipal,
  travasDaObra, ultimoAvanco,
  type DinheiroCarteira, type ObraCarteira, type SinalCliente, type Trava,
} from '../carteira'
import type { AtividadeCalculada, ResultadoCronograma } from '../cronograma'
import type { PontoHist } from '../curvas'
import type { PlanoSemana, Restricao } from '../last-planner'
import type { ImpedimentoRow } from '../leitura'
import type { ItemAgenda } from '../agenda'
import type { LeituraFinanceiro } from '../financeiro-ler'

// 2026-11-04 é quarta. Sem feriados nos testes.
const hoje = '2026-11-04'
const F: ReadonlySet<string> = new Set()

const ativ = (o: Partial<AtividadeCalculada>): AtividadeCalculada =>
  ({ numero: 1, etapa: 'E1', situacao: 'no_prazo', status: 'em_andamento', travada: false, percentual: 0, percentualPrevisto: 0, peso: 1, ...o }) as AtividadeCalculada
const calcDe = (atividades: AtividadeCalculada[]): ResultadoCronograma =>
  ({ atividades, previsto: 0, realizado: 0, desvioPP: 0, terminoPrevisto: hoje, terminoProjetado: hoje })
const restr = (o: Partial<Restricao>): Restricao =>
  ({ id: 'r', obraId: 'o', atividadeNumero: 1, tipo: 'projeto', descricao: 'R', responsavel: 'cliente', prazo: null,
    situacao: 'identificada', liberadaEm: null, criadoPor: null, criadoEm: '2026-10-20T12:00:00Z', ...o }) as Restricao
const imp = (o: Partial<ImpedimentoRow>): ImpedimentoRow =>
  ({ id: 'i', obraId: 'o', categoria: 'impedimento', tipo: 'acesso', responsavel: 'terceiro', descricao: 'I',
    abertoEm: '2026-10-25', encerradoEm: null, ...o }) as ImpedimentoRow
const trava = (o: Partial<Trava>): Trava =>
  ({ origem: 'restricao', descricao: 'T', tipo: 'projeto', quem: 'cliente', desde: '2026-10-20', prazo: null, vencida: false, ...o })

const dinheiroOk = (o: Partial<Extract<DinheiroCarteira, { ok: true }>> = {}): DinheiroCarteira =>
  ({ ok: true, valor: 1000, faturado: 400, aFaturar: 600, acimaDoValor: false, notas: 1, custoRealizado: 100, custoComprometido: 50, margemPct: 10, ...o })
const obra = (o: Partial<ObraCarteira>): ObraCarteira => ({
  id: 'x', os: null, loja: 'L', engenheiro: null, sinal: 'verde', estado: { tipo: 'andando', comAtraso: false },
  realizado: null, previsto: null, terminoBase: null, terminoProjetado: null, desvioDiasUteis: null,
  travas: [], travaPrincipal: null, sinais: [], etapas: [], semana: null, diarios: [], dinheiro: dinheiroOk(), ...o,
})

describe('ultimoAvanco', () => {
  it('maior data em que algum % subiu; linha só de dias restantes não conta', () => {
    const hist: PontoHist[] = [
      { numero: 1, dataStatus: '2026-10-20', percentual: 0.1 },
      { numero: 1, dataStatus: '2026-10-25', percentual: 0.3 },
      { numero: 1, dataStatus: '2026-10-30', percentual: 0.3, diasRestantes: 4 },
      { numero: 2, dataStatus: '2026-10-28', percentual: 0 },
    ]
    expect(ultimoAvanco(hist)).toBe('2026-10-25')
  })
  it('a primeira linha só conta se > 0; vazio → null', () => {
    expect(ultimoAvanco([{ numero: 1, dataStatus: '2026-10-20', percentual: 0 }])).toBeNull()
    expect(ultimoAvanco([])).toBeNull()
  })
  it('respeita a ordem de dataStatus mesmo fora de ordem na entrada', () => {
    expect(ultimoAvanco([
      { numero: 1, dataStatus: '2026-10-30', percentual: 0.5 },
      { numero: 1, dataStatus: '2026-10-20', percentual: 0.5 },
    ])).toBe('2026-10-20')
  })
})

describe('estadoDaObra', () => {
  const base = { sinal: 'verde' as const, hist: [] as PontoHist[], impedimentosAbertos: 0, dataBase: '2026-09-01', hoje, feriados: F }
  const recente: PontoHist[] = [{ numero: 1, dataStatus: '2026-11-03', percentual: 0.2 }]
  it('calc null → sem_cronograma mesmo com hist', () => {
    expect(estadoDaObra({ ...base, calc: null, hist: recente })).toEqual({ tipo: 'sem_cronograma' })
  })
  it('todas concluídas → faturando', () => {
    expect(estadoDaObra({ ...base, calc: calcDe([ativ({ situacao: 'concluida' })]) })).toEqual({ tipo: 'faturando' })
  })
  it('parada conta dias úteis decorridos: avanço segunda, hoje quarta (2) não; quinta (3) sim', () => {
    const calc = calcDe([ativ({})])
    const seg: PontoHist[] = [{ numero: 1, dataStatus: '2026-11-02', percentual: 0.2 }]
    expect(estadoDaObra({ ...base, calc, hist: seg, hoje: '2026-11-04' })).toEqual({ tipo: 'andando', comAtraso: false })
    expect(estadoDaObra({ ...base, calc, hist: seg, hoje: '2026-11-05' })).toEqual({ tipo: 'parada', diasUteis: 3 })
    expect(estadoDaObra({ ...base, calc, hist: [{ numero: 1, dataStatus: '2026-10-29', percentual: 0.2 }] }))
      .toEqual({ tipo: 'parada', diasUteis: 4 })
  })
  it('sem hist, conta da data base', () => {
    expect(estadoDaObra({ ...base, calc: calcDe([ativ({})]), dataBase: '2026-10-29' })).toEqual({ tipo: 'parada', diasUteis: 4 })
  })
  it('com avanço recente e impedimento aberto → frente_parada', () => {
    expect(estadoDaObra({ ...base, calc: calcDe([ativ({})]), hist: recente, impedimentosAbertos: 1 })).toEqual({ tipo: 'frente_parada' })
  })
  it('data base há menos de 10 d.u. → comecou', () => {
    expect(estadoDaObra({ ...base, calc: calcDe([ativ({})]), hist: recente, dataBase: '2026-10-26' }))
      .toEqual({ tipo: 'comecou', em: '2026-10-26' })
  })
  it('senão andando, com atraso quando o sinal não é verde', () => {
    const calc = calcDe([ativ({})])
    expect(estadoDaObra({ ...base, calc, hist: recente })).toEqual({ tipo: 'andando', comAtraso: false })
    expect(estadoDaObra({ ...base, calc, hist: recente, sinal: 'amarelo' })).toEqual({ tipo: 'andando', comAtraso: true })
  })
})

describe('travasDaObra', () => {
  it('restrições não liberadas e impedimentos abertos; orientação e encerrados fora', () => {
    const t = travasDaObra(
      [restr({ id: 'a', prazo: '2026-11-01', responsavel: 'terceiro' }), restr({ id: 'b', situacao: 'liberada' }), restr({ id: 'c', prazo: '2026-11-10' })],
      [imp({ responsavel: 'clima' }), imp({ categoria: 'orientacao' }), imp({ encerradoEm: '2026-10-30' })],
      hoje,
    )
    expect(t).toHaveLength(3)
    expect(t[0]).toMatchObject({ origem: 'restricao', quem: 'terceiros', prazo: '2026-11-01', vencida: true, desde: '2026-10-20' })
    expect(t[1]).toMatchObject({ origem: 'restricao', quem: 'cliente', vencida: false })
    expect(t[2]).toMatchObject({ origem: 'impedimento', quem: 'terceiros', desde: '2026-10-25', prazo: null, vencida: false })
  })
})

describe('travaPrincipal', () => {
  const venc1 = trava({ descricao: 'v1', prazo: '2026-10-30', vencida: true })
  const venc2 = trava({ descricao: 'v2', prazo: '2026-10-25', vencida: true })
  const impA = trava({ descricao: 'i1', origem: 'impedimento', desde: '2026-10-28' })
  const impB = trava({ descricao: 'i2', origem: 'impedimento', desde: '2026-10-21' })
  const semPrazo = trava({ descricao: 'r0' })
  const prazoLonge = trava({ descricao: 'r2', prazo: '2026-12-01' })
  const prazoPerto = trava({ descricao: 'r1', prazo: '2026-11-10' })
  it('restrição vencida de menor prazo primeiro', () => {
    expect(travaPrincipal([impB, venc1, venc2])?.descricao).toBe('v2')
  })
  it('senão impedimento mais antigo', () => {
    expect(travaPrincipal([prazoPerto, impA, impB])?.descricao).toBe('i2')
  })
  it('senão restrição de prazo mais próximo, sem prazo por último', () => {
    expect(travaPrincipal([semPrazo, prazoLonge, prazoPerto])?.descricao).toBe('r1')
    expect(travaPrincipal([semPrazo])?.descricao).toBe('r0')
  })
  it('vazio → null', () => expect(travaPrincipal([])).toBeNull())
})

describe('etapasDaCarteira', () => {
  it('null → []', () => expect(etapasDaCarteira(null)).toEqual([]))
  it('agrupa na ordem, média ponderada e a pior situação', () => {
    const e = etapasDaCarteira(calcDe([
      ativ({ etapa: 'B', percentual: 1, percentualPrevisto: 1, peso: 3, situacao: 'concluida' }),
      ativ({ etapa: 'A', percentual: 0, percentualPrevisto: 0, peso: 0, status: 'nao_iniciado' }),
      ativ({ etapa: 'B', percentual: 0, percentualPrevisto: 0.5, peso: 1, situacao: 'atrasada' }),
      ativ({ etapa: 'A', percentual: 0.5, percentualPrevisto: 1, peso: 0, situacao: 'aguardando_cliente' }),
    ]))
    expect(e.map((x) => x.nome)).toEqual(['B', 'A'])
    expect(e[0]).toEqual({ nome: 'B', realizado: 0.75, previsto: 0.875, situacao: 'atrasada' })
    expect(e[1]).toEqual({ nome: 'A', realizado: 0.25, previsto: 0.5, situacao: 'aguardando_cliente' })
  })
  it('concluída só se todas concluídas; travada vem de travada/bloqueada', () => {
    const e = etapasDaCarteira(calcDe([
      ativ({ etapa: 'C', situacao: 'concluida' }), ativ({ etapa: 'C', situacao: 'concluida' }),
      ativ({ etapa: 'D', situacao: 'no_prazo', status: 'em_andamento' }), ativ({ etapa: 'D', situacao: 'no_prazo', travada: true }),
      ativ({ etapa: 'D', situacao: 'inicio_atrasado' }),
    ]))
    expect(e[0].situacao).toBe('concluida')
    expect(e[1].situacao).toBe('travada')
  })
})

describe('semanaDe', () => {
  const item = (cumprido: boolean | null, causa: string | null = null) => ({ cumprido, causa }) as PlanoSemana['itens'][number]
  const plano = (semanaInicio: string, itens: PlanoSemana['itens']): PlanoSemana =>
    ({ id: semanaInicio, obraId: 'o', semanaInicio, fechadoEm: null, fechadoPor: null, itens })
  it('sem plano até hoje → null', () => {
    expect(semanaDe([], hoje)).toBeNull()
    expect(semanaDe([plano('2026-11-09', [item(true)])], hoje)).toBeNull()
  })
  it('plano mais recente com semanaInicio <= hoje; ppc e causas em texto', () => {
    const s = semanaDe([
      plano('2026-10-26', [item(true)]),
      plano('2026-11-02', [item(true), item(false, 'cliente'), item(false, 'cliente'), item(false, 'cliente'), item(false, 'material'), item(null)]),
      plano('2026-11-09', []),
    ], hoje)
    expect(s).toEqual({ planejadas: 6, cumpridas: 1, ppc: 0.2, causas: '3 por cliente, 1 por material' })
  })
})

describe('sinaisDoCliente', () => {
  const base = { terminoBase: '2026-12-01', terminoProjetado: '2026-12-01', desvioDiasUteis: 0, restricoes: [] as Restricao[],
    mensagens: [] as { autorTipo: 'cliente' | 'manfac'; criadoEm: string }[], agenda: [] as ItemAgenda[], hoje, feriados: F }
  const de = (s: SinalCliente[], k: SinalCliente['chave']) => s.find((x) => x.chave === k)!

  it('sempre as 4 chaves, nesta ordem; ok sem curto', () => {
    const s = sinaisDoCliente(base)
    expect(s.map((x) => x.chave)).toEqual(['entrega', 'pendencias', 'mensagens', 'semanal'])
    expect(s.every((x) => x.tom === 'ok' && x.curto === null)).toBe(true)
    expect(de(s, 'entrega').texto).toBe('entrega mantida em 01/12')
  })
  it('entrega: desvio ≥ 5 ruim, menor atenção; sem base ok', () => {
    const r = de(sinaisDoCliente({ ...base, terminoProjetado: '2026-12-08', desvioDiasUteis: 5 }), 'entrega')
    expect(r).toMatchObject({ tom: 'ruim', texto: 'entrega mudou de 01/12 para 08/12' })
    expect(r.curto).not.toBeNull()
    expect(de(sinaisDoCliente({ ...base, terminoProjetado: '2026-12-03', desvioDiasUteis: 2 }), 'entrega').tom).toBe('atencao')
    expect(de(sinaisDoCliente({ ...base, terminoBase: null, desvioDiasUteis: null }), 'entrega')).toMatchObject({ tom: 'ok', texto: 'sem data base' })
  })
  it('pendências: só abertas do cliente; vencida ou ≥ 5 d.u. → ruim; senão atenção; null → indisponível', () => {
    const nova = restr({ criadoEm: '2026-11-03T12:00:00Z' })
    const s1 = de(sinaisDoCliente({ ...base, restricoes: [nova, restr({ responsavel: 'manfac' }), restr({ situacao: 'liberada' })] }), 'pendencias')
    expect(s1.tom).toBe('atencao')
    expect(s1.texto).toBe('1 pendência com o cliente, a mais antiga há 1 dia útil')
    expect(de(sinaisDoCliente({ ...base, restricoes: [nova, restr({ criadoEm: '2026-10-29T12:00:00Z' })] }), 'pendencias').texto)
      .toBe('2 pendências com o cliente, a mais antiga há 4 dias úteis')
    expect(de(sinaisDoCliente({ ...base, restricoes: [nova, restr({ criadoEm: '2026-10-20T12:00:00Z' })] }), 'pendencias').tom).toBe('ruim')
    expect(de(sinaisDoCliente({ ...base, restricoes: [restr({ criadoEm: '2026-11-03T12:00:00Z', prazo: '2026-11-03' })] }), 'pendencias').tom).toBe('ruim')
    expect(de(sinaisDoCliente({ ...base, restricoes: null }), 'pendencias'))
      .toMatchObject({ tom: 'indisponivel', texto: 'não foi possível ler as pendências' })
  })
  it('mensagens: última do cliente há > 1 d.u. → ruim com contagem desde a última da Manfac', () => {
    const s = de(sinaisDoCliente({ ...base, mensagens: [
      { autorTipo: 'cliente', criadoEm: '2026-10-27T15:00:00Z' },
      { autorTipo: 'manfac', criadoEm: '2026-10-28T15:00:00Z' },
      { autorTipo: 'cliente', criadoEm: '2026-10-29T15:00:00Z' },
      { autorTipo: 'cliente', criadoEm: '2026-10-30T15:00:00Z' },
    ] }), 'mensagens')
    expect(s).toMatchObject({ tom: 'ruim', texto: '2 mensagens do cliente sem resposta desde 29/10' })
    expect(s.curto).not.toBeNull()
  })
  it('mensagens: do cliente ontem (1 d.u.) ok; anteontem (2 d.u.) ruim, no singular', () => {
    expect(de(sinaisDoCliente({ ...base, mensagens: [{ autorTipo: 'cliente', criadoEm: '2026-11-03T15:00:00Z' }] }), 'mensagens').tom).toBe('ok')
    expect(de(sinaisDoCliente({ ...base, mensagens: [{ autorTipo: 'cliente', criadoEm: '2026-11-02T15:00:00Z' }] }), 'mensagens'))
      .toMatchObject({ tom: 'ruim', texto: '1 mensagem do cliente sem resposta desde 02/11' })
  })
  it('mensagens: do cliente hoje (dia BRT) ainda ok; última da Manfac ok', () => {
    // 02:00Z de 05/11 ainda é 04/11 em Brasília.
    expect(de(sinaisDoCliente({ ...base, hoje: '2026-11-04', mensagens: [{ autorTipo: 'cliente', criadoEm: '2026-11-05T02:00:00Z' }] }), 'mensagens').tom).toBe('ok')
    expect(de(sinaisDoCliente({ ...base, mensagens: [
      { autorTipo: 'cliente', criadoEm: '2026-10-20T15:00:00Z' }, { autorTipo: 'manfac', criadoEm: '2026-10-21T15:00:00Z' },
    ] }), 'mensagens').tom).toBe('ok')
  })
  it('semanal: atrasado → atenção; ok mostra o último envio', () => {
    const item = (o: Partial<ItemAgenda>): ItemAgenda => ({ tipo: 'semanal', referencia: '2026-10-26', dataPrevista: '2026-10-30', dataReal: null, situacao: 'no_prazo', ...o })
    expect(de(sinaisDoCliente({ ...base, agenda: [item({ situacao: 'atrasado' }), item({ tipo: 'diario', situacao: 'atrasado' })] }), 'semanal'))
      .toMatchObject({ tom: 'atencao', texto: 'relatório semanal de 30/10 não foi enviado' })
    const ok = de(sinaisDoCliente({ ...base, agenda: [item({ dataReal: '2026-10-30' }), item({ dataReal: '2026-10-23', dataPrevista: '2026-10-23' })] }), 'semanal')
    expect(ok.tom).toBe('ok')
    expect(ok.texto).toContain('30/10')
  })
  it('mensagens e agenda null → os dois indisponíveis (nunca ok)', () => {
    const s = sinaisDoCliente({ ...base, mensagens: null, agenda: null })
    expect(de(s, 'mensagens')).toMatchObject({ tom: 'indisponivel', texto: 'não foi possível ler as mensagens' })
    expect(de(s, 'semanal').tom).toBe('indisponivel')
    expect(de(s, 'mensagens').curto).not.toBeNull()
    expect(de(s, 'semanal').curto).not.toBeNull()
  })
})

describe('dinheiroDaCarteira', () => {
  const total = { receitaEsperada: 1000 as number | null, receitaRealizada: 400, custoRealizado: 300, custoComprometido: 200, margemPct: 25 }
  const leitura = (t: typeof total, faturamento: { ok: boolean; dados?: unknown[] } = { ok: true, dados: [{}, {}] }): LeituraFinanceiro =>
    ({ ok: true, obras: [], fin: { resumo: { ok: true, dados: { total: t } }, faturamento } }) as unknown as LeituraFinanceiro
  it('falhas mantêm o motivo; nao_encontrada vira leitura; resumo falho vira leitura', () => {
    expect(dinheiroDaCarteira({ ok: false, motivo: 'sem_permissao' })).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(dinheiroDaCarteira({ ok: false, motivo: 'nao_encontrada' })).toEqual({ ok: false, motivo: 'leitura' })
    expect(dinheiroDaCarteira({ ok: false, motivo: 'leitura' })).toEqual({ ok: false, motivo: 'leitura' })
    expect(dinheiroDaCarteira({ ok: true, obras: [], fin: { resumo: { ok: false } } } as unknown as LeituraFinanceiro)).toEqual({ ok: false, motivo: 'leitura' })
  })
  it('números do total e notas do faturamento', () => {
    expect(dinheiroDaCarteira(leitura(total))).toEqual({
      ok: true, valor: 1000, faturado: 400, aFaturar: 600, acimaDoValor: false, notas: 2, custoRealizado: 300, custoComprometido: 200, margemPct: 25,
    })
  })
  it('faturado > valor → aFaturar 0 e acimaDoValor; valor null → aFaturar null; faturamento falho → 0 notas', () => {
    expect(dinheiroDaCarteira(leitura({ ...total, receitaRealizada: 1200 }))).toMatchObject({ aFaturar: 0, acimaDoValor: true })
    expect(dinheiroDaCarteira(leitura({ ...total, receitaEsperada: null }))).toMatchObject({ valor: null, aFaturar: null, acimaDoValor: false })
    expect(dinheiroDaCarteira(leitura(total, { ok: false }))).toMatchObject({ notas: 0 })
  })
})

describe('ficaNaCarteira', () => {
  const fat = { tipo: 'faturando' } as const
  it('sai só quando faturando, valor conhecido e nada a faturar', () => {
    expect(ficaNaCarteira({ estado: fat, dinheiro: dinheiroOk({ aFaturar: 0, faturado: 1000 }) })).toBe(false)
    expect(ficaNaCarteira({ estado: fat, dinheiro: { ok: false, motivo: 'leitura' } })).toBe(true)
    expect(ficaNaCarteira({ estado: fat, dinheiro: dinheiroOk({ valor: null, aFaturar: null }) })).toBe(true)
    expect(ficaNaCarteira({ estado: fat, dinheiro: dinheiroOk() })).toBe(true)
    expect(ficaNaCarteira({ estado: { tipo: 'andando', comAtraso: false }, dinheiro: dinheiroOk({ aFaturar: 0 }) })).toBe(true)
  })
})

describe('grupoDe / ordenarCarteira / filtrarCarteira', () => {
  it('grupos: faturando 4 (vence o sinal), sem cronograma 3, vermelho 0, amarelo 1, verde 2', () => {
    expect(grupoDe({ sinal: 'vermelho', estado: { tipo: 'faturando' } })).toBe(4)
    expect(grupoDe({ sinal: 'vermelho', estado: { tipo: 'sem_cronograma' } })).toBe(3)
    expect(grupoDe({ sinal: null, estado: { tipo: 'sem_cronograma' } })).toBe(3)
    expect(grupoDe({ sinal: 'vermelho', estado: { tipo: 'andando', comAtraso: true } })).toBe(0)
    expect(grupoDe({ sinal: 'amarelo', estado: { tipo: 'parada', diasUteis: 4 } })).toBe(1)
    expect(grupoDe({ sinal: 'verde', estado: { tipo: 'andando', comAtraso: false } })).toBe(2)
  })
  it('ordena por grupo, parada desc, desvio desc, loja', () => {
    const o = ordenarCarteira([
      obra({ id: 'fat', estado: { tipo: 'faturando' } }),
      obra({ id: 'verde' }),
      obra({ id: 'v-b', sinal: 'vermelho', loja: 'B' }),
      obra({ id: 'v-a', sinal: 'vermelho', loja: 'A' }),
      obra({ id: 'v-desvio', sinal: 'vermelho', loja: 'Z', desvioDiasUteis: 3 }),
      obra({ id: 'v-parada', sinal: 'vermelho', loja: 'Z', estado: { tipo: 'parada', diasUteis: 6 } }),
      obra({ id: 'sem', sinal: null, estado: { tipo: 'sem_cronograma' } }),
      obra({ id: 'am', sinal: 'amarelo' }),
    ])
    expect(o.map((x) => x.id)).toEqual(['v-parada', 'v-desvio', 'v-a', 'v-b', 'am', 'verde', 'sem', 'fat'])
  })
  it('filtros', () => {
    const lista = [
      obra({ id: 'v', sinal: 'vermelho', travas: [trava({ quem: 'cliente' })] }),
      obra({ id: 'a', sinal: 'amarelo', travas: [trava({ quem: 'terceiros' })] }),
      obra({ id: 'g', travas: [trava({ quem: 'manfac' })] }),
      obra({ id: 'f', estado: { tipo: 'faturando' } }),
    ]
    const ids = (f: Parameters<typeof filtrarCarteira>[1]) => filtrarCarteira(lista, f).map((x) => x.id)
    expect(ids('todas')).toEqual(['v', 'a', 'g', 'f'])
    expect(ids('risco')).toEqual(['v', 'a'])
    expect(ids('cliente')).toEqual(['v'])
    expect(ids('manfac')).toEqual(['g'])
    expect(ids('terceiros')).toEqual(['a'])
    expect(ids('no_prazo')).toEqual(['g'])
    expect(ids('faturando')).toEqual(['f'])
  })
})

describe('contarTravas', () => {
  it('travas e obras por quem', () => {
    expect(contarTravas([
      obra({ travas: [trava({ quem: 'cliente' }), trava({ quem: 'cliente' }), trava({ quem: 'manfac' })] }),
      obra({ travas: [trava({ quem: 'cliente' })] }),
    ])).toEqual({ cliente: { travas: 3, obras: 2 }, manfac: { travas: 1, obras: 1 }, terceiros: { travas: 0, obras: 0 } })
  })
})

describe('excecoesDoDia', () => {
  it('uma por fato, por gravidade e loja, dizendo quem destrava', () => {
    const tLum = trava({ descricao: 'Aprovação do projeto luminotécnico', quem: 'cliente' })
    const tVenc = trava({ descricao: 'Entrega do forro', quem: 'manfac', prazo: '2026-11-01', vencida: true })
    const ex = excecoesDoDia([
      obra({ id: 'b', loja: 'Barra', sinal: 'vermelho', estado: { tipo: 'parada', diasUteis: 6 }, travas: [tLum], travaPrincipal: tLum,
        sinais: [{ chave: 'mensagens', tom: 'ruim', texto: '2 mensagens do cliente sem resposta desde 29/10', curto: 'x' }] }),
      obra({ id: 'a', loja: 'Arpoador', sinal: 'verde', travas: [tVenc], travaPrincipal: tVenc,
        sinais: [{ chave: 'semanal', tom: 'atencao', texto: 'relatório semanal de 30/10 não foi enviado', curto: 'x' }] }),
      obra({ id: 'c', loja: 'Centro' }),
    ])
    expect(ex.map((e) => [e.obraId, e.gravidade])).toEqual([['b', 0], ['b', 1], ['a', 2], ['b', 3], ['a', 4]])
    expect(ex[1].texto).toBe('parada há 6 dias úteis; trava: Aprovação do projeto luminotécnico (Cliente)')
    expect(ex[1].quem).toBe('cliente')
    expect(ex[2]).toMatchObject({ quem: 'manfac', obra: 'Arpoador' })
    expect(ex[2].texto).toContain('Entrega do forro')
    expect(ex[3].quem).toBe('manfac')
  })
  it('obra sem fato → nenhuma exceção', () => expect(excecoesDoDia([obra({})])).toEqual([]))
})

describe('resumoCarteira', () => {
  it('somas só das obras com dinheiro ok; contagem por sinal', () => {
    const r = resumoCarteira([
      obra({ sinal: 'vermelho', dinheiro: dinheiroOk() }),
      obra({ sinal: null, estado: { tipo: 'sem_cronograma' }, dinheiro: dinheiroOk({ valor: null, aFaturar: null, faturado: 50, custoRealizado: 10 }) }),
      obra({ sinal: 'verde', dinheiro: { ok: false, motivo: 'sem_permissao' } }),
      obra({ sinal: 'verde', estado: { tipo: 'faturando' }, dinheiro: dinheiroOk({ valor: 500, faturado: 600, aFaturar: 0, acimaDoValor: true }) }),
    ])
    expect(r.porSinal).toEqual({ vermelho: 1, amarelo: 0, verde: 1, sem: 1 })
    expect(r.faturando).toBe(1)
    expect(r).toMatchObject({ faturado: 1050, aFaturar: 600, valor: 1500, custoRealizado: 210, foraDasSomas: 1 })
  })
})
