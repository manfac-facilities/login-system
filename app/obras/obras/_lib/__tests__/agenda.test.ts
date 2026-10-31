/**
 * Agenda de comunicação (Leva 4 §2.2, regras literais do SGO) e período do mensal.
 * Review Focus 1 (último dia útil feriado), 2 (fase não concluída = Programado),
 * 3 (envio casa por tipo + referência quando o cronograma muda).
 */
import { agendaDaObra, periodoMensal, ultimoDiaUtilDoMes, type ItemAgenda } from '../agenda'

const sem = new Set<string>()
const base = {
  dataBase: '2026-10-26', // segunda
  terminoProjetado: '2026-11-06', // sexta
  obraConcluida: false,
  etapas: [] as { referencia: string; nome: string; fimPrevisto: string; concluida: boolean }[],
  feriados: sem as ReadonlySet<string>,
  envios: [] as { tipo: string; referencia: string | null; enviadoEm: string }[],
  hojeIso: '2026-10-20',
}
const doTipo = (a: ItemAgenda[], t: ItemAgenda['tipo']) => a.filter((i) => i.tipo === t)

describe('ultimoDiaUtilDoMes / periodoMensal', () => {
  it('último dia do mês no fim de semana volta para a sexta', () => {
    expect(ultimoDiaUtilDoMes('2026-10', sem)).toBe('2026-10-30') // 31 é sábado
    expect(ultimoDiaUtilDoMes('2026-11', sem)).toBe('2026-11-30') // segunda
  })

  it('último dia útil feriado da obra: o dia útil anterior (Review Focus 1)', () => {
    expect(ultimoDiaUtilDoMes('2026-11', new Set(['2026-11-30']))).toBe('2026-11-27')
    expect(ultimoDiaUtilDoMes('2026-11', new Set(['2026-11-30', '2026-11-27']))).toBe('2026-11-26')
  })

  it('período: do 1º dia (ou da data-base) ao último dia útil', () => {
    expect(periodoMensal('2026-11', '2026-10-26', sem)).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
    expect(periodoMensal('2026-10', '2026-10-26', sem)).toEqual({ inicio: '2026-10-26', fim: '2026-10-30' })
    expect(periodoMensal('2026-11', '2026-10-26', new Set(['2026-11-30']))).toEqual({ inicio: '2026-11-01', fim: '2026-11-27' })
  })
})

describe('agendaDaObra — datas', () => {
  it('diários: cada dia útil de dataBase até o término (sem feriado)', () => {
    const a = agendaDaObra({ ...base, feriados: new Set(['2026-11-02']) })
    const d = doTipo(a, 'diario')
    expect(d.map((i) => i.referencia)).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
      '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
    ])
    expect(d.every((i) => i.dataPrevista === i.referencia)).toBe(true)
  })

  it('semanais: sextas da primeira ≥ dataBase até término + 7, antecipando feriado; referência = segunda', () => {
    const a = agendaDaObra({ ...base, feriados: new Set(['2026-11-13']) })
    expect(doTipo(a, 'semanal').map((i) => [i.referencia, i.dataPrevista])).toEqual([
      ['2026-10-26', '2026-10-30'],
      ['2026-11-02', '2026-11-06'],
      ['2026-11-09', '2026-11-12'], // sexta 13 feriado → quinta
    ])
  })

  it('semanal: dataBase no sábado começa na sexta seguinte', () => {
    const a = agendaDaObra({ ...base, dataBase: '2026-10-31' })
    expect(doTipo(a, 'semanal')[0]).toMatchObject({ referencia: '2026-11-02', dataPrevista: '2026-11-06' })
  })

  it('mensais: último dia útil de cada mês até o mês do término; feriado no último dia útil antecipa', () => {
    const a = agendaDaObra({ ...base, terminoProjetado: '2026-12-10', feriados: new Set(['2026-11-30']) })
    expect(doTipo(a, 'mensal').map((i) => [i.referencia, i.dataPrevista])).toEqual([
      ['2026-10', '2026-10-30'],
      ['2026-11', '2026-11-27'],
      ['2026-12', '2026-12-31'],
    ])
  })

  it('mensal: mês da data-base cujo último dia útil já passou não entra', () => {
    const a = agendaDaObra({ ...base, dataBase: '2026-10-31', terminoProjetado: '2026-11-20' })
    expect(doTipo(a, 'mensal').map((i) => i.referencia)).toEqual(['2026-11'])
  })

  it('fase: maior fimPrevisto da etapa, referência da etapa; entrega = término projetado', () => {
    const a = agendaDaObra({
      ...base,
      etapas: [
        { referencia: '1', nome: 'Demolição', fimPrevisto: '2026-10-28', concluida: true },
        { referencia: '2', nome: 'Alvenaria', fimPrevisto: '2026-11-04', concluida: false },
      ],
    })
    expect(doTipo(a, 'fase').map((i) => [i.referencia, i.dataPrevista])).toEqual([['1', '2026-10-28'], ['2', '2026-11-04']])
    expect(doTipo(a, 'entrega')).toEqual([{ tipo: 'entrega', referencia: 'entrega', dataPrevista: '2026-11-06', dataReal: null, situacao: 'programado' }])
  })

  it('ordenada por data e tipo; sem data-base não há item calculado', () => {
    const a = agendaDaObra(base)
    const datas = a.map((i) => i.dataPrevista)
    expect([...datas].sort()).toEqual(datas)
    const sexta = a.filter((i) => i.dataPrevista === '2026-10-30').map((i) => i.tipo)
    expect(sexta).toEqual(['diario', 'semanal', 'mensal'])
    expect(agendaDaObra({ ...base, dataBase: null })).toEqual([])
  })
})

describe('agendaDaObra — situação', () => {
  const hoje = '2026-10-28'
  it('Programado (futuro), ENVIAR HOJE (hoje), ATRASADO (passou sem envio)', () => {
    const d = doTipo(agendaDaObra({ ...base, hojeIso: hoje }), 'diario')
    expect(d.find((i) => i.referencia === '2026-10-27')!.situacao).toBe('atrasado')
    expect(d.find((i) => i.referencia === '2026-10-28')!.situacao).toBe('enviar_hoje')
    expect(d.find((i) => i.referencia === '2026-10-29')!.situacao).toBe('programado')
  })

  it('enviado no prazo × com atraso, pela data em São Paulo do primeiro envio', () => {
    const a = agendaDaObra({
      ...base, hojeIso: hoje,
      envios: [
        // 23h30 de 26/10 em SP = 02h30 UTC de 27/10: no prazo.
        { tipo: 'diario', referencia: '2026-10-26', enviadoEm: '2026-10-27T02:30:00Z' },
        { tipo: 'diario', referencia: '2026-10-27', enviadoEm: '2026-10-28T14:00:00Z' },
        { tipo: 'diario', referencia: '2026-10-27', enviadoEm: '2026-10-29T14:00:00Z' }, // reenvio não muda
      ],
    })
    const d = doTipo(a, 'diario')
    expect(d.find((i) => i.referencia === '2026-10-26')).toMatchObject({ dataReal: '2026-10-26', situacao: 'no_prazo' })
    expect(d.find((i) => i.referencia === '2026-10-27')).toMatchObject({ dataReal: '2026-10-28', situacao: 'com_atraso' })
    expect(d.filter((i) => i.referencia === '2026-10-27')).toHaveLength(1)
  })

  it('fase de etapa não concluída fica Programado mesmo com a data passada (Review Focus 2)', () => {
    const a = agendaDaObra({
      ...base, hojeIso: '2026-11-10',
      etapas: [
        { referencia: '1', nome: 'Demolição', fimPrevisto: '2026-10-28', concluida: false },
        { referencia: '2', nome: 'Alvenaria', fimPrevisto: '2026-10-28', concluida: true },
      ],
    })
    expect(doTipo(a, 'fase').map((i) => i.situacao)).toEqual(['programado', 'atrasado'])
  })

  it('cronograma muda: envio casa por tipo + referência, não duplica nem some (Review Focus 3)', () => {
    const envios = [
      { tipo: 'fase', referencia: '2', enviadoEm: '2026-11-04T15:00:00Z' },
      { tipo: 'semanal', referencia: '2026-11-09', enviadoEm: '2026-11-13T15:00:00Z' },
      { tipo: 'mensal', referencia: '2026-11', enviadoEm: '2026-11-30T15:00:00Z' },
    ]
    const etapa = (fim: string) => ({ referencia: '2', nome: 'Alvenaria', fimPrevisto: fim, concluida: true })
    const antes = agendaDaObra({ ...base, terminoProjetado: '2026-11-30', hojeIso: '2026-12-01', etapas: [etapa('2026-11-04')], envios })
    expect(doTipo(antes, 'fase')).toEqual([{ tipo: 'fase', referencia: '2', dataPrevista: '2026-11-04', dataReal: '2026-11-04', situacao: 'no_prazo' }])

    // Etapa 2 replanejada para antes; término encurtou (a semana de 09/11 e o mês 11 saem do cálculo).
    const depois = agendaDaObra({ ...base, terminoProjetado: '2026-10-30', hojeIso: '2026-12-01', etapas: [etapa('2026-10-29')], envios })
    expect(doTipo(depois, 'fase')).toEqual([{ tipo: 'fase', referencia: '2', dataPrevista: '2026-10-29', dataReal: '2026-11-04', situacao: 'com_atraso' }])
    expect(doTipo(depois, 'semanal').filter((i) => i.referencia === '2026-11-09')).toEqual([
      { tipo: 'semanal', referencia: '2026-11-09', dataPrevista: '2026-11-13', dataReal: '2026-11-13', situacao: 'no_prazo' },
    ])
    expect(doTipo(depois, 'mensal').filter((i) => i.referencia === '2026-11')).toEqual([
      { tipo: 'mensal', referencia: '2026-11', dataPrevista: '2026-11-30', dataReal: '2026-11-30', situacao: 'no_prazo' },
    ])

    // Etapa removida do cronograma: o envio feito continua.
    const semEtapa = agendaDaObra({ ...base, hojeIso: '2026-12-01', etapas: [], envios })
    expect(doTipo(semEtapa, 'fase')).toEqual([{ tipo: 'fase', referencia: '2', dataPrevista: '2026-11-04', dataReal: '2026-11-04', situacao: 'no_prazo' }])
  })

  it('obra atrasada ainda em andamento: diários seguem até o término projetado e a entrega não fica ATRASADO', () => {
    // Plano terminava em 06/11; a projeção do motor (calc.terminoProjetado) foi para 13/11.
    const a = agendaDaObra({ ...base, terminoProjetado: '2026-11-13', hojeIso: '2026-11-10' })
    expect(doTipo(a, 'diario').map((i) => i.referencia)).toContain('2026-11-12')
    expect(doTipo(a, 'semanal').map((i) => i.referencia)).toContain('2026-11-16') // até término + 7
    expect(doTipo(a, 'entrega')[0]).toMatchObject({ dataPrevista: '2026-11-13', situacao: 'programado' })
    // Status desatualizado (projeção já passou) com a obra não concluída: continua Programado.
    expect(doTipo(agendaDaObra({ ...base, hojeIso: '2026-11-20' }), 'entrega')[0].situacao).toBe('programado')
    // Concluída: segue a regra geral.
    expect(doTipo(agendaDaObra({ ...base, obraConcluida: true, hojeIso: '2026-11-06' }), 'entrega')[0].situacao).toBe('enviar_hoje')
    expect(doTipo(agendaDaObra({ ...base, obraConcluida: true, hojeIso: '2026-11-09' }), 'entrega')[0].situacao).toBe('atrasado')
  })

  it('envio de tipo fora da agenda ou sem referência é ignorado', () => {
    const a = agendaDaObra({
      ...base,
      envios: [
        { tipo: 'ata', referencia: 'x', enviadoEm: '2026-10-27T12:00:00Z' },
        { tipo: 'diario', referencia: null, enviadoEm: '2026-10-27T12:00:00Z' },
      ],
    })
    expect(a.some((i) => i.dataReal)).toBe(false)
  })
})
