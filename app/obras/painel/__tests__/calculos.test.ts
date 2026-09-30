/**
 * Painel gerencial — as contas (spec-painel-gerencial-2026-09-29, seção Testes).
 * Tudo aqui é função pura: linhas do banco + "hoje" entram, números saem.
 */
import type { ObraRow } from '../../_lib/tipos'
import {
  SEM_CLIENTE,
  carteiraEm,
  chaveCliente,
  faturadoEntre,
  metasDe,
  montarPainel,
  periodoDo,
  type Entrada,
  type LinhaDiario,
  type ObraPainel,
} from '../_calculos'

const HOJE = '2026-09-29'

let seq = 0
function obra(over: Partial<ObraRow> & { cliente?: string | null } = {}): ObraPainel {
  seq++
  return {
    id: 'o' + seq,
    os: 'OS-' + seq,
    loja: 'Loja ' + seq,
    descricao: null,
    tipo: 'CIVIL',
    valor: 1000,
    origem: null,
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: null,
    pcm: 'YURI',
    equipe: 'MANFAC-7',
    os_aprovada: true,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: null,
    aprovacao: null,
    inicio_plan: null,
    inicio_real: null,
    duracao: null,
    fim_real: null,
    desde_etapa: null,
    marco_exec_fim: null,
    marco_relatorio: null,
    marco_os_aprov: null,
    marco_fechou_os: null,
    marco_liberou_fat: null,
    marco_faturou: null,
    pendencia: null,
    pend_resp: null,
    pend_prazo: null,
    prox_acao: null,
    atualizacao: null,
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-06-01T12:00:00Z',
    updated_at: null,
    cliente: 'DPSP',
    ...over,
  }
}

function entrada(obras: ObraPainel[], extra: Partial<Entrada> = {}): Entrada {
  return { obras, diario: [], tarefas: [], remarcacoes: [], hoje: HOJE, ...extra }
}

const TODOS = { cliente: null, mes: '2026-09', cmp: 'prev' as const }

describe('período', () => {
  it('mês em curso compara com os mesmos dias do mês anterior', () => {
    const p = periodoDo('2026-09', 'prev', HOJE)
    expect(p).toMatchObject({ a: '2026-09-01', b: '2026-09-29', fim: '2026-09-30', parcial: true })
    expect(p).toMatchObject({ pa: '2026-08-01', pb: '2026-08-29' })
    expect(p).toMatchObject({ ya: '2026-01-01', pya: '2025-01-01', pyb: '2025-09-29' })
  })

  it('ano anterior e mês fechado', () => {
    expect(periodoDo('2026-09', 'yoy', HOJE)).toMatchObject({ pa: '2025-09-01', pb: '2025-09-29' })
    // agosto fechado (31 dias) comparado com julho inteiro
    expect(periodoDo('2026-08', 'prev', HOJE)).toMatchObject({
      a: '2026-08-01',
      b: '2026-08-31',
      parcial: false,
      pa: '2026-07-01',
      pb: '2026-07-31',
    })
    // março (31) contra fevereiro (28): não passa do fim de fevereiro
    expect(periodoDo('2026-03', 'prev', HOJE)).toMatchObject({ pa: '2026-02-01', pb: '2026-02-28' })
  })
})

describe('carteira', () => {
  it('hoje: tudo que não foi faturado nem cancelado', () => {
    const obras = [
      obra({ etapa: 'definir', valor: 100 }),
      obra({ etapa: 'andamento', valor: 200 }),
      obra({ etapa: 'pendFat', valor: 300 }),
      obra({ etapa: 'faturado', valor: 400, marco_faturou: '2026-09-10' }),
      obra({ etapa: 'cancelado', valor: 500, cancelado_em: '2026-09-02T10:00:00Z' }),
    ]
    expect(carteiraEm(obras, HOJE, HOJE).map((o) => o.valor)).toEqual([100, 200, 300])
  })

  it('reconstruída no fim de um mês passado', () => {
    const fimAgo = '2026-08-31'
    const obras = [
      // entrou depois de agosto: fora
      obra({ id: 'nova', created_at: '2026-09-05T12:00:00Z' }),
      // entrou às 22h de 31/08 em SP (01/09 em UTC): dentro
      obra({ id: 'virada', created_at: '2026-09-01T01:00:00Z' }),
      // faturada em setembro: em agosto ainda estava na carteira
      obra({ id: 'fatSet', etapa: 'faturado', marco_faturou: '2026-09-03' }),
      // faturada em agosto: fora
      obra({ id: 'fatAgo', etapa: 'faturado', marco_faturou: '2026-08-20' }),
      // faturada sem data: não se sabe quando saiu, não pode inflar carteira passada
      obra({ id: 'fatSemData', etapa: 'faturado', marco_faturou: null }),
      // cancelada em setembro: em agosto estava na carteira
      obra({ id: 'cancSet', etapa: 'cancelado', cancelado_em: '2026-09-10T12:00:00Z' }),
      // cancelada em agosto: fora
      obra({ id: 'cancAgo', etapa: 'cancelado', cancelado_em: '2026-08-10T12:00:00Z' }),
    ]
    expect(carteiraEm(obras, fimAgo, HOJE).map((o) => o.id).sort()).toEqual(['cancSet', 'fatSet', 'virada'])
  })
})

describe('faturamento', () => {
  it('soma o valor das obras em Faturado pela data em que chegaram lá', () => {
    const obras = [
      obra({ etapa: 'faturado', valor: 100, marco_faturou: '2026-09-01' }),
      obra({ etapa: 'faturado', valor: 50, marco_faturou: '2026-08-31' }),
      obra({ etapa: 'faturado', valor: null, marco_faturou: '2026-09-02' }),
      obra({ etapa: 'pendFat', valor: 999, marco_faturou: null }),
    ]
    expect(faturadoEntre(obras, '2026-09-01', '2026-09-30')).toBe(100)
    expect(faturadoEntre(obras, '2026-01-01', '2026-09-30')).toBe(150)
  })

  it('KPIs do mês e do ano com a comparação', () => {
    const obras = [
      obra({ etapa: 'faturado', valor: 300, marco_faturou: '2026-09-10' }),
      obra({ etapa: 'faturado', valor: 100, marco_faturou: '2026-08-10' }),
      // depois do dia 29 de agosto: fora do "mesmo período"
      obra({ etapa: 'faturado', valor: 700, marco_faturou: '2026-08-30' }),
      obra({ etapa: 'faturado', valor: 40, marco_faturou: '2025-03-01' }),
      obra({ etapa: 'faturado', valor: 5, marco_faturou: '2025-12-01' }),
    ]
    const p = montarPainel(entrada(obras), TODOS)
    expect(p.kpis.faturamentoMes).toEqual({ valor: 300, anterior: 100 })
    expect(p.kpis.faturadoAno).toMatchObject({ valor: 1100, anterior: 40 })
  })
})

describe('metas', () => {
  it('só DPSP e D1000 têm meta; caixa não importa; Todos soma', () => {
    expect(metasDe(['dpsp'])).toEqual({ carteira: 600000, faturamento: 350000 })
    expect(metasDe([chaveCliente({ cliente: '  d1000 ' })])).toEqual({ carteira: 80000, faturamento: 60000 })
    expect(metasDe(['popeyes'])).toEqual({ carteira: null, faturamento: null })
    expect(metasDe(['dpsp', 'd1000', 'popeyes'])).toEqual({ carteira: 680000, faturamento: 410000 })
  })

  it('o painel usa a meta do filtro, e Todos soma a dos clientes cadastrados', () => {
    const obras = [obra({ cliente: 'DPSP' }), obra({ cliente: 'D1000' }), obra({ cliente: 'Popeyes' })]
    expect(montarPainel(entrada(obras), TODOS).metas).toEqual({ carteira: 680000, faturamento: 410000 })
    expect(montarPainel(entrada(obras), { ...TODOS, cliente: 'popeyes' }).metas).toEqual({
      carteira: null,
      faturamento: null,
    })
    // meta acumulada conta a partir de set/2026 (início dos dados), não de janeiro
    expect(montarPainel(entrada(obras), { ...TODOS, cliente: 'dpsp' }).kpis.faturadoAno).toMatchObject({
      metaAcumulada: 350000,
      metaDesde: '2026-09',
    })
    // no ano seguinte, volta a contar de janeiro
    const em2027 = montarPainel({ ...entrada(obras), hoje: '2027-03-15' }, { cliente: 'dpsp', mes: '2027-03', cmp: 'prev' })
    expect(em2027.kpis.faturadoAno).toMatchObject({ metaAcumulada: 350000 * 3, metaDesde: '2027-01' })
  })
})

describe('cliente', () => {
  it('coluna ausente ou nula vira "Sem cliente"', () => {
    const semColuna = obra()
    delete (semColuna as { cliente?: string | null }).cliente
    const p = montarPainel(entrada([semColuna, obra({ cliente: null })]), TODOS)
    expect(p.clientes).toEqual([{ chave: SEM_CLIENTE, nome: 'Sem cliente' }])
    expect(p.kpis.carteira.qtd).toBe(2)
  })

  it('filtro por cliente muda tudo, e Todos é a soma dos clientes', () => {
    const obras = [
      obra({ cliente: 'DPSP', etapa: 'andamento', valor: 100 }),
      obra({ cliente: 'dpsp ', etapa: 'pendFat', valor: 10 }),
      obra({ cliente: 'D1000', etapa: 'levantamento', valor: 1000 }),
      obra({ cliente: 'D1000', etapa: 'faturado', valor: 7, marco_faturou: '2026-09-05' }),
    ]
    const todos = montarPainel(entrada(obras), TODOS)
    const dpsp = montarPainel(entrada(obras), { ...TODOS, cliente: 'dpsp' })
    const d1000 = montarPainel(entrada(obras), { ...TODOS, cliente: 'd1000' })

    expect(todos.clientes.map((c) => c.nome)).toEqual(['D1000', 'DPSP'])
    expect(dpsp.kpis.carteira.valor).toBe(110)
    expect(d1000.kpis.carteira.valor).toBe(1000)
    expect(todos.kpis.carteira.valor).toBe(dpsp.kpis.carteira.valor + d1000.kpis.carteira.valor)
    expect(todos.kpis.faturamentoMes.valor).toBe(7)
    expect(dpsp.kpis.faturamentoMes.valor).toBe(0)
    expect(dpsp.resumo.total).toMatchObject({ qtd: 2, valor: 110 })

    // a tabela por cliente não segue o filtro, e a linha total é a soma
    expect(dpsp.porCliente.linhas.map((l) => l.carteira)).toEqual([1000, 110])
    expect(dpsp.porCliente.total).toMatchObject({ carteira: 1110, faturadoMes: 7, pendente: 10, pendenteQtd: 1 })
  })

  it('divide a carteira de hoje em a iniciar, andamento e pendente faturamento', () => {
    const obras = [
      obra({ etapa: 'definir', valor: 1 }),
      obra({ etapa: 'levantamento', valor: 2 }),
      obra({ etapa: 'andamento', valor: 4 }),
      obra({ etapa: 'fecharOS', valor: 8 }),
      obra({ etapa: 'pendFat', valor: 16 }),
    ]
    const k = montarPainel(entrada(obras), TODOS).kpis
    expect(k.carteira).toMatchObject({ valor: 31, qtd: 5, iniciar: 3, andamento: 12, pendFat: 16 })
    expect(k.pendente).toMatchObject({ valor: 16, qtd: 1 })
  })
})

describe('obra sem valor', () => {
  it('conta como R$ 0 e aparece como "sem valor", sem quebrar soma nenhuma', () => {
    const obras = [
      obra({ etapa: 'andamento', valor: null }),
      obra({ etapa: 'andamento', valor: 50 }),
      obra({ etapa: 'faturado', valor: null, marco_faturou: '2026-09-02', marco_liberou_fat: '2026-08-30' }),
    ]
    const p = montarPainel(entrada(obras), TODOS)
    expect(p.kpis.carteira).toMatchObject({ valor: 50, qtd: 2, semValor: 1 })
    expect(p.kpis.faturamentoMes.valor).toBe(0)
    expect(Number.isNaN(p.historico.meses.at(-1)!.valor)).toBe(false)
    expect(p.slaPendFat.concluidas[0].obra.semValor).toBe(true)
  })
})

describe('SLAs', () => {
  it('pendente faturamento: média, pior caso e quem ainda espera', () => {
    const obras = [
      obra({ id: 'a', etapa: 'faturado', marco_liberou_fat: '2026-09-01', marco_faturou: '2026-09-05' }),
      obra({ id: 'b', etapa: 'faturado', marco_liberou_fat: '2026-08-01', marco_faturou: '2026-09-10' }),
      // faturada fora do mês: não entra
      obra({ id: 'c', etapa: 'faturado', marco_liberou_fat: '2026-07-01', marco_faturou: '2026-08-10' }),
      obra({ id: 'w1', etapa: 'pendFat', valor: 10, marco_liberou_fat: '2026-09-19' }),
      obra({ id: 'w2', etapa: 'pendFat', valor: 20, marco_liberou_fat: '2026-08-30' }),
    ]
    const s = montarPainel(entrada(obras), TODOS).slaPendFat
    expect(s.media).toBe((4 + 40) / 2)
    expect(s.pior).toMatchObject({ dias: 40, obra: { id: 'b' } })
    expect(s.concluidas.map((c) => c.obra.id)).toEqual(['b', 'a'])
    expect(s.faixas.map((f) => f.qtd)).toEqual([1, 0, 0, 1])
    expect(s.esperando).toMatchObject({ qtd: 2, valor: 30, maisAntiga: { dias: 30, obra: { id: 'w2' } } })
    // mesmo período do mês anterior: c (40 dias)
    expect(s.mediaAnterior).toBe(40)
  })

  it('aprovação da OS: da liberação à aprovação; esperando = liberada sem aprovação', () => {
    const obras = [
      obra({ id: 'a', liberado_por: 'X', liberado_em: '2026-09-01', aprovacao: '2026-09-03' }),
      obra({ id: 'b', liberado_por: 'X', liberado_em: '2026-09-01', aprovacao: '2026-09-21' }),
      // aprovada antes de liberar: não é espera por aprovação
      obra({ id: 'neg', liberado_por: 'X', liberado_em: '2026-09-10', aprovacao: '2026-09-02' }),
      obra({ id: 'w', liberado_por: 'X', liberado_em: '2026-09-19', aprovacao: null, os_aprovada: false }),
      obra({ id: 'wc', etapa: 'cancelado', liberado_em: '2026-09-01', aprovacao: null, os_aprovada: false }),
    ]
    const s = montarPainel(entrada(obras), TODOS).slaOS
    expect(s.media).toBe(11)
    expect(s.pior).toMatchObject({ dias: 20, obra: { id: 'b' } })
    expect(s.esperando).toMatchObject({ qtd: 1, maisAntiga: { dias: 10, obra: { id: 'w' } } })
  })
})

describe('equipes', () => {
  const diario: LinhaDiario[] = [
    { obra_id: 'e1', data: '2026-09-02', andou: true, motivo: null, foto_path: null },
    { obra_id: 'e1', data: '2026-09-03', andou: true, motivo: null, foto_path: null },
    { obra_id: 'e1', data: '2026-09-04', andou: false, motivo: 'Clima', foto_path: null },
    { obra_id: 'e1', data: '2026-08-31', andou: true, motivo: null, foto_path: null },
    { obra_id: 'e2', data: '2026-09-10', andou: true, motivo: null, foto_path: null },
    { obra_id: 'e3', data: '2026-09-11', andou: true, motivo: null, foto_path: null },
    { obra_id: 'e3', data: '2026-09-12', andou: true, motivo: null, foto_path: null },
  ]
  const obras = [
    obra({ id: 'e1', equipe: 'Alfa', valor: 900, etapa: 'relatorio', marco_exec_fim: '2026-09-05' }),
    obra({ id: 'e2', equipe: ' alfa ', valor: 100, etapa: 'fecharOS', marco_exec_fim: '2026-09-11' }),
    // em execução: soma dias no mês, sem receita
    obra({ id: 'e3', equipe: 'Beta', valor: 5000, etapa: 'andamento' }),
    obra({ id: 'e4', equipe: 'Beta', valor: 300, etapa: 'relatorio', marco_exec_fim: '2026-09-20' }),
    obra({ id: 'e5', equipe: 'Beta', valor: 50, etapa: 'relatorio', marco_exec_fim: '2026-08-05' }),
  ]

  it('receita, dias e produtividade por equipe (caixa e espaço não separam a equipe)', () => {
    const eq = montarPainel(entrada(obras, { diario }), TODOS).equipes
    const alfa = eq.linhas.find((l) => l.nome === 'Alfa')!
    expect(alfa).toMatchObject({ receita: 1000, obrasConcluidas: 2, diasNessasObras: 4, diasNoMes: 3 })
    expect(alfa.produtividade).toBe(250)
    const beta = eq.linhas.find((l) => l.nome === 'Beta')!
    expect(beta).toMatchObject({ receita: 300, obrasConcluidas: 1, diasNessasObras: 0, diasNoMes: 2 })
    expect(beta.produtividade).toBeNull()
    expect(beta.receitaAnterior).toBe(50)
    expect(eq.linhas.map((l) => l.nome)).toEqual(['Alfa', 'Beta'])
    expect(eq.total).toMatchObject({ receita: 1300, obrasConcluidas: 3, diasNessasObras: 4, diasNoMes: 5 })
    expect(beta.obras.map((o) => [o.obra.id, o.situacao])).toEqual([
      ['e3', 'execucao'],
      ['e4', 'concluida'],
    ])
  })
})

describe('paradas, atrasadas e remarcadas (posição de hoje)', () => {
  it('motivo da parada: o bloqueio, ou o do último "não andou"', () => {
    const obras = [
      obra({ id: 'p1', etapa: 'paralisado', bloqueio: 'Clima', valor: 10 }),
      obra({ id: 'p2', etapa: 'paralisado', bloqueio: 'Sem bloqueio', valor: 20 }),
      obra({ id: 'p3', etapa: 'paralisado', bloqueio: null, valor: 30 }),
      obra({ id: 'x', etapa: 'andamento' }),
    ]
    const diario: LinhaDiario[] = [
      { obra_id: 'p2', data: '2026-09-20', andou: false, motivo: 'Clima', foto_path: null },
      { obra_id: 'p2', data: '2026-09-25', andou: false, motivo: 'Falta de material', foto_path: null },
      { obra_id: 'p2', data: '2026-09-26', andou: true, motivo: null, foto_path: null },
    ]
    const p = montarPainel(entrada(obras, { diario }), TODOS).paradas
    expect(p).toMatchObject({ qtd: 3, valor: 60 })
    expect(p.motivos.map((m) => [m.motivo, m.obras.length, m.valor])).toEqual([
      ['Sem motivo registrado', 1, 30],
      ['Falta de material', 1, 20],
      ['Clima', 1, 10],
    ])
  })

  it('% atrasadas e remarcadas das obras em campo', () => {
    const obras = [
      // atrasada: início 01/09 + 7 dias < hoje
      obra({ id: 'late', etapa: 'andamento', inicio_real: '2026-09-01', duracao: 7 }),
      // no prazo
      obra({ id: 'ok', etapa: 'andamento', inicio_real: '2026-09-25', duracao: 10 }),
      // remarcada, parada, no prazo
      obra({ id: 'rem', etapa: 'paralisado', inicio_real: '2026-09-28', duracao: 10 }),
      // fora de campo: não conta
      obra({ id: 'fora', etapa: 'levantamento', inicio_plan: '2026-01-01', duracao: 1 }),
    ]
    const remarcacoes = [
      { obra_id: 'rem', data: '2026-09-20', de: '2026-09-21', para: '2026-09-28', created_at: '2026-09-20T12:00:00Z' },
    ]
    const a = montarPainel(entrada(obras, { remarcacoes }), TODOS).atrasos
    expect(a).toMatchObject({ emCampo: 3, atrasadas: 1, remarcadas: 1 })
    expect(a.pctAtrasadas).toBeCloseTo(100 / 3)
    expect(a.categorias.map((c) => [c.k, c.obras.map((o) => o.obra.id)])).toEqual([
      ['ok', ['ok']],
      ['rem', ['rem']],
      ['late', ['late']],
      ['both', []],
    ])
    const late = a.categorias[2].obras[0]
    expect(late).toMatchObject({ diasAtraso: 21, fimPrevisto: '2026-09-08' })
    expect(a.categorias[1].obras[0].remarcacao).toBe('21/09/2026 → 28/09/2026')
  })
})

describe('ritmo do campo (hoje)', () => {
  it('diário e tarefas das obras do filtro, com as regras das telas Diário e Tarefas', () => {
    const obras = [
      obra({ id: 'r1', etapa: 'andamento', cliente: 'DPSP' }),
      obra({ id: 'r2', etapa: 'paralisado', cliente: 'DPSP' }),
      obra({ id: 'r3', etapa: 'levantamento', cliente: 'DPSP' }),
      obra({ id: 'r4', etapa: 'relatorio', cliente: 'DPSP' }),
      obra({ id: 'c1', etapa: 'cancelado', cliente: 'DPSP' }),
      obra({ id: 'd1', etapa: 'andamento', cliente: 'D1000' }),
    ]
    const diario: LinhaDiario[] = [
      { obra_id: 'r1', data: HOJE, andou: true, motivo: null, foto_path: 'f.jpg' },
      { obra_id: 'r2', data: HOJE, andou: false, motivo: 'Clima', foto_path: null },
      { obra_id: 'r3', data: '2026-09-28', andou: true, motivo: null, foto_path: null },
      { obra_id: 'd1', data: HOJE, andou: true, motivo: null, foto_path: 'x.jpg' },
    ]
    const tarefas = [
      { obra_id: 'r1', situacao: 'aberta' as const, prazo: HOJE, resposta_em: null },
      { obra_id: 'r1', situacao: 'aberta' as const, prazo: '2026-09-20', resposta_em: null },
      { obra_id: 'r2', situacao: 'respondida' as const, prazo: '2026-09-20', resposta_em: '2026-09-24' },
      { obra_id: 'r2', situacao: 'respondida' as const, prazo: '2026-09-01', resposta_em: '2026-09-02' },
      // aberta de obra cancelada: fora, como na tela Tarefas
      { obra_id: 'c1', situacao: 'aberta' as const, prazo: '2026-09-01', resposta_em: null },
      { obra_id: 'd1', situacao: 'aberta' as const, prazo: '2026-09-01', resposta_em: null },
    ]
    const r = montarPainel(entrada(obras, { diario, tarefas }), { ...TODOS, cliente: 'dpsp' }).ritmo
    expect(r).toEqual({
      esperados: 3,
      responderam: 2,
      naoAndou: 1,
      comFoto: 1,
      abertas: 2,
      vencidas: 1,
      respondidas7: 1,
    })
  })
})

describe('cronograma', () => {
  it('a iniciar, em campo e terminadas há até 14 dias; fora as sem data', () => {
    const obras = [
      obra({ id: 'ini', etapa: 'levantamento', inicio_plan: '2026-09-20', duracao: 5 }),
      obra({ id: 'campo', etapa: 'andamento', inicio_plan: '2026-09-01', inicio_real: '2026-09-03', duracao: 5 }),
      obra({ id: 'fim', etapa: 'relatorio', inicio_plan: '2026-09-01', inicio_real: '2026-09-01', duracao: 5, fim_real: '2026-09-20' }),
      obra({ id: 'velha', etapa: 'relatorio', inicio_real: '2026-06-01', duracao: 5, fim_real: '2026-06-10' }),
      obra({ id: 'semdata', etapa: 'andamento' }),
      obra({ id: 'fat', etapa: 'faturado', inicio_real: '2026-09-01', fim_real: '2026-09-20' }),
    ]
    const c = montarPainel(entrada(obras), TODOS).cronograma
    expect(c.linhas.map((l) => l.obra.id)).toEqual(['campo', 'fim', 'ini'])
    expect(c.semDatas).toBe(1)
    const ini = c.linhas.find((l) => l.obra.id === 'ini')!
    expect(ini).toMatchObject({ grupo: 'iniciar', atrasada: true, diasAtraso: 9, realIni: null })
    const campo = c.linhas.find((l) => l.obra.id === 'campo')!
    expect(campo).toMatchObject({ grupo: 'campo', atrasada: true, realFim: HOJE, emCurso: true })
    const fim = c.linhas.find((l) => l.obra.id === 'fim')!
    expect(fim).toMatchObject({ grupo: 'terminou', atrasada: false, terminouComAtraso: 14 })
  })
})

describe('histórico', () => {
  it('12 meses até o mês escolhido; antes do sistema é "sem dado", não R$ 0', () => {
    const obras = [
      obra({ etapa: 'faturado', valor: 100, marco_faturou: '2025-12-15', cliente: 'DPSP' }),
      obra({ etapa: 'faturado', valor: 20, marco_faturou: '2026-09-15', cliente: 'DPSP' }),
    ]
    const h = montarPainel(entrada(obras), TODOS).historico
    expect(h.meses).toHaveLength(12)
    expect(h.meses[0]).toMatchObject({ mes: '2025-10', semDado: true })
    expect(h.meses.find((m) => m.mes === '2026-08')).toMatchObject({ semDado: true })
    expect(h.meses.at(-1)).toMatchObject({
      mes: '2026-09',
      semDado: false,
      valor: 20,
      parcial: true,
      metaAcumulada: 350000,
    })
    // mês sem dado não conta como melhor mês nem entra na média
    expect(h.melhor).toMatchObject({ mes: '2026-09', valor: 20 })
    expect(h.fechados).toBe(0)
    expect(h.mediaFechados).toBe(0)
  })

  it('acumulado do ano recomeça em janeiro depois do primeiro ano', () => {
    const obras = [
      obra({ etapa: 'faturado', valor: 5, marco_faturou: '2026-12-10', cliente: 'DPSP' }),
      obra({ etapa: 'faturado', valor: 10, marco_faturou: '2027-01-15', cliente: 'DPSP' }),
      obra({ etapa: 'faturado', valor: 20, marco_faturou: '2027-02-15', cliente: 'DPSP' }),
    ]
    const h = montarPainel({ ...entrada(obras), hoje: '2027-02-20' }, { ...TODOS, mes: '2027-02' }).historico
    expect(h.meses.find((m) => m.mes === '2026-12')).toMatchObject({ acumulado: 5, semDado: false })
    expect(h.meses.at(-1)).toMatchObject({ acumulado: 30, metaAcumulada: 350000 * 2 })
    // fechados com dado: set, out, nov, dez/2026 e jan/2027
    expect(h.fechados).toBe(5)
    expect(h.mediaFechados).toBeCloseTo(15 / 5)
  })
})
