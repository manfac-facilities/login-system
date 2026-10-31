/** Faixa de alertas do painel (Leva 3 §2.4). */
import { calcularAlertas } from '../alertas'
import type { AtividadeCalculada, ResultadoCronograma } from '../cronograma'
import type { Restricao } from '../last-planner'

const ativ = (numero: number, situacao: AtividadeCalculada['situacao']) => ({ numero, situacao }) as AtividadeCalculada
const calc = (desvioPP: number, atividades: AtividadeCalculada[] = []): ResultadoCronograma => ({
  atividades, previsto: 0.5, realizado: 0.5, desvioPP, terminoPrevisto: '2026-12-01', terminoProjetado: '2026-12-01',
})
const restricao = (over: Partial<Restricao>): Restricao => ({
  id: 'r', obraId: 'o1', atividadeNumero: 1, tipo: 'decisao_cliente', descricao: 'x', responsavel: 'cliente',
  prazo: null, situacao: 'identificada', liberadaEm: null, criadoPor: null, criadoEm: 'x', ...over,
})

// Quarta 28/10/2026; semana de 26/10, sexta 30/10.
const base = {
  obraId: 'o1', hoje: '2026-10-28', calc: calc(0, [ativ(9, 'no_prazo')]), baseSalva: true, dataBase: '2026-10-01',
  feriados: new Set<string>(), ultimoDiarioEnviado: '2026-10-27' as string | null,
  semanais: [{ semanaInicio: '2026-10-19', estado: 'enviado' }], restricoes: [] as Restricao[],
}
const ids = (p: Partial<typeof base>) => calcularAlertas({ ...base, ...p }).map((a) => a.id)

describe('calcularAlertas', () => {
  it('obra em dia: nenhum alerta', () => {
    expect(ids({})).toEqual([])
  })

  it('atrasadas → comunicar o cliente hoje, com atalho para Comunicação', () => {
    const a = calcularAlertas({ ...base, calc: calc(0, [ativ(1, 'atrasada'), ativ(2, 'inicio_atrasado'), ativ(3, 'no_prazo')]) })
    expect(a[0]).toMatchObject({ id: 'atrasadas', texto: '2 atividades atrasadas — comunicar o cliente hoje', acao: { href: '/obras/obras/o1/comunicacao' } })
  })

  it('desvio < −5 p.p. alerta; −5 exato não', () => {
    expect(ids({ calc: calc(-5.2) })).toEqual(['desvio'])
    expect(ids({ calc: calc(-5) })).toEqual([])
  })

  it('obra com todas as atividades concluídas: não cobra diário', () => {
    const fim = { ...ativ(9, 'no_prazo'), status: 'concluido' } as AtividadeCalculada
    expect(ids({ ultimoDiarioEnviado: null, calc: calc(0, [fim]) })).not.toContain('diario')
  })

  it('diário do último dia útil sem envio; segunda olha a sexta; feriado pula', () => {
    expect(ids({ ultimoDiarioEnviado: '2026-10-26' })).toEqual(['diario'])
    expect(ids({ ultimoDiarioEnviado: null })).toEqual(['diario'])
    // Segunda 02/11: o dia útil anterior é sexta 30/10.
    const seg = { hoje: '2026-11-02', semanais: [{ semanaInicio: '2026-10-26', estado: 'enviado' }] }
    expect(ids({ ...seg, ultimoDiarioEnviado: '2026-10-30' })).toEqual([])
    expect(ids({ ...seg, ultimoDiarioEnviado: '2026-10-29' })).toEqual(['diario'])
    expect(ids({ ...seg, ultimoDiarioEnviado: '2026-10-29', feriados: new Set(['2026-10-30']) })).toEqual([])
    // Obra que começa hoje não cobra diário de ontem.
    expect(ids({ dataBase: '2026-10-28', ultimoDiarioEnviado: null })).toEqual([])
  })

  it('semanal: cobra a semana passada até a data de envio, depois a atual', () => {
    expect(ids({ semanais: [] })).toEqual(['semanal']) // semana de 19/10 sem envio
    const sexta = { hoje: '2026-10-30', ultimoDiarioEnviado: '2026-10-29' }
    expect(calcularAlertas({ ...base, ...sexta }).find((a) => a.id === 'semanal')).toMatchObject({
      texto: 'Semanal de 30/10 não enviado', acao: { href: '/obras/obras/o1/comunicacao/semanal?semana=2026-10-26' },
    })
    expect(ids({ ...sexta, semanais: [{ semanaInicio: '2026-10-26', estado: 'enviado' }] })).toEqual([])
    // Feriado na sexta: a data de envio antecipa para quinta.
    expect(ids({ hoje: '2026-10-29', ultimoDiarioEnviado: '2026-10-28', feriados: new Set(['2026-10-30']) })).toEqual(['semanal'])
    // Sem base salva, nada de diário/semanal.
    expect(ids({ semanais: [], baseSalva: false, ultimoDiarioEnviado: null })).toEqual([])
  })

  it('restrições: do cliente em aberto e vencidas; liberada não conta', () => {
    const restricoes = [
      restricao({ id: 'a' }),
      restricao({ id: 'b', prazo: '2026-10-27', responsavel: 'manfac' }),
      restricao({ id: 'c', prazo: '2026-10-20', situacao: 'liberada' }),
    ]
    const a = calcularAlertas({ ...base, restricoes })
    expect(a.map((x) => x.texto)).toEqual(['1 decisão/restrição aguardando o cliente', '1 restrição vencida'])
    expect(ids({ restricoes: [restricao({ situacao: 'liberada' })] })).toEqual([])
  })
})
