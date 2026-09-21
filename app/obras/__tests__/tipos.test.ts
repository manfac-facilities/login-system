/**
 * Testes das regras puras de app/obras/_lib/tipos.ts.
 *
 * Nada é mockado aqui de propósito: tipos.ts não importa Supabase, next/cache
 * nem lib/auth — é função pura sobre linha de banco. O padrão de mocks de
 * app/conversor-os/__tests__/_actions.test.ts vale para as _actions.ts das
 * frentes B, C e D, não para este arquivo.
 *
 * `hoje` é sempre passado explicitamente (2026-08-31, o HOJE do mockup) para o
 * teste não depender do relógio da máquina.
 */

import {
  ancoraDias,
  br,
  chaveDaEquipe,
  classeDias,
  critico,
  dataSP,
  derivar,
  destinoDe,
  diasDesde,
  diasSemOS,
  donoDa,
  encalhada,
  encerrada,
  estourou,
  faseDe,
  hojeISO,
  horaISO,
  liberada,
  LIMIAR_ATENCAO,
  LIMIAR_CRITICO,
  moeda,
  nomeDaEquipe,
  nomeEtapa,
  nomeFase,
  paradaTxt,
  pedeFoto,
  posCampo,
  prazoPadrao,
  prazoTxt,
  semCobertura,
  sev,
  sitTarefa,
  somaDias,
  travado,
  contadoresDoDiario,
  type Obra,
  type ObraRow,
  type TarefaRow,
} from '../_lib/tipos'

const HOJE = '2026-08-31'

function obraRow(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: 'o1',
    os: '0226-014989',
    loja: 'DP BAIRRO DE FATIMA',
    descricao: 'Forro do estoque caiu',
    tipo: 'TELHADO',
    valor: 28520.46,
    origem: 'Sistema DPSP',
    fonte: null,
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: 'LEANDRO',
    pcm: 'YURI',
    equipe: 'MANFAC-7',
    os_aprovada: true,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: null,
    aprovacao: '2026-04-30',
    inicio_plan: '2026-08-19',
    inicio_real: '2026-08-19',
    duracao: 7,
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
    atualizacao: '2026-08-20',
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-08-31T00:00:00Z',
    updated_at: null,
    ...over,
  }
}

function obra(over: Partial<ObraRow> = {}, hoje = HOJE): Obra {
  return derivar(obraRow(over), hoje)
}

describe('datas', () => {
  it('conta dias inteiros entre duas datas ISO', () => {
    expect(diasDesde('2026-08-31', HOJE)).toBe(0)
    expect(diasDesde('2026-08-30', HOJE)).toBe(1)
    expect(diasDesde('2026-04-30', HOJE)).toBe(123)
    // futuro conta negativo
    expect(diasDesde('2026-09-02', HOJE)).toBe(-2)
  })

  it('devolve null quando falta a data, em vez de fingir zero', () => {
    expect(diasDesde(null, HOJE)).toBeNull()
    expect(diasDesde('', HOJE)).toBeNull()
    expect(diasDesde('data ruim', HOJE)).toBeNull()
  })

  it('atravessa a virada do horário de verão sem errar um dia', () => {
    // O Brasil não tem mais horário de verão, mas a conta do mockup usa Date
    // local e erraria aqui. Esta é feita em UTC.
    expect(diasDesde('2026-10-17', '2026-10-19')).toBe(2)
    expect(diasDesde('2026-02-14', '2026-02-16')).toBe(2)
  })

  it('soma dias atravessando o fim do mês e do ano', () => {
    expect(somaDias('2026-08-19', 7)).toBe('2026-08-26')
    expect(somaDias('2026-08-31', 1)).toBe('2026-09-01')
    expect(somaDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somaDias(null, 3)).toBeNull()
    expect(somaDias('2026-08-31', null)).toBeNull()
  })

  it('formata data e moeda em português, e vazio vira travessão', () => {
    expect(br('2026-08-31')).toBe('31/08/2026')
    expect(br(null)).toBe('—')
    expect(moeda(28520.46)).toBe('R$ 28.520,46')
    expect(moeda(null)).toBe('—')
  })

  it('usa o dia de São Paulo, não o do relógio UTC do container', () => {
    // 06/09 às 01h UTC ainda é 05/09 às 22h em São Paulo. Sem isso, o diário
    // preenchido às 22h cairia no dia seguinte.
    expect(hojeISO(new Date('2026-09-06T01:00:00Z'))).toBe('2026-09-05')
    expect(hojeISO(new Date('2026-09-06T12:00:00Z'))).toBe('2026-09-06')
    expect(horaISO(new Date('2026-09-06T01:00:00Z'))).toBe('22:00')
  })
})

describe('ciclo de vida', () => {
  it('mapeia etapa para fase', () => {
    expect(faseDe(obraRow({ etapa: 'definir' }))).toBe('antes')
    expect(faseDe(obraRow({ etapa: 'andamento' }))).toBe('campo')
    expect(faseDe(obraRow({ etapa: 'fecharOS' }))).toBe('fechamento')
    expect(faseDe(obraRow({ etapa: 'faturado' }))).toBe('faturamento')
  })

  it('pós-campo é fechamento ou faturamento; encerrada é só faturado', () => {
    expect(posCampo(obraRow({ etapa: 'andamento' }))).toBe(false)
    expect(posCampo(obraRow({ etapa: 'relatorio' }))).toBe(true)
    expect(posCampo(obraRow({ etapa: 'pendFat' }))).toBe(true)
    expect(encerrada(obraRow({ etapa: 'pendFat' }))).toBe(false)
    expect(encerrada(obraRow({ etapa: 'faturado' }))).toBe(true)
  })

  it('só cobra foto de obra em campo', () => {
    expect(pedeFoto(obraRow({ etapa: 'andamento' }))).toBe(true)
    expect(pedeFoto(obraRow({ etapa: 'paralisado' }))).toBe(true)
    expect(pedeFoto(obraRow({ etapa: 'levantamento' }))).toBe(false)
    expect(pedeFoto(obraRow({ etapa: 'fecharOS' }))).toBe(false)
  })

  it('resolve o dono da bola para uma pessoa, não para um papel abstrato', () => {
    expect(donoDa(obraRow({ etapa: 'levantamento', pcm: 'YURI' }))).toBe('Responsável YURI')
    expect(donoDa(obraRow({ etapa: 'levantamento', pcm: null }))).toBe('Responsável a definir')
    expect(donoDa(obraRow({ etapa: 'definir', analista_cliente: 'LEANDRO' }))).toBe('Analista LEANDRO')
    expect(donoDa(obraRow({ etapa: 'andamento' }))).toBe('Equipe em campo')
    expect(donoDa(obraRow({ etapa: 'pendFat' }))).toBe('Cliente DPSP')
  })

  it('devolve os nomes aprovados de etapa e fase', () => {
    expect(nomeEtapa('aprovarOS')).toBe('Pendente fechamento')
    expect(nomeEtapa('definir')).toBe('Aguardando definição')
    expect(nomeFase('campo')).toBe('Executando')
  })
})

describe('derivar', () => {
  it('calcula dias, fim previsto e atraso', () => {
    const o = obra()
    expect(o.dias).toBe(123) // 30/04 → 31/08
    expect(o.fimCalc).toBe('2026-08-26') // 19/08 + 7
    expect(o.atraso).toBe(5)
  })

  it('conta o prazo consumido como "dia N de M", nunca como percentual', () => {
    const o = obra()
    expect(o.diaDe).toBe(13) // 12 dias corridos + 1
    expect(o.fracPrazo).toBeCloseTo(13 / 7)
    expect(prazoTxt(o)).toBe('dia 13 de 7')
  })

  it('no último dia do prazo (hoje == fimCalc) "dia N de M" não passa de M — o atraso ainda não bateu', () => {
    // inicio_real 19/08 + duracao 7 => fimCalc 26/08 (`somaDias(mockup:1107)`).
    // Nesse dia o atraso (mecanismo existente) ainda é 0 — a obra só fica
    // atrasada A PARTIR do dia seguinte. Antes da correção, diaDe contava
    // offset+1 sem olhar para isso e escrevia "dia 8 de 7" / 114% no mesmo
    // dia em que `atraso` diz que ainda está no prazo.
    const o = obra({}, '2026-08-26')
    expect(o.atraso).toBe(0)
    expect(o.diaDe).toBe(7)
    expect(o.fracPrazo).toBe(1)
    expect(prazoTxt(o)).toBe('dia 7 de 7')
  })

  it('obra genuinamente atrasada continua avançando o dia e passando de 100% — o atraso não fica escondido', () => {
    const o = obra({}, '2026-08-27') // 1 dia depois do fimCalc
    expect(o.atraso).toBe(1)
    expect(o.diaDe).toBe(9) // 8 dias corridos + 1, sem teto — já está atrasada de verdade
    expect(o.fracPrazo).toBeCloseTo(9 / 7)
    expect(prazoTxt(o)).toBe('dia 9 de 7')
  })

  it('sem duração planejada não inventa número', () => {
    const o = obra({ duracao: null })
    expect(o.diaDe).toBeNull()
    expect(o.fracPrazo).toBeNull()
    expect(prazoTxt(o)).toBe('sem prazo definido')
  })

  it('obra que já saiu de campo tem o prazo cumprido, e o atraso deixa de valer', () => {
    const o = obra({ etapa: 'fecharOS', desde_etapa: '2026-08-25' })
    expect(o.diaDe).toBe(7)
    expect(o.fracPrazo).toBe(1)
    expect(o.atraso).toBeNull()
    expect(prazoTxt(o)).toBe('prazo cumprido')
  })

  it('paradaEtapa só existe pós-campo, e cai em atualizacao quando não há desde_etapa', () => {
    expect(obra({ etapa: 'andamento' }).paradaEtapa).toBeNull()
    expect(obra({ etapa: 'fecharOS', desde_etapa: '2026-08-25' }).paradaEtapa).toBe(6)
    expect(obra({ etapa: 'fecharOS', desde_etapa: null, atualizacao: '2026-08-20' }).paradaEtapa).toBe(11)
  })

  it('não escreve derivado de volta na linha do banco', () => {
    const row = obraRow()
    derivar(row, HOJE)
    expect(row).not.toHaveProperty('dias')
    expect(row).not.toHaveProperty('fracPrazo')
  })
})

describe('crítico — acima de 30 dias contados da âncora', () => {
  const H = '2026-09-14'
  const sem = { aprovacao: null, liberado_por: null, liberado_em: null, duracao: null }

  it('30 dias ainda não é crítica; 31 é', () => {
    expect(critico(obra({ ...sem, aprovacao: '2026-08-15' }, H))).toBe(false) // 30
    expect(critico(obra({ ...sem, aprovacao: '2026-08-14' }, H))).toBe(true) // 31
  })

  it('liberada há 104 dias e aprovada hoje: continua crítica em 104', () => {
    const o = obra(
      { ...sem, liberado_por: 'JUAN', liberado_em: '2026-06-02', aprovacao: '2026-09-14' },
      H
    )
    expect(o.ancora).toEqual({ de: 'liberacao', data: '2026-06-02' })
    expect(o.diasAlerta).toBe(104)
    expect(critico(o)).toBe(true)
    // `dias` continua sendo desde a aprovação — não mudou de significado.
    expect(o.dias).toBe(0)
  })

  it('aprovação anterior à liberação: conta da aprovação', () => {
    const o = obra(
      { ...sem, aprovacao: '2026-08-10', liberado_por: 'LEANDRO', liberado_em: '2026-08-30' },
      H
    )
    expect(o.diasAlerta).toBe(35)
    expect(critico(o)).toBe(true)
  })

  it('aprovação posterior à liberação: conta da liberação, e 25 dias é atenção', () => {
    const o = obra(
      { ...sem, aprovacao: '2026-09-01', liberado_por: 'LEANDRO', liberado_em: '2026-08-20' },
      H
    )
    expect(o.diasAlerta).toBe(25)
    expect(critico(o)).toBe(false)
    expect(classeDias(o)).toBe('atencao')
  })

  it('sem aprovação nem liberação: conta da entrada', () => {
    const o = obra({ ...sem, created_at: '2026-07-01T13:00:00+00:00' }, H)
    expect(o.ancora).toEqual({ de: 'entrada', data: '2026-07-01' })
    expect(o.diasAlerta).toBe(75)
    expect(critico(o)).toBe(true)
  })

  it('caso 12 (decisão do João, 15/09): liberação lançada hoje NÃO derruba a contagem da entrada', () => {
    // Decisão do João de 15/09: registrar uma data nova nunca pode derrubar a
    // contagem, nem quando a data nova é a liberação. A entrada (01/07) segue
    // sendo a âncora porque é a mais antiga das três — liberação lançada hoje
    // não vira a mais antiga só por existir.
    const o = obra(
      {
        ...sem,
        liberado_por: 'JUAN',
        liberado_em: '2026-09-14',
        created_at: '2026-07-01T13:00:00+00:00',
      },
      H
    )
    expect(o.ancora).toEqual({ de: 'entrada', data: '2026-07-01' })
    expect(o.diasAlerta).toBe(75)
    expect(critico(o)).toBe(true)
  })

  it('sem âncora não há contagem nem crítica', () => {
    const o = obra({ ...sem, created_at: '' }, H)
    expect(o.diasAlerta).toBeNull()
    expect(critico(o)).toBe(false)
  })

  it('aguardando definição nunca é crítica, mesmo contando da entrada', () => {
    const o = obra({ ...sem, etapa: 'definir', created_at: '2026-07-01T13:00:00+00:00' }, H)
    expect(o.diasAlerta).toBe(75)
    expect(critico(o)).toBe(false)
  })

  it('obra encerrada nunca é crítica', () => {
    expect(critico(obra({ ...sem, aprovacao: '2026-01-01', etapa: 'faturado' }, H))).toBe(false)
  })

  it('pós-campo também vira crítica acima de 30', () => {
    const o = obra(
      { ...sem, aprovacao: '2026-08-01', etapa: 'fecharOS', desde_etapa: '2026-09-10' },
      H
    )
    expect(o.diasAlerta).toBe(44)
    expect(critico(o)).toBe(true)
  })

  it('data futura (spec A10): diasAlerta nunca fica negativo, o piso é 0', () => {
    // Decisão do coordenador para A10: diasAlerta tem piso em 0 — diferente do
    // derivado antigo `dias`, que a spec deixa contar negativo (§7, A10).
    // created_at inválido de propósito: sem ele, a entrada (mais antiga que a
    // aprovação futura) venceria como âncora antes de o piso entrar em jogo.
    const o = obra({ ...sem, aprovacao: '2026-09-20', created_at: '' }, H) // 6 dias no futuro
    expect(o.ancora).toEqual({ de: 'aprovacao', data: '2026-09-20' })
    expect(o.diasAlerta).toBe(0)
    expect(critico(o)).toBe(false)
    expect(classeDias(o)).toBe('')
  })
})

describe('estourou o prazo', () => {
  it('com duração, estoura acima de quatro vezes a duração', () => {
    // duracao 7 → limiar 28; dias vem de aprovacao
    expect(estourou(obra({ duracao: 7, aprovacao: '2026-08-03' }))).toBe(false) // 28 dias
    expect(estourou(obra({ duracao: 7, aprovacao: '2026-08-02' }))).toBe(true) // 29 dias
  })

  it('sem duração, estoura a partir de 120 dias', () => {
    expect(estourou(obra({ duracao: null, aprovacao: '2026-05-04' }))).toBe(false) // 119
    expect(estourou(obra({ duracao: null, aprovacao: '2026-05-03' }))).toBe(true) // 120
  })

  it('pós-campo e "aguardando definição" nunca estouram', () => {
    expect(estourou(obra({ etapa: 'fecharOS', aprovacao: '2026-01-01' }))).toBe(false)
    expect(estourou(obra({ etapa: 'definir', aprovacao: '2026-01-01' }))).toBe(false)
  })
})

describe('travado no bloqueio', () => {
  it('trava a partir de 3 dias no mesmo bloqueio', () => {
    expect(travado(obra({ bloqueada_dias: 2, bloqueio: 'Clima' }))).toBe(false)
    expect(travado(obra({ bloqueada_dias: 3, bloqueio: 'Clima' }))).toBe(true)
  })

  it('"Sem bloqueio" não é bloqueio, e null tampouco', () => {
    expect(travado(obra({ bloqueada_dias: 8, bloqueio: 'Sem bloqueio' }))).toBe(false)
    // Divergência deliberada do mockup: lá bloqueio nunca é null; aqui a coluna
    // é nullable, e null tem que valer como "sem bloqueio".
    expect(travado(obra({ bloqueada_dias: 8, bloqueio: null }))).toBe(false)
  })

  it('obra que já saiu de campo não fica travada em bloqueio de campo', () => {
    expect(travado(obra({ etapa: 'fecharOS', bloqueada_dias: 8, bloqueio: 'Clima' }))).toBe(false)
  })
})

describe('encalhada — as 89 obras executadas que não viraram dinheiro', () => {
  it('encalha a partir de 15 dias parada na mesma etapa de papel', () => {
    expect(encalhada(obra({ etapa: 'fecharOS', desde_etapa: '2026-08-17' }))).toBe(false) // 14
    expect(encalhada(obra({ etapa: 'fecharOS', desde_etapa: '2026-08-16' }))).toBe(true) // 15
  })

  it('obra em campo não encalha, e obra faturada não encalha mais', () => {
    expect(encalhada(obra({ etapa: 'andamento', atualizacao: '2026-01-01' }))).toBe(false)
    expect(encalhada(obra({ etapa: 'faturado', desde_etapa: '2026-01-01' }))).toBe(false)
  })
})

describe('autorização — os dois destravamentos são independentes', () => {
  it('sem cobertura é não ter nem OS nem liberação', () => {
    expect(semCobertura(obraRow({ os_aprovada: false, liberado_por: null }))).toBe(true)
    expect(semCobertura(obraRow({ os_aprovada: true, liberado_por: null }))).toBe(false)
    expect(semCobertura(obraRow({ os_aprovada: false, liberado_por: 'LEANDRO' }))).toBe(false)
  })

  it('obra aguardando definição não conta: ninguém foi a campo', () => {
    expect(semCobertura(obraRow({ os_aprovada: false, liberado_por: null, etapa: 'definir' }))).toBe(false)
  })

  it('obra faturada não conta mais', () => {
    expect(semCobertura(obraRow({ os_aprovada: false, liberado_por: null, etapa: 'faturado' }))).toBe(false)
  })

  it('liberada é ter alguém nomeado que autorizou', () => {
    expect(liberada(obraRow({ liberado_por: 'LEANDRO' }))).toBe(true)
    expect(liberada(obraRow({ liberado_por: null }))).toBe(false)
  })

  it('dias sem OS conta da liberação, e some quando a OS sai', () => {
    expect(diasSemOS(obraRow({ os_aprovada: true }), HOJE)).toBeNull()
    expect(
      diasSemOS(obraRow({ os_aprovada: false, liberado_em: '2026-08-21' }), HOJE)
    ).toBe(10)
    // sem liberação, cai para início real → planejado → aprovação
    expect(
      diasSemOS(
        obraRow({ os_aprovada: false, liberado_em: null, inicio_real: '2026-08-19' }),
        HOJE
      )
    ).toBe(12)
  })
})

describe('severidade — a ordem dos ifs é a regra', () => {
  it('encerrada ganha de tudo', () => {
    expect(sev(obra({ etapa: 'faturado', aprovacao: '2026-01-01' }))).toBe('encerrada')
  })

  it('crítica vem antes de sem cobertura', () => {
    const o = obra({ aprovacao: '2026-01-01', os_aprovada: false, liberado_por: null })
    expect(critico(o)).toBe(true)
    expect(semCobertura(o)).toBe(true)
    expect(sev(o)).toBe('critico')
  })

  it('sem cobertura pesa igual a crítica mesmo com poucos dias', () => {
    expect(
      sev(obra({ aprovacao: '2026-08-28', os_aprovada: false, liberado_por: null }))
    ).toBe('semCobertura')
  })

  it('aguardando definição é laranja, e vem antes das regras de campo', () => {
    expect(sev(obra({ etapa: 'definir', aprovacao: '2026-08-28' }))).toBe('definir')
  })

  it('pós-campo é azul, ou âmbar quando encalhada', () => {
    expect(
      sev(obra({ etapa: 'fecharOS', aprovacao: '2026-08-01', desde_etapa: '2026-08-28' }))
    ).toBe('posCampo')
    expect(
      sev(obra({ etapa: 'fecharOS', aprovacao: '2026-08-01', desde_etapa: '2026-08-01' }))
    ).toBe('encalhada')
  })

  it('paralisado, travado, estourado e atrasado são âmbar', () => {
    expect(sev(obra({ etapa: 'paralisado', aprovacao: '2026-08-28', inicio_real: '2026-08-28', duracao: 30 }))).toBe('atencao')
    expect(sev(obra({ aprovacao: '2026-08-28', bloqueada_dias: 4, bloqueio: 'Clima', inicio_real: '2026-08-28', duracao: 30 }))).toBe('atencao')
    // atrasada: fim previsto já passou
    expect(sev(obra({ aprovacao: '2026-08-28', inicio_real: '2026-08-20', duracao: 3 }))).toBe('atencao')
  })

  it('levantamento é azul e o resto é verde', () => {
    expect(sev(obra({ etapa: 'levantamento', aprovacao: '2026-08-28', inicio_plan: '2026-08-30', inicio_real: null, duracao: 30 }))).toBe('levantamento')
    expect(sev(obra({ aprovacao: '2026-08-28', inicio_real: '2026-08-30', duracao: 30 }))).toBe('ok')
  })
})

describe('contador de dias — atenção acima de 20, crítica acima de 30', () => {
  const H = '2026-09-14'
  // duracao null: com 7 (o padrão da fixture), estourou() pintaria âmbar
  // a partir de 29 dias e mascararia a fronteira.
  const sem = { aprovacao: null, liberado_por: null, liberado_em: null, duracao: null }

  it('20 não pinta; 21 e 30 são atenção; 31 é crítica', () => {
    expect(classeDias(obra({ ...sem, aprovacao: '2026-08-25' }, H))).toBe('') // 20
    expect(classeDias(obra({ ...sem, aprovacao: '2026-08-24' }, H))).toBe('atencao') // 21
    expect(classeDias(obra({ ...sem, aprovacao: '2026-08-15' }, H))).toBe('atencao') // 30
    expect(classeDias(obra({ ...sem, aprovacao: '2026-08-14' }, H))).toBe('critico') // 31
  })

  it('estourou continua pintando de âmbar com poucos dias', () => {
    // duracao 3 → estoura acima de 12 dias desde a APROVAÇÃO (`dias`, 13 > 12).
    // Correção (review M6): o `diasAlerta` real aqui é 15, não 13 — a entrada
    // da fixture (2026-08-30, default de `obraRow()`) é anterior à aprovação
    // (2026-09-01) e vence como âncora. 15 não passa de 20; o âmbar só pode
    // vir de `estourou()`, que é o que este teste prova.
    expect(classeDias(obra({ ...sem, aprovacao: '2026-09-01', duracao: 3 }, H))).toBe('atencao')
  })

  it('não pinta obra encerrada nem obra aguardando definição', () => {
    expect(classeDias(obra({ aprovacao: '2026-01-01', etapa: 'faturado' }))).toBe('')
    expect(classeDias(obra({ aprovacao: '2026-01-01', etapa: 'definir' }))).toBe('')
  })
})

describe('decisão 12 — encerrada por marco_faturou (Task 5, NÃO executada)', () => {
  // Bloqueada por decisão do coordenador (spec §7, A6/A7 e plano, Task 5): nada
  // grava `marco_faturou` hoje, e mergear `encerrada() = marco_faturou` antes
  // de a frente da esteira gravar essa data faz nenhuma obra voltar a encerrar.
  // Ver docs/cliente/2026-08-31-sistema-controle-de-obras/spec-regra-critica-2026-09-15.md
  // §3.5 (decisão 12) e §7 (A6, A7).
  it.todo(
    'encerrada() passa a depender de marco_faturou só depois de _actions.ts gravar essa coluna (decisão 12)'
  )
})

describe('texto de parada', () => {
  it('pós-campo conta dias na etapa, com plural certo', () => {
    expect(paradaTxt(obra({ etapa: 'fecharOS', desde_etapa: '2026-08-30' }))).toBe('1 dia nesta etapa')
    expect(paradaTxt(obra({ etapa: 'fecharOS', desde_etapa: '2026-08-25' }))).toBe('6 dias nesta etapa')
  })

  it('em campo conta dias sem andar, e diz quando andou', () => {
    expect(paradaTxt(obra({ nao_andou_seguidos: 1 }))).toBe('1 dia sem andar')
    expect(paradaTxt(obra({ nao_andou_seguidos: 6 }))).toBe('6 dias sem andar')
    expect(paradaTxt(obra({ nao_andou_seguidos: 0 }))).toBe('andou no último registro')
  })
})

describe('tarefas', () => {
  function tarefa(over: Partial<TarefaRow> = {}): TarefaRow {
    return {
      id: 't1',
      obra_id: 'o1',
      item: 'Material',
      dono: 'ROBERTA',
      aberta: '2026-08-28',
      hora_aberta: '18:12',
      prazo: '2026-08-29',
      registrou: 'YURI',
      situacao: 'aberta',
      resposta_em: null,
      resposta_hora: null,
      resumo: null,
      created_at: '2026-08-28T21:12:00Z',
      ...over,
    }
  }

  it('vencida é calculada, nunca gravada', () => {
    expect(sitTarefa(tarefa({ prazo: '2026-08-29' }), HOJE)).toBe('vencida')
    expect(sitTarefa(tarefa({ prazo: HOJE }), HOJE)).toBe('aberta')
    expect(sitTarefa(tarefa({ prazo: '2026-09-02' }), HOJE)).toBe('aberta')
    expect(sitTarefa(tarefa({ prazo: null }), HOJE)).toBe('aberta')
  })

  it('respondida ganha do prazo vencido', () => {
    expect(sitTarefa(tarefa({ situacao: 'respondida', prazo: '2026-01-01' }), HOJE)).toBe('respondida')
  })

  it('prazo padrão é o fim do dia, e o dia seguinte depois das 18h', () => {
    expect(prazoPadrao('2026-08-31', '17:59')).toBe('2026-08-31')
    expect(prazoPadrao('2026-08-31', '18:00')).toBe('2026-08-31')
    expect(prazoPadrao('2026-08-31', '18:01')).toBe('2026-09-01')
    expect(prazoPadrao('2026-08-31', null)).toBe('2026-08-31')
  })

  it('roteia a falta para quem resolve', () => {
    expect(destinoDe('Material')?.chave).toBe('ROBERTA')
    expect(destinoDe('Ferramenta')?.chave).toBe('YURI')
    expect(destinoDe('Equipe')?.chave).toBe('YURI')
    expect(destinoDe('Documento / ART')?.chave).toBe('YURI')
    expect(destinoDe('Outro')?.chave).toBe('YURI')
    expect(destinoDe('Foto')?.chave).toBe('__EQUIPE__')
    expect(destinoDe('Não faltou')).toBeNull()
  })

  it('marca como "padrão nosso" só o que o cliente não confirmou (decisão J)', () => {
    expect(destinoDe('Material')?.nosso).toBeUndefined()
    expect(destinoDe('Documento / ART')?.nosso).toBe(true)
    expect(destinoDe('Outro')?.nosso).toBe(true)
  })

  it('normaliza a equipe da obra em chave de pessoa', () => {
    expect(chaveDaEquipe(obraRow({ equipe: 'MANFAC-7' }))).toBe('EQ_MANFAC7')
    expect(chaveDaEquipe(obraRow({ equipe: 'DEFINIR' }))).toBe('EQ_EQUIPEADEFINIR')
    expect(chaveDaEquipe(obraRow({ equipe: null }))).toBe('EQ_EQUIPEADEFINIR')
    expect(nomeDaEquipe(obraRow({ equipe: 'DEFINIR' }))).toBe('Equipe a definir')
  })
})

describe('contadoresDoDiario — os números que ninguém digita', () => {
  it('obra sem nenhum registro fica zerada e sem bloqueio', () => {
    expect(contadoresDoDiario([])).toEqual({
      nao_andou_seguidos: 0,
      bloqueada_dias: 0,
      bloqueio: 'Sem bloqueio',
    })
  })

  it('andou hoje zera tudo, mesmo depois de dias parada', () => {
    const r = contadoresDoDiario([
      { andou: true, motivo: null },
      { andou: false, motivo: 'Falta de material' },
      { andou: false, motivo: 'Falta de material' },
    ])

    expect(r).toEqual({ nao_andou_seguidos: 0, bloqueada_dias: 0, bloqueio: 'Sem bloqueio' })
  })

  it('conta os registros seguidos sem andar e o tempo no mesmo bloqueio', () => {
    const r = contadoresDoDiario([
      { andou: false, motivo: 'Falta de material' },
      { andou: false, motivo: 'Falta de material' },
      { andou: false, motivo: 'Falta de material' },
      { andou: true, motivo: null },
    ])

    // 3 registros sem andar, os 3 pelo mesmo motivo — é o que `travado()` procura.
    expect(r).toEqual({
      nao_andou_seguidos: 3,
      bloqueada_dias: 3,
      bloqueio: 'Falta de material',
    })
  })

  it('bloqueio que muda reinicia a contagem do bloqueio, não a de dias sem andar', () => {
    const r = contadoresDoDiario([
      { andou: false, motivo: 'Clima' },
      { andou: false, motivo: 'Falta de material' },
      { andou: false, motivo: 'Falta de material' },
    ])

    expect(r).toEqual({
      nao_andou_seguidos: 3,
      bloqueada_dias: 1,
      bloqueio: 'Clima',
    })
  })

  it('fim de semana não quebra a sequência — conta registros, não dias de calendário', () => {
    // Sexta e segunda, sem registro no sábado e no domingo.
    const r = contadoresDoDiario([
      { andou: false, motivo: 'Falta de material' },
      { andou: false, motivo: 'Falta de material' },
    ])

    expect(r.nao_andou_seguidos).toBe(2)
    expect(r.bloqueada_dias).toBe(2)
  })

  it('motivo fora da lista não vira bloqueio', () => {
    const r = contadoresDoDiario([{ andou: false, motivo: 'qualquer coisa' }])

    expect(r).toEqual({ nao_andou_seguidos: 1, bloqueada_dias: 0, bloqueio: 'Sem bloqueio' })
  })
})

describe('dataSP — timestamptz vira o dia em São Paulo', () => {
  it('converte para o dia de São Paulo, não o dia UTC', () => {
    expect(dataSP('2026-09-15T01:30:00+00:00')).toBe('2026-09-14')
    expect(dataSP('2026-07-01T13:00:00Z')).toBe('2026-07-01')
    expect(dataSP('2026-08-25T02:00:00.123456+00:00')).toBe('2026-08-24')
  })

  it('atravessa a virada do mês e do ano (review M4)', () => {
    // dataSP delega a hojeISO/Intl.DateTimeFormat — a troca de mês e de ano é
    // feita pelo formatador, não por aritmética manual, mas a regra inteira
    // depende desta conversão, então ela ganha cobertura própria.
    expect(dataSP('2026-09-01T02:00:00+00:00')).toBe('2026-08-31')
    expect(dataSP('2026-01-01T02:00:00+00:00')).toBe('2025-12-31')
  })

  it('vazio ou lixo não vira data', () => {
    expect(dataSP(null)).toBeNull()
    expect(dataSP('')).toBeNull()
    expect(dataSP('lixo')).toBeNull()
  })
})

describe('ancoraDias — de que data os dias contam (decisão 5 revista)', () => {
  const sem = { aprovacao: null, liberado_por: null, liberado_em: null }

  it('só aprovação: conta da aprovação', () => {
    expect(ancoraDias(obraRow({ ...sem, aprovacao: '2026-08-10' }))).toEqual({
      de: 'aprovacao',
      data: '2026-08-10',
    })
  })

  it('só liberação: conta da liberação', () => {
    expect(
      ancoraDias(obraRow({ ...sem, liberado_por: 'JUAN', liberado_em: '2026-06-02' }))
    ).toEqual({ de: 'liberacao', data: '2026-06-02' })
  })

  it('liberação antes da aprovação: vale a liberação', () => {
    expect(
      ancoraDias(
        obraRow({ aprovacao: '2026-09-01', liberado_por: 'LEANDRO', liberado_em: '2026-08-20' })
      )
    ).toEqual({ de: 'liberacao', data: '2026-08-20' })
  })

  it('aprovação antes da liberação: vale a aprovação', () => {
    expect(
      ancoraDias(
        obraRow({ aprovacao: '2026-08-10', liberado_por: 'LEANDRO', liberado_em: '2026-08-30' })
      )
    ).toEqual({ de: 'aprovacao', data: '2026-08-10' })
  })

  it('mesma data nas duas: fica com a aprovação', () => {
    expect(
      ancoraDias(
        obraRow({ aprovacao: '2026-08-10', liberado_por: 'LEANDRO', liberado_em: '2026-08-10' })
      )
    ).toEqual({ de: 'aprovacao', data: '2026-08-10' })
  })

  it('data de liberação sem o nome de quem liberou não conta', () => {
    expect(
      ancoraDias(
        obraRow({ ...sem, liberado_em: '2026-06-02', created_at: '2026-07-01T13:00:00+00:00' })
      )
    ).toEqual({ de: 'entrada', data: '2026-07-01' })
  })

  it('nome de quem liberou sem data não inventa data (spec A4)', () => {
    expect(
      ancoraDias(
        obraRow({ ...sem, liberado_por: 'JUAN', created_at: '2026-07-01T13:00:00+00:00' })
      )
    ).toEqual({ de: 'entrada', data: '2026-07-01' })
  })

  it('sem aprovação nem liberação: conta da entrada, no dia de São Paulo', () => {
    expect(ancoraDias(obraRow({ ...sem, created_at: '2026-08-25T02:00:00+00:00' }))).toEqual({
      de: 'entrada',
      data: '2026-08-24',
    })
  })

  it('sem nenhuma data utilizável não há âncora', () => {
    expect(ancoraDias(obraRow({ ...sem, created_at: '' }))).toBeNull()
  })

  it('os limiares são os do cliente: acima de 20 e acima de 30', () => {
    expect(LIMIAR_ATENCAO).toBe(20)
    expect(LIMIAR_CRITICO).toBe(30)
  })
})

// ============================================================
// Regressão da regra da obra crítica — protege R13 e R14 da spec da ficha
// editável (18/09/2026). A ficha passa a gravar `liberado_por`, `liberado_em`,
// `aprovacao` e `inicio_plan`, que são exatamente as colunas que a âncora lê.
// A decisão do João de 15/09 é o que estes testes prendem: REGISTRAR UMA DATA
// NUNCA DERRUBA A CONTAGEM. Sem eles, uma mudança em `ancoraDias` passa em
// todos os testes acima e some com a obra parada da lista de críticas.
// ============================================================
describe('a ficha editável não pode derrubar a contagem da obra crítica', () => {
  // Entrada em 01/08, com HOJE = 31/08: 30 dias desde a entrada.
  const entrou01Ago = {
    aprovacao: null,
    liberado_por: null,
    liberado_em: null,
    created_at: '2026-08-01T13:00:00+00:00',
  }

  it('R14: registrar quem liberou, com data posterior à entrada, não reduz os dias', () => {
    const antes = obra(entrou01Ago)
    expect(antes.ancora).toEqual({ de: 'entrada', data: '2026-08-01' })
    expect(antes.diasAlerta).toBe(30)

    const depois = obra({ ...entrou01Ago, liberado_por: 'LEANDRO', liberado_em: '2026-08-20' })
    expect(depois.diasAlerta).toBe(30)
    expect(depois.ancora).toEqual({ de: 'entrada', data: '2026-08-01' })
  })

  it('R14: registrar a aprovação da OS depois também não reduz os dias', () => {
    const depois = obra({
      ...entrou01Ago,
      liberado_por: 'LEANDRO',
      liberado_em: '2026-08-20',
      aprovacao: '2026-08-25',
    })
    expect(depois.diasAlerta).toBe(30)
    expect(depois.ancora).toEqual({ de: 'entrada', data: '2026-08-01' })
  })

  it('R14: aprovação ANTERIOR à entrada aumenta os dias — a âncora é a mais antiga das três', () => {
    const o = obra({ ...entrou01Ago, aprovacao: '2026-07-01' })
    expect(o.ancora).toEqual({ de: 'aprovacao', data: '2026-07-01' })
    expect(o.diasAlerta).toBe(61)
  })

  it('R13: mudar o início planejado não mexe na âncora, nos dias, no crítico nem na severidade', () => {
    const base = { ...entrou01Ago, etapa: 'andamento' as const, inicio_plan: '2026-08-19' }
    const antes = obra(base)
    const remarcada = obra({ ...base, inicio_plan: '2026-09-10' })

    expect(remarcada.ancora).toEqual(antes.ancora)
    expect(remarcada.diasAlerta).toBe(antes.diasAlerta)
    expect(critico(remarcada)).toBe(critico(antes))
    expect(sev(remarcada)).toBe(sev(antes))
  })

  it('a fronteira do crítico não pode regredir: 30 dias não é crítica, 31 é', () => {
    const naFronteira = obra({ ...entrou01Ago, etapa: 'andamento' })
    expect(naFronteira.diasAlerta).toBe(30)
    expect(critico(naFronteira)).toBe(false)

    const umDiaDepois = obra(
      { ...entrou01Ago, etapa: 'andamento' },
      '2026-09-01'
    )
    expect(umDiaDepois.diasAlerta).toBe(31)
    expect(critico(umDiaDepois)).toBe(true)
  })
})
