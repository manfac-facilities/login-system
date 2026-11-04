import {
  contarTravas, dinheiroDaCarteira, estadoDaObra, etapasDaCarteira, excecoesDoDia, ficaNaCarteira,
  filtrarCarteira, grupoDe, ordenarCarteira, resumoCarteira, semanaDe, sinaisDoCliente, travaPrincipal,
  travasDaObra, ultimoAvanco,
  type DinheiroCarteira, type ObraCarteira, type SinalCliente, type Trava,
} from '../carteira'
import type { AtividadeCalculada, ResultadoCronograma, ResumoEtapa } from '../cronograma'
import { montarFinanceiro } from '../financeiro-tela'
import { linhasDeEtapa } from '../../_ui/evolucao-etapas'
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
  ({ ok: true, valor: 1000, faturado: 400, faturadoPct: 40, aFaturar: 600, acimaDoValor: false, osSemValor: 0, notas: 1, custoRealizado: 100, custoComprometido: 50, margemPct: 10, ...o })
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
  it('calc com atividades vazias → sem_cronograma (nunca faturando) e fica na carteira', () => {
    const estado = estadoDaObra({ ...base, calc: calcDe([]), hist: recente })
    expect(estado).toEqual({ tipo: 'sem_cronograma' })
    expect(ficaNaCarteira({ estado, dinheiro: dinheiroOk({ aFaturar: 0, faturado: 1000 }) })).toBe(true)
    expect(etapasDaCarteira(calcDe([]), [])).toEqual([])
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
  it('data base futura → comeca (nunca "Começou" no futuro); data base hoje → comecou', () => {
    expect(estadoDaObra({ ...base, calc: calcDe([ativ({})]), dataBase: '2026-11-10' })).toEqual({ tipo: 'comeca', em: '2026-11-10' })
    expect(estadoDaObra({ ...base, calc: calcDe([ativ({})]), hist: recente, dataBase: hoje })).toEqual({ tipo: 'comecou', em: hoje })
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
  // Resumo por etapa como o de `ObraGrande.etapas` (percentual já calculado por `resumirEtapas`).
  const resumo = (etapa: string, numeros: number[], percentual: number): ResumoEtapa =>
    ({ etapa, numeros, percentual, inicio: hoje, fim: hoje, diasUteis: 1, inicioProjetado: hoje, fimProjetado: hoje })
  it('null → []', () => expect(etapasDaCarteira(null, [])).toEqual([]))
  it('realizado vem do resumo da etapa e o previsto do mesmo cálculo do painel; pior situação', () => {
    const atividades = [
      ativ({ numero: 1, etapa: 'B', percentual: 1, percentualPrevisto: 1, peso: 3, situacao: 'concluida' }),
      ativ({ numero: 2, etapa: 'A', percentual: 0, percentualPrevisto: 0, peso: 0, duracao: 1, status: 'nao_iniciado' }),
      ativ({ numero: 3, etapa: 'B', percentual: 0, percentualPrevisto: 0.5, peso: 1, situacao: 'atrasada' }),
      ativ({ numero: 4, etapa: 'A', percentual: 0.5, percentualPrevisto: 1, peso: 0, duracao: 3, situacao: 'aguardando_cliente' }),
    ]
    const etapas = [resumo('B', [1, 3], 0.75), resumo('A', [2, 4], 0.375)]
    const e = etapasDaCarteira(calcDe(atividades), etapas)
    expect(e.map((x) => x.nome)).toEqual(['B', 'A'])
    expect(e[0]).toEqual({ nome: 'B', realizado: 0.75, previsto: 0.875, situacao: 'atrasada' })
    // Etapa A soma peso 0: o painel pondera pela duração (1 e 3) → previsto 0,75, não a média simples 0,5.
    expect(e[1]).toEqual({ nome: 'A', realizado: 0.375, previsto: 0.75, situacao: 'aguardando_cliente' })
    const painel = linhasDeEtapa(etapas, atividades, null, F)
    expect(e.map((x) => [x.realizado, x.previsto])).toEqual(painel.map((l) => [l.realizado, l.previsto]))
  })
  it('concluída só se todas concluídas; travada vem de travada/bloqueada', () => {
    const e = etapasDaCarteira(calcDe([
      ativ({ numero: 1, etapa: 'C', situacao: 'concluida' }), ativ({ numero: 2, etapa: 'C', situacao: 'concluida' }),
      ativ({ numero: 3, etapa: 'D', situacao: 'no_prazo', status: 'em_andamento' }), ativ({ numero: 4, etapa: 'D', situacao: 'no_prazo', travada: true }),
      ativ({ numero: 5, etapa: 'D', situacao: 'inicio_atrasado' }),
    ]), [resumo('C', [1, 2], 1), resumo('D', [3, 4, 5], 0)])
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
  it('plano da semana corrente; ppc, causas em texto e quantas não cumpridas', () => {
    const s = semanaDe([
      plano('2026-10-26', [item(true)]),
      plano('2026-11-02', [item(true), item(false, 'cliente'), item(false, 'cliente'), item(false, 'cliente'), item(false, 'material'), item(null)]),
      plano('2026-11-09', []),
    ], hoje)
    expect(s).toEqual({ corrente: true, planejadas: 6, cumpridas: 1, ppc: 0.2, causas: '3 por cliente, 1 por material', naoCumpridas: 4 })
  })
  it('sem plano desta semana: aceita o da semana anterior (corrente: false); mais antigo → null', () => {
    expect(semanaDe([plano('2026-10-26', [item(false, 'clima')])], hoje))
      .toEqual({ corrente: false, planejadas: 1, cumpridas: 0, ppc: 0, causas: '1 por clima', naoCumpridas: 1 })
    expect(semanaDe([plano('2026-10-19', [item(true)])], hoje)).toBeNull()
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
    expect(s1.curto).toBe('1 pendência do cliente')
    const s2 = de(sinaisDoCliente({ ...base, restricoes: [nova, restr({ criadoEm: '2026-10-29T12:00:00Z' })] }), 'pendencias')
    expect(s2.texto).toBe('2 pendências com o cliente, a mais antiga há 4 dias úteis')
    expect(s2.curto).toBe('2 pendências do cliente')
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
    expect(s).toMatchObject({ tom: 'ruim', texto: '2 mensagens do cliente sem resposta desde 29/10', curto: '2 mensagens sem resposta' })
  })
  it('mensagens: do cliente ontem (1 d.u.) ok; anteontem (2 d.u.) ruim, no singular', () => {
    expect(de(sinaisDoCliente({ ...base, mensagens: [{ autorTipo: 'cliente', criadoEm: '2026-11-03T15:00:00Z' }] }), 'mensagens').tom).toBe('ok')
    expect(de(sinaisDoCliente({ ...base, mensagens: [{ autorTipo: 'cliente', criadoEm: '2026-11-02T15:00:00Z' }] }), 'mensagens'))
      .toMatchObject({ tom: 'ruim', texto: '1 mensagem do cliente sem resposta desde 02/11', curto: '1 mensagem sem resposta' })
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
  const MAE = 'mae'
  const FILHA = 'filha'
  const nota = (o: Record<string, unknown> = {}) => ({
    obra_id: MAE, obra_os: '0526-1', nota_id: 'n1', parcela_centavos: 40_000, nota_valor_total_centavos: 40_000,
    nota_situacao: 'autorizada', nfse_numero: '1', tomador_nome: 'C', obras_devolvidas_em: null, ...o,
  })
  // Leitura real: o mesmo `montarFinanceiro` que alimenta a aba Financeiro.
  const real = (obras: { id: string; receita: number | null; cancelada?: boolean }[], notas: Record<string, unknown>[]): LeituraFinanceiro => {
    const of = obras.map((o) => ({ id: o.id, os: o.id, loja: 'L', paiId: o.id === MAE ? null : MAE, receitaCentavos: o.receita, cancelada: !!o.cancelada }))
    return { ok: true, obras: of, fin: montarFinanceiro({ obraId: MAE, obras: of, compras: [], fornecedores: [], notas }) }
  }
  it('falhas mantêm o motivo; nao_encontrada vira leitura; resumo falho vira leitura', () => {
    expect(dinheiroDaCarteira({ ok: false, motivo: 'sem_permissao' })).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(dinheiroDaCarteira({ ok: false, motivo: 'nao_encontrada' })).toEqual({ ok: false, motivo: 'leitura' })
    expect(dinheiroDaCarteira({ ok: false, motivo: 'leitura' })).toEqual({ ok: false, motivo: 'leitura' })
    expect(dinheiroDaCarteira({ ok: true, obras: [], fin: { resumo: { ok: false } } } as unknown as LeituraFinanceiro)).toEqual({ ok: false, motivo: 'leitura' })
  })
  it('números da aba Financeiro; notas só as que contam na receita', () => {
    const l = real([{ id: MAE, receita: 100_000 }], [nota(), nota({ nota_id: 'n2', nota_situacao: 'rascunho' }), nota({ nota_id: 'n3', obras_devolvidas_em: '2026-11-01' })])
    expect(dinheiroDaCarteira(l)).toMatchObject({
      ok: true, valor: 100_000, faturado: 40_000, faturadoPct: 40, aFaturar: 60_000, acimaDoValor: false, osSemValor: 0, notas: 1,
    })
  })
  it('mãe com valor + aditivo sem valor com nota: % igual ao da aba, faturado só das OS com valor, obra fica na carteira', () => {
    const l = real([{ id: MAE, receita: 100_000 }, { id: FILHA, receita: null }], [nota(), nota({ nota_id: 'n2', obra_id: FILHA, obra_os: FILHA, parcela_centavos: 70_000 })])
    if (!l.ok || !l.fin.resumo.ok) throw new Error('fin')
    const d = dinheiroDaCarteira(l)
    expect(d).toMatchObject({ ok: true, valor: 100_000, faturado: 40_000, aFaturar: 60_000, acimaDoValor: false, osSemValor: 1, notas: 2 })
    if (!d.ok) throw new Error('ok')
    expect(d.faturadoPct).toBe(l.fin.resumo.dados.percentuais.faturado)
    expect(ficaNaCarteira({ estado: { tipo: 'faturando' }, dinheiro: { ...d, aFaturar: 0 } })).toBe(true)
  })
  it('OS cancelada com nota não entra no faturado da obra (como na aba)', () => {
    const l = real([{ id: MAE, receita: 100_000 }, { id: FILHA, receita: 50_000, cancelada: true }], [nota(), nota({ nota_id: 'n2', obra_id: FILHA, obra_os: FILHA })])
    expect(dinheiroDaCarteira(l)).toMatchObject({ valor: 100_000, faturado: 40_000, faturadoPct: 40, osSemValor: 0 })
  })
  it('faturado > valor → aFaturar 0 e acimaDoValor; sem valor → valor/aFaturar/% null; faturamento falho → 0 notas', () => {
    expect(dinheiroDaCarteira(real([{ id: MAE, receita: 30_000 }], [nota()]))).toMatchObject({ aFaturar: 0, acimaDoValor: true })
    expect(dinheiroDaCarteira(real([{ id: MAE, receita: null }], [nota()])))
      .toMatchObject({ valor: null, faturado: 40_000, faturadoPct: null, aFaturar: null, acimaDoValor: false, osSemValor: 1 })
    const l = real([{ id: MAE, receita: 100_000 }], [nota()])
    if (!l.ok) throw new Error('ok')
    expect(dinheiroDaCarteira({ ...l, fin: { ...l.fin, faturamento: { ok: false, motivo: 'leitura' } } } as LeituraFinanceiro)).toMatchObject({ notas: 0 })
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
    // OS sem valor: o valor da obra não está provado (spec §5.1), então não sai.
    expect(ficaNaCarteira({ estado: fat, dinheiro: dinheiroOk({ aFaturar: 0, faturado: 1000, osSemValor: 1 }) })).toBe(true)
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
  it('concluída (faturando) que terminou atrasada não vira exceção de "atrasada"', () => {
    expect(excecoesDoDia([obra({ sinal: 'vermelho', estado: { tipo: 'faturando' }, desvioDiasUteis: 4 })])).toEqual([])
  })
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
    // A sem valor fica fora de faturado/valor/aFaturar, mas o custo dela soma.
    expect(r).toMatchObject({ faturado: 1000, aFaturar: 600, valor: 1500, custoRealizado: 210, foraDasSomas: 1, semValor: 1 })
  })

  it('obra sem valor informado: fora de faturado/valor/aFaturar, dentro do custo, contada em semValor', () => {
    const r = resumoCarteira([
      obra({ dinheiro: dinheiroOk({ valor: null, aFaturar: null, faturado: 900, custoRealizado: 30 }) }),
      obra({ dinheiro: dinheiroOk({ valor: 1000, faturado: 400, aFaturar: 600, custoRealizado: 20 }) }),
    ])
    expect(r).toMatchObject({ faturado: 400, valor: 1000, aFaturar: 600, custoRealizado: 50, semValor: 1, foraDasSomas: 0 })
  })

  it('obra com OS sem valor (valor incompleto): tratada como sem valor', () => {
    const r = resumoCarteira([
      obra({ dinheiro: dinheiroOk({ valor: 1000, faturado: 400, aFaturar: 600, osSemValor: 2, custoRealizado: 30 }) }),
      obra({ dinheiro: dinheiroOk({ valor: 1000, faturado: 400, aFaturar: 600, custoRealizado: 20 }) }),
    ])
    expect(r).toMatchObject({ faturado: 400, valor: 1000, aFaturar: 600, custoRealizado: 50, semValor: 1, foraDasSomas: 0 })
  })
})
