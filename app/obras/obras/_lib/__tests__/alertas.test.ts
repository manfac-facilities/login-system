/** Faixa de alertas do painel (Leva 3 §2.4; comunicações pela agenda na Leva 4). */
import type { ItemAgenda } from '../agenda'
import { calcularAlertas, hrefDoItem } from '../alertas'
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
const item = (tipo: ItemAgenda['tipo'], referencia: string, dataPrevista: string, situacao: ItemAgenda['situacao']): ItemAgenda => ({
  tipo, referencia, dataPrevista, dataReal: null, situacao,
})

const base = {
  obraId: 'o1', hoje: '2026-10-28', calc: calc(0, [ativ(9, 'no_prazo')]), agenda: [] as ItemAgenda[] | null, restricoes: [] as Restricao[],
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

  it('agenda: enviado, programado, antes do sistema e sem agenda (null) não alertam', () => {
    const agenda = [item('diario', '2026-10-27', '2026-10-27', 'no_prazo'), item('semanal', '2026-10-26', '2026-10-30', 'programado'), item('diario', '2026-10-26', '2026-10-26', 'com_atraso'), item('diario', '2026-10-25', '2026-10-25', 'antes_do_sistema')]
    expect(ids({ agenda })).toEqual([])
    expect(ids({ agenda: null })).toEqual([])
  })

  it('ATRASADO de um item: texto do item e link do rascunho (qualquer tipo)', () => {
    const d = calcularAlertas({ ...base, agenda: [item('diario', '2026-10-27', '2026-10-27', 'atrasado')] })
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ id: 'comunicacao_atrasada', texto: 'Diário de 27/10 atrasado, sem envio ao cliente', acao: { href: '/obras/obras/o1/diario?data=2026-10-27' } })
    const m = calcularAlertas({ ...base, agenda: [item('mensal', '2026-09', '2026-09-30', 'atrasado')] })
    expect(m[0]).toMatchObject({ texto: 'Mensal 09/2026 atrasado, sem envio ao cliente', acao: { href: '/obras/obras/o1/comunicacao/relatorio/mensal/2026-09' } })
  })

  it('vários ATRASADO: contagem, a mais antiga e link para a aba Agenda', () => {
    const a = calcularAlertas({
      ...base,
      agenda: [item('diario', '2026-10-26', '2026-10-26', 'atrasado'), item('semanal', '2026-10-19', '2026-10-23', 'atrasado'), item('diario', '2026-10-27', '2026-10-27', 'atrasado')],
    })
    expect(a[0]).toMatchObject({
      id: 'comunicacao_atrasada', texto: '3 comunicações atrasadas, a mais antiga: Diário de 26/10', acao: { href: '/obras/obras/o1/comunicacao?aba=agenda' },
    })
  })

  it('ENVIAR HOJE de qualquer tipo, separado do atrasado', () => {
    const a = calcularAlertas({
      ...base,
      agenda: [item('diario', '2026-10-27', '2026-10-27', 'atrasado'), item('diario', '2026-10-28', '2026-10-28', 'enviar_hoje'), item('semanal', '2026-10-26', '2026-10-28', 'enviar_hoje')],
    })
    expect(a.map((x) => x.id)).toEqual(['comunicacao_atrasada', 'comunicacao_hoje'])
    expect(a[1]).toMatchObject({ texto: 'Enviar hoje: Diário de 28/10, Semanal de 28/10', acao: { href: '/obras/obras/o1/comunicacao?aba=agenda' } })
    const u = calcularAlertas({ ...base, agenda: [item('entrega', 'entrega', '2026-10-28', 'enviar_hoje')] })
    expect(u[0]).toMatchObject({ texto: 'Enviar hoje: Relatório de entrega', acao: { href: '/obras/obras/o1/comunicacao/relatorio/entrega/entrega' } })
  })

  it('hrefDoItem por tipo', () => {
    expect(hrefDoItem('o1', { tipo: 'semanal', referencia: '2026-10-26' })).toBe('/obras/obras/o1/comunicacao/semanal?semana=2026-10-26')
    expect(hrefDoItem('o1', { tipo: 'fase', referencia: '3' })).toBe('/obras/obras/o1/comunicacao/relatorio/fase/3')
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

describe('calcularAlertas — medições > 10 dias (Fases B/C §2.4)', () => {
  const mc = (numero: number, enviadaEm: string, situacao = 'enviada', os: string | null = '100') => ({ numero, os, enviadaEm, situacao })
  it('medição ao cliente enviada há mais de 10 dias (dia BRT) → alerta sem R$; 10 dias ainda não', () => {
    // 2026-10-18T02:00Z = 17/10 em Brasília → 11 dias até 28/10
    const a = calcularAlertas({ ...base, medicoesCliente: [mc(2, '2026-10-18T02:00:00Z'), mc(3, '2026-10-18T12:00:00Z'), mc(1, '2026-09-01T12:00:00Z', 'aprovada')] })
    const m = a.find((x) => x.id === 'medicao_cliente')!
    expect(m.texto).toBe('Medição 2 da OS 100 há 11 dias aguardando o cliente')
    expect(m.texto).not.toMatch(/R\$/)
    expect(m.acao.href).toBe('/obras/obras/o1/financeiro/medicoes')
    expect(ids({ medicoesCliente: [mc(3, '2026-10-18T12:00:00Z')] } as never)).toEqual([])
  })
  it('várias medições ao cliente: conta e mostra a mais antiga', () => {
    const a = calcularAlertas({ ...base, medicoesCliente: [mc(2, '2026-10-10T12:00:00Z'), mc(1, '2026-10-01T12:00:00Z')] })
    expect(a.find((x) => x.id === 'medicao_cliente')!.texto).toBe('2 medições ao cliente há mais de 10 dias aguardando aprovação, a mais antiga há 27 dias')
  })
  it('medição de fornecedor > 10 dias → alerta com quem aprova; null/vazio sem alerta', () => {
    const a = calcularAlertas({ ...base, medicoesFornecedor: [{ fornecedor: 'Eletro Ltda', dias: 12, aguardando: 'engenheiro' }] })
    const m = a.find((x) => x.id === 'medicao_fornecedor')!
    expect(m.texto).toBe('Medição de fornecedor (Eletro Ltda) há 12 dias em aprovação — aguardando o engenheiro')
    expect(m.acao.href).toBe('/obras/obras/o1/financeiro')
    const v = calcularAlertas({ ...base, medicoesFornecedor: [{ fornecedor: null, dias: 12, aguardando: 'eduardo' }, { fornecedor: 'B', dias: 20, aguardando: 'eduardo' }] })
    expect(v.find((x) => x.id === 'medicao_fornecedor')!.texto).toBe('2 medições de fornecedor há mais de 10 dias em aprovação, a mais antiga há 20 dias')
    expect(ids({ medicoesFornecedor: null } as never)).toEqual([])
    expect(ids({ medicoesFornecedor: [] } as never)).toEqual([])
  })
})
