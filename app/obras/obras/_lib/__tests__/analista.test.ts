/**
 * Analista da obra (Leva 5 §7, Task 6): cada tipo de ponto a explicar vira uma
 * pergunta com números e só o código exibido; pergunta respondida sem mudança
 * nos números não volta; resposta interna (ou ponto de dado oculto) fica fora
 * do que vai ao cliente.
 */
import { perguntasAbertas, pontosAExplicar, respostasParaCliente, type DadosAnalista, type PerguntaSalva, type Ponto } from '../analista'
import type { AtividadeCalculada } from '../cronograma'
import type { PlanoSemana, Restricao } from '../last-planner'
import { imp, obraGrandePdf } from '../../_pdf/__tests__/fixtures/rdo'

const HOJE = '2026-11-16' // segunda

const ativ = (numero: number, over: Partial<AtividadeCalculada> = {}): AtividadeCalculada =>
  ({
    numero, etapa: 'E', descricao: `Atividade ${numero}`, pred1: null, pred2: null, duracao: 5, bloqueiaPorTrava: false,
    pesoValor: 98765, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
    inicioPrevisto: '2026-10-26', fimPrevisto: '2026-10-30', inicioProjetado: '2026-10-26', fimProjetado: '2026-11-03',
    peso: 1 / 3, percentualPrevisto: 0, situacao: 'no_prazo', travada: false, inicioFixo: null, diasRestantes: null,
    alertaInicioFixo: null, inicioFixoAjustado: false, ...over,
  }) as AtividadeCalculada

const restricao = (over: Partial<Restricao>): Restricao => ({
  id: 'r', obraId: 'o1', atividadeNumero: 3, tipo: 'decisao_cliente', descricao: 'Aprovar o layout do balcão',
  responsavel: 'cliente', prazo: '2026-11-10', situacao: 'identificada', liberadaEm: null, criadoPor: null,
  criadoEm: '2026-10-20T10:00:00Z', ...over,
})

function dados(over: Partial<DadosAnalista> = {}, og = obraGrandePdf()): DadosAnalista {
  og.calc = {
    atividades: [
      ativ(10, { descricao: 'Demolição', status: 'concluido', percentual: 1 }),
      ativ(77, { descricao: 'Drywall do salão', status: 'em_andamento', percentual: 0.6, duracao: 9, inicioReal: '2026-10-29', fimProjetado: '2026-11-20' }),
      ativ(3, { descricao: 'Pintura', status: 'nao_iniciado' }),
    ],
    previsto: 0.58, realizado: 0.52, desvioPP: -6, terminoPrevisto: '2026-12-18', terminoProjetado: '2026-12-28',
  }
  og.terminoBase = '2026-12-18'
  og.atraso = { total: 6, cliente: 2, manfac: 4, terceiro: 0, clima: 0 }
  og.impedimentos = [
    imp({ id: 'c1', abertoEm: '2026-11-02', descricao: 'Liberar a área do caixa', atividadeNumero: 3 }), // 9 dias úteis
    imp({ id: 'novo', abertoEm: '2026-11-12', descricao: 'Recente' }), // 2 dias úteis
    imp({ id: 'oculto', responsavel: 'manfac', descricao: 'Pedreiro faltou sem avisar', exibirAoCliente: false, abertoEm: '2026-11-03', travaAtividade: false }),
    imp({ id: 'fechado', abertoEm: '2026-10-01', encerradoEm: '2026-10-05' }),
  ]
  return { og, hoje: HOJE, restricoes: [], planos: [], ultimaPublicada: null, ...over }
}

const por = (ps: Ponto[], tipo: Ponto['tipo']) => ps.filter((p) => p.tipo === tipo)

describe('pontosAExplicar', () => {
  it('desvio > 2 p.p. abaixo do previsto', () => {
    const [p] = por(pontosAExplicar(dados()), 'desvio')
    expect(p).toMatchObject({ chave: 'desvio:obra', contexto: { realizado: '52%', previsto: '58%', desvioPP: -6 } })
    expect(p.pergunta).toContain('6 p.p. abaixo')
    const og = obraGrandePdf()
    const d = dados({}, og)
    d.og.calc!.desvioPP = -2
    expect(por(pontosAExplicar(d), 'desvio')).toEqual([])
  })

  it('entrega depois da base', () => {
    const [p] = por(pontosAExplicar(dados()), 'entrega')
    expect(p.chave).toBe('entrega:obra')
    expect(p.pergunta).toContain('18/12/2026')
    expect(p.pergunta).toContain('28/12/2026')
    expect(p.contexto.diasUteis).toBe(6)
  })

  it('atividade em execução além da duração: código exibido, nunca o numero', () => {
    const [p] = por(pontosAExplicar(dados()), 'execucao')
    expect(p.chave).toBe('execucao:77')
    // 29/10 a 16/11 = 13 dias úteis (sem feriado) contra 9 planejados.
    expect(p.pergunta).toBe('Drywall do salão (1.2): 13 dias úteis em execução contra 9 planejados, 60% concluído. O que causou e qual a ação para recuperar? Até quando?')
    expect(p.pergunta).not.toMatch(/\b77\b/)
    expect(JSON.stringify(p.contexto)).not.toMatch(/\b77\b/)
  })

  it('restrição vencida e liberada depois do prazo; liberada no prazo não pergunta', () => {
    const ps = por(
      pontosAExplicar(
        dados({
          restricoes: [
            restricao({ id: 'venc' }),
            restricao({ id: 'tarde', situacao: 'liberada', prazo: '2026-11-05', liberadaEm: '2026-11-09' }),
            restricao({ id: 'noprazo', situacao: 'liberada', prazo: '2026-11-05', liberadaEm: '2026-11-04' }),
            restricao({ id: 'futura', prazo: '2026-11-30' }),
            restricao({ id: 'manf', responsavel: 'manfac', tipo: 'material', descricao: 'Compra pelo setor de suprimentos', prazo: '2026-11-09' }),
          ],
        }),
      ),
      'restricao',
    )
    expect(ps.map((p) => p.chave)).toEqual(['restricao:venc', 'restricao:tarde', 'restricao:manf'])
    expect(ps[0].pergunta).toContain('venceu em 10/11/2026')
    expect(ps[1].pergunta).toContain('liberada em 09/11/2026, depois do prazo de 05/11/2026')
    // Fato (vai à IA): restrição da Manfac sem a descrição (pode citar área interna).
    expect(ps[2].fato).not.toContain('suprimentos')
    expect(ps[2].fato).toContain('responsabilidade da Manfac')
  })

  it('itens não cumpridos do plano avaliado mais recente', () => {
    const plano = (seg: string, cumprido: boolean | null): PlanoSemana => ({
      id: seg, obraId: 'o1', semanaInicio: seg, fechadoEm: 'x', fechadoPor: null,
      itens: [{ id: 'i', planoId: seg, numero: 77, metaPercentual: 0.8, percentualFinal: 0.6, cumprido, causa: 'material', avaliadoEm: 'x' }],
    })
    const ps = por(pontosAExplicar(dados({ planos: [plano('2026-11-02', false), plano('2026-11-09', false), plano('2026-11-16', null)] })), 'plano')
    expect(ps.map((p) => p.chave)).toEqual(['plano:2026-11-09:77'])
    expect(ps[0].pergunta).toContain('Drywall do salão (1.2) ficou em 60% contra a meta de 80% (causa: Material)')
    expect(ps[0].fato).not.toContain('Material') // causa interna da Manfac não vai à IA
  })

  it('impedimento aberto há mais de 3 dias úteis; o oculto é só interno', () => {
    const ps = por(pontosAExplicar(dados()), 'impedimento')
    expect(ps.map((p) => p.chave)).toEqual(['impedimento:c1', 'impedimento:oculto'])
    expect(ps[0]).toMatchObject({ soInterno: false, contexto: { diasUteis: 10 } })
    expect(ps[1].soInterno).toBe(true)
    expect(ps[1].fato).toBe('')
  })

  it('dias de atraso por responsável que mudaram desde a última situação publicada', () => {
    const nunca = por(pontosAExplicar(dados()), 'atraso')
    expect(nunca.map((p) => p.chave)).toEqual(['atraso:manfac', 'atraso:cliente'])
    const depois = por(
      pontosAExplicar(dados({ ultimaPublicada: { atraso: { cliente: 2, manfac: 3, terceiro: 0, clima: 0 }, desvioPP: -5, terminoProjetado: '2026-12-24' } })),
      'atraso',
    )
    expect(depois.map((p) => p.chave)).toEqual(['atraso:manfac'])
    expect(depois[0].pergunta).toContain('eram 3 na última situação publicada')
  })

  it('obra sem cronograma: nenhum ponto', () => {
    const og = obraGrandePdf({ calc: null })
    expect(pontosAExplicar({ og, hoje: HOJE, restricoes: [], planos: [], ultimaPublicada: null })).toEqual([])
  })
})

const salva = (p: Ponto, over: Partial<PerguntaSalva> = {}): PerguntaSalva => ({
  chave: p.chave, resposta: 'Resposta do engenheiro', interno: false, aberta: false, impressao: p.impressao,
  respondidaPor: 'eng@manfac.com.br', respondidaEm: '2026-11-16T12:00:00Z', ...over,
})

describe('perguntasAbertas', () => {
  it('respondida e sem mudança nos números não volta; com mudança volta com a resposta anterior', () => {
    const d = dados()
    const ps = pontosAExplicar(d)
    const exec = ps.find((p) => p.tipo === 'execucao')!
    const respondidas = [salva(exec)]
    expect(perguntasAbertas(ps, respondidas).map((p) => p.chave)).not.toContain('execucao:77')
    // Um dia a mais em execução, mesmo término projetado: continua respondida.
    const amanha = pontosAExplicar({ ...d, hoje: '2026-11-17' })
    expect(perguntasAbertas(amanha, respondidas).map((p) => p.chave)).not.toContain('execucao:77')
    // Término projetado mudou: volta, com a resposta anterior.
    d.og.calc!.atividades[1] = { ...d.og.calc!.atividades[1], fimProjetado: '2026-11-25' }
    const mudou = perguntasAbertas(pontosAExplicar(d), respondidas).find((p) => p.chave === 'execucao:77')
    expect(mudou?.anterior).toEqual({ resposta: 'Resposta do engenheiro', interno: false })
  })

  it('linha ainda aberta (sem resposta) continua aberta', () => {
    const ps = pontosAExplicar(dados())
    const desvio = ps.find((p) => p.tipo === 'desvio')!
    expect(perguntasAbertas(ps, [salva(desvio, { aberta: true, resposta: null })]).map((p) => p.chave)).toContain('desvio:obra')
  })
})

describe('respostasParaCliente', () => {
  it('só respostas atuais e não internas; ponto de dado oculto nunca entra', () => {
    const ps = pontosAExplicar(dados())
    const desvio = ps.find((p) => p.chave === 'desvio:obra')!
    const exec = ps.find((p) => p.chave === 'execucao:77')!
    const oculto = ps.find((p) => p.chave === 'impedimento:oculto')!
    const entrega = ps.find((p) => p.chave === 'entrega:obra')!
    const r = respostasParaCliente(ps, [
      salva(desvio, { resposta: 'Segunda equipe desde 23/11.' }),
      salva(exec, { resposta: 'Fornecedor X é do setor de compras', interno: true }),
      salva(oculto, { resposta: 'Pedreiro faltou de novo' }),
      salva(entrega, { impressao: 'outra-data', resposta: 'Velha' }),
    ])
    expect(r).toEqual([{ fato: desvio.fato, resposta: 'Segunda equipe desde 23/11.' }])
  })
})
