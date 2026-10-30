import {
  CicloNasPredecessoras,
  atrasoPorResponsavel,
  calcularCronograma,
  diasDeImpacto,
  podeIniciar,
  sinalDaObra,
  type AtividadeExec,
  type AtividadePlano,
  type ImpedimentoCalc,
} from '../cronograma'
import { FERIADOS_MACAE } from './fixtures/feriados'
import { PLANO_MACAE3, execInicialMacae3 } from './fixtures/macae3'

const DATA_BASE = '2026-10-26'

function calcular(over: {
  plano?: AtividadePlano[]
  exec?: AtividadeExec[]
  hoje?: string
  impedimentos?: ImpedimentoCalc[]
} = {}) {
  return calcularCronograma({
    plano: over.plano ?? PLANO_MACAE3,
    exec: over.exec ?? execInicialMacae3(),
    dataBase: DATA_BASE,
    hoje: over.hoje ?? DATA_BASE,
    feriados: FERIADOS_MACAE,
    atividadeTrava: 6,
    impedimentos: over.impedimentos ?? [],
  })
}

function ativ(r: ReturnType<typeof calcular>, n: number) {
  const a = r.atividades.find((x) => x.numero === n)
  if (!a) throw new Error(`atividade ${n} ausente`)
  return a
}

function execCom(n: number, patch: Partial<AtividadeExec>): AtividadeExec[] {
  return execInicialMacae3().map((e) => (e.numero === n ? { ...e, ...patch } : e))
}

describe('fixture Macaé 3', () => {
  it('tem 28 atividades e Σ peso_valor = 437.772,41 (igual ao seed)', () => {
    expect(PLANO_MACAE3).toHaveLength(28)
    const soma = PLANO_MACAE3.reduce((s, a) => s + a.pesoValor, 0)
    expect(Math.round(soma * 100) / 100).toBe(437772.41)
  })
})

describe('previsto', () => {
  it('atividade 1 começa e termina na data-base', () => {
    const a1 = ativ(calcular(), 1)
    expect(a1.inicioPrevisto).toBe('2026-10-26')
    expect(a1.fimPrevisto).toBe('2026-10-26')
  })

  it('atividade 4 (pred 3, 3 dias) pula fim de semana e Finados', () => {
    const a4 = ativ(calcular(), 4)
    expect(a4.inicioPrevisto).toBe('2026-10-29')
    expect(a4.fimPrevisto).toBe('2026-11-03')
  })

  it('atividade 6 (pred 5, 3 dias)', () => {
    const a6 = ativ(calcular(), 6)
    expect(a6.inicioPrevisto).toBe('2026-10-30')
    expect(a6.fimPrevisto).toBe('2026-11-04')
  })

  it('pred2 usa o maior fim entre as duas predecessoras (nº 9 = max(7, 8) + 1)', () => {
    const r = calcular()
    const a8 = ativ(r, 8)
    expect(ativ(r, 9).inicioPrevisto > ativ(r, 7).fimPrevisto).toBe(true)
    expect(ativ(r, 9).inicioPrevisto).toBe('2026-11-12')
    expect(a8.fimPrevisto).toBe('2026-11-11')
  })

  it('ciclo 1→2→1 lança CicloNasPredecessoras', () => {
    const plano: AtividadePlano[] = [
      { ...PLANO_MACAE3[0], numero: 1, pred1: 2, pred2: null },
      { ...PLANO_MACAE3[1], numero: 2, pred1: 1, pred2: null },
    ]
    expect(() =>
      calcular({ plano, exec: [] }),
    ).toThrow(CicloNasPredecessoras)
  })

  it('terminoPrevisto é o maior fimPrevisto', () => {
    const r = calcular()
    const max = r.atividades.map((a) => a.fimPrevisto).sort().at(-1)
    expect(r.terminoPrevisto).toBe(max)
  })
})

describe('situação', () => {
  it('hoje 29/10: atividade 1 não iniciada → atrasada', () => {
    expect(ativ(calcular({ hoje: '2026-10-29' }), 1).situacao).toBe('atrasada')
  })

  it('impedimento cliente + trava aberto na atividade 3 → aguardando_cliente', () => {
    const r = calcular({
      hoje: '2026-10-29',
      impedimentos: [
        { atividadeNumero: 3, responsavel: 'cliente', travaAtividade: true, abertoEm: '2026-10-27', encerradoEm: null, impactoDias: null },
      ],
    })
    expect(ativ(r, 3).situacao).toBe('aguardando_cliente')
  })

  it('impedimento cliente já encerrado não segura a situação', () => {
    const r = calcular({
      hoje: '2026-10-29',
      impedimentos: [
        { atividadeNumero: 3, responsavel: 'cliente', travaAtividade: true, abertoEm: '2026-10-27', encerradoEm: '2026-10-28', impactoDias: null },
      ],
    })
    expect(ativ(r, 3).situacao).toBe('atrasada')
  })

  it('aguardando_cliente não zera o desvio', () => {
    const imps: ImpedimentoCalc[] = [
      { atividadeNumero: 3, responsavel: 'cliente', travaAtividade: true, abertoEm: '2026-10-27', encerradoEm: null, impactoDias: null },
    ]
    const com = calcular({ hoje: '2026-10-29', impedimentos: imps })
    const sem = calcular({ hoje: '2026-10-29' })
    expect(com.desvioPP).toBe(sem.desvioPP)
    expect(com.desvioPP).toBeLessThan(0)
  })

  it('concluida, bloqueada, inicio_atrasado e no_prazo', () => {
    const exec = execInicialMacae3().map((e) => {
      if (e.numero === 1) return { ...e, status: 'concluido' as const, percentual: 1, inicioReal: '2026-10-26', fimReal: '2026-10-26' }
      if (e.numero === 2) return { ...e, status: 'bloqueado' as const }
      return e
    })
    const r = calcular({ exec, hoje: '2026-10-27' })
    expect(ativ(r, 1).situacao).toBe('concluida')
    expect(ativ(r, 2).situacao).toBe('bloqueada')
    expect(ativ(r, 3).situacao).toBe('inicio_atrasado') // começa 27/10, termina 28/10
    expect(ativ(r, 4).situacao).toBe('no_prazo')
  })
})

describe('trava', () => {
  it('podeIniciar(11) com nº 6 em andamento → recusa', () => {
    expect(podeIniciar(11, PLANO_MACAE3, execInicialMacae3(), 6)).toEqual({
      ok: false,
      motivo: 'Travada até a atividade 6 ser concluída',
    })
  })

  it('podeIniciar(11) com nº 6 concluída → ok', () => {
    const exec = execCom(6, { status: 'concluido', percentual: 1 })
    expect(podeIniciar(11, PLANO_MACAE3, exec, 6)).toEqual({ ok: true })
  })

  it('podeIniciar de atividade sem trava → ok', () => {
    expect(podeIniciar(7, PLANO_MACAE3, execInicialMacae3(), 6)).toEqual({ ok: true })
  })

  it('travada só nas atividades com bloqueiaPorTrava enquanto 6 não conclui', () => {
    const r = calcular()
    expect(r.atividades.filter((a) => a.travada).map((a) => a.numero)).toEqual([11, 12, 13, 14, 21])
    const r2 = calcular({ exec: execCom(6, { status: 'concluido', percentual: 1 }) })
    expect(r2.atividades.some((a) => a.travada)).toBe(false)
  })
})

describe('projetado', () => {
  it('sem atraso, projetado = previsto', () => {
    const r = calcular()
    for (const a of r.atividades) {
      expect(a.inicioProjetado).toBe(a.inicioPrevisto)
      expect(a.fimProjetado).toBe(a.fimPrevisto)
    }
    expect(r.terminoProjetado).toBe(r.terminoPrevisto)
  })

  it('nº 6 em andamento 70% e atrasada em 10/11 empurra a sucessora 7', () => {
    const exec = execInicialMacae3().map((e) => {
      if (e.numero <= 5) return { ...e, status: 'concluido' as const, percentual: 1, inicioReal: '2026-10-26', fimReal: '2026-10-29' }
      if (e.numero === 6) return { ...e, percentual: 0.7, inicioReal: '2026-10-30' }
      return e
    })
    const r = calcular({ exec, hoje: '2026-11-10' })
    const a6 = ativ(r, 6)
    expect(a6.situacao).toBe('atrasada')
    expect(a6.fimProjetado > a6.fimPrevisto).toBe(true)
    expect(a6.fimProjetado).toBe('2026-11-10') // ceil(3 × 0,3) = 1 dia a partir de hoje
    expect(ativ(r, 7).inicioProjetado).toBe('2026-11-11')
    expect(r.terminoProjetado > r.terminoPrevisto).toBe(true)
  })

  it('não iniciada com início previsto no passado começa no próximo dia útil a partir de hoje', () => {
    const r = calcular({ hoje: '2026-10-31' }) // sábado
    const a1 = ativ(r, 1)
    expect(a1.inicioProjetado).toBe('2026-11-03') // seg 02/11 é Finados
    expect(a1.fimProjetado).toBe('2026-11-03')
  })

  it('concluída usa as datas reais', () => {
    const exec = execCom(1, { status: 'concluido', percentual: 1, inicioReal: '2026-10-26', fimReal: '2026-10-28' })
    const r = calcular({ exec, hoje: '2026-10-28' })
    expect(ativ(r, 1).fimProjetado).toBe('2026-10-28')
    expect(ativ(r, 2).inicioProjetado).toBe('2026-10-29')
  })

  it('restante sem ruído de ponto flutuante: 10 dias a 70% = 3 dias', () => {
    const plano: AtividadePlano[] = [{ ...PLANO_MACAE3[0], numero: 1, duracao: 10, pred1: null, pred2: null }]
    const exec: AtividadeExec[] = [{ numero: 1, status: 'em_andamento', percentual: 0.7, inicioReal: '2026-10-26', fimReal: null }]
    const r = calcular({ plano, exec, hoje: '2026-11-16' })
    // 16/11 seg, +2 dias úteis = 18/11 (3 dias: 16, 17, 18)
    expect(ativ(r, 1).fimProjetado).toBe('2026-11-18')
  })
})

describe('avanço', () => {
  it('peso = pesoValor / Σ e soma 1', () => {
    const r = calcular()
    const soma = r.atividades.reduce((s, a) => s + a.peso, 0)
    expect(soma).toBeCloseTo(1, 10)
    expect(ativ(r, 1).peso).toBeCloseTo(6650 / 437772.41, 12)
  })

  it('%previsto: 0 antes do início, 1 no fim, proporcional no meio', () => {
    const r = calcular({ hoje: '2026-10-30' })
    expect(ativ(r, 7).percentualPrevisto).toBe(0)
    expect(ativ(r, 1).percentualPrevisto).toBe(1)
    expect(ativ(r, 6).percentualPrevisto).toBeCloseTo(1 / 3, 12)
  })

  it('previsto, realizado e desvio arredondado a 1 casa', () => {
    const exec = execCom(1, { status: 'concluido', percentual: 1, inicioReal: '2026-10-26', fimReal: '2026-10-26' })
    const r = calcular({ exec, hoje: '2026-10-26' })
    const p1 = 6650 / 437772.41
    expect(r.previsto).toBeCloseTo(p1, 12)
    expect(r.realizado).toBeCloseTo(p1, 12)
    expect(r.desvioPP).toBe(0)

    const r2 = calcular({ hoje: '2026-10-26' })
    expect(r2.desvioPP).toBe(Math.round(-p1 * 1000) / 10) // -1,5
    expect(r2.desvioPP).toBe(-1.5)
  })

  it('Σ pesoValor = 0 → peso 0, previsto e realizado 0', () => {
    const plano = PLANO_MACAE3.map((a) => ({ ...a, pesoValor: 0 }))
    const r = calcular({ plano, hoje: '2026-12-01' })
    expect(r.previsto).toBe(0)
    expect(r.realizado).toBe(0)
    expect(r.desvioPP).toBe(0)
    expect(r.atividades.every((a) => a.peso === 0)).toBe(true)
  })
})

describe('diasDeImpacto', () => {
  it('trava conta dias úteis abertos; sem trava conta impactoDias', () => {
    const imps: ImpedimentoCalc[] = [
      { atividadeNumero: 3, responsavel: 'cliente', travaAtividade: true, abertoEm: '2026-10-27', encerradoEm: null, impactoDias: null },
      { atividadeNumero: 4, responsavel: 'clima', travaAtividade: false, abertoEm: '2026-10-27', encerradoEm: null, impactoDias: 2 },
      { atividadeNumero: null, responsavel: 'terceiro', travaAtividade: false, abertoEm: '2026-10-27', encerradoEm: null, impactoDias: null },
      { atividadeNumero: 5, responsavel: 'manfac', travaAtividade: true, abertoEm: '2026-10-29', encerradoEm: '2026-10-30', impactoDias: null },
    ]
    // 27/10..03/11: 27, 28, 29, 30, 03 = 5 (02/11 Finados)
    expect(diasDeImpacto(imps, '2026-11-03', FERIADOS_MACAE)).toEqual({ cliente: 5, clima: 2, terceiro: 0, manfac: 2 })
  })
})

describe('atrasoPorResponsavel', () => {
  it('reparte cliente → clima → terceiro, resto Manfac', () => {
    expect(
      atrasoPorResponsavel({
        terminoBase: '2027-02-10',
        terminoProjetado: '2027-02-17',
        impacto: { cliente: 4, clima: 0, terceiro: 0, manfac: 0 },
        feriados: FERIADOS_MACAE,
      }),
    ).toEqual({ total: 5, cliente: 4, clima: 0, terceiro: 0, manfac: 1 })
  })

  it('impacto maior que o atraso é limitado ao total', () => {
    expect(
      atrasoPorResponsavel({
        terminoBase: '2027-02-10',
        terminoProjetado: '2027-02-17',
        impacto: { cliente: 3, clima: 4, terceiro: 9, manfac: 0 },
        feriados: FERIADOS_MACAE,
      }),
    ).toEqual({ total: 5, cliente: 3, clima: 2, terceiro: 0, manfac: 0 })
  })

  it('sem atraso → tudo zero', () => {
    expect(
      atrasoPorResponsavel({
        terminoBase: '2027-02-10',
        terminoProjetado: '2027-02-05',
        impacto: { cliente: 4, clima: 0, terceiro: 0, manfac: 0 },
        feriados: FERIADOS_MACAE,
      }),
    ).toEqual({ total: 0, cliente: 0, clima: 0, terceiro: 0, manfac: 0 })
  })
})

describe('sinalDaObra', () => {
  const base = { terminoProjetado: '2027-02-10', terminoBase: '2027-02-10', impedimentoClienteAberto: false }
  it('desvio -2 → amarelo', () => expect(sinalDaObra({ ...base, desvioPP: -2 })).toBe('amarelo'))
  it('desvio -6 → vermelho', () => expect(sinalDaObra({ ...base, desvioPP: -6 })).toBe('vermelho'))
  it('desvio 0 sem impedimento → verde', () => expect(sinalDaObra({ ...base, desvioPP: 0 })).toBe('verde'))
  it('impedimento do cliente aberto → amarelo', () =>
    expect(sinalDaObra({ ...base, desvioPP: 0, impedimentoClienteAberto: true })).toBe('amarelo'))
  it('término projetado depois da base → vermelho', () =>
    expect(sinalDaObra({ ...base, desvioPP: 0, terminoProjetado: '2027-02-11' })).toBe('vermelho'))
  it('sem base → não compara término', () =>
    expect(sinalDaObra({ ...base, desvioPP: 0, terminoBase: null, terminoProjetado: '2099-01-01' })).toBe('verde'))
})
