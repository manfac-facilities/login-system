import {
  calcularCronograma,
  compararComBase,
  duracaoPorFim,
  resumirEtapas,
  type AtividadeExec,
  type AtividadePlano,
} from '../cronograma'
import { FERIADOS_MACAE as F } from './fixtures/feriados'
import { PLANO_MACAE3, execInicialMacae3 } from './fixtures/macae3'

const DATA_BASE = '2026-10-26'

function calcular(over: { plano?: AtividadePlano[]; exec?: AtividadeExec[]; hoje?: string; dataStatus?: string } = {}) {
  return calcularCronograma({
    plano: over.plano ?? PLANO_MACAE3,
    exec: over.exec ?? execInicialMacae3(),
    dataBase: DATA_BASE,
    hoje: over.hoje ?? DATA_BASE,
    dataStatus: over.dataStatus,
    feriados: F,
    atividadeTrava: 6,
    impedimentos: [],
  })
}

const ativ = (r: ReturnType<typeof calcular>, n: number) => {
  const a = r.atividades.find((x) => x.numero === n)
  if (!a) throw new Error(`atividade ${n} ausente`)
  return a
}
const planoCom = (n: number, patch: Partial<AtividadePlano>, plano = PLANO_MACAE3) =>
  plano.map((a) => (a.numero === n ? { ...a, ...patch } : a))
const execCom = (n: number, patch: Partial<AtividadeExec>) =>
  execInicialMacae3().map((e) => (e.numero === n ? { ...e, ...patch } : e))

describe('início fixo', () => {
  it('sem início fixo: sem alerta e sem ajuste', () => {
    const a7 = ativ(calcular(), 7)
    expect(a7.alertaInicioFixo).toBeNull()
    expect(a7.inicioFixoAjustado).toBe(false)
    expect(a7.inicioPrevisto).toBe('2026-11-05')
  })

  it('caindo no sábado vai para o próximo dia útil, com aviso de ajuste', () => {
    const a7 = ativ(calcular({ plano: planoCom(7, { inicioFixo: '2026-11-07' }) }), 7)
    expect(a7.inicioPrevisto).toBe('2026-11-09')
    expect(a7.inicioFixoAjustado).toBe(true)
    expect(a7.alertaInicioFixo).toBeNull()
  })

  it('antes do fim da predecessora: aceita, com alerta; sucessora parte do fim da 7', () => {
    const r = calcular({ plano: planoCom(7, { inicioFixo: '2026-11-03' }) })
    const a7 = ativ(r, 7)
    expect(ativ(r, 6).fimPrevisto).toBe('2026-11-04')
    expect(a7.inicioPrevisto).toBe('2026-11-03')
    expect(a7.fimPrevisto).toBe('2026-11-04')
    expect(a7.inicioFixoAjustado).toBe(false)
    expect(a7.alertaInicioFixo).toContain('atividade 6')
    // 9 depende de 8 e 7; com só a 7 como predecessora, parte do fim (fixado) da 7.
    const r2 = calcular({ plano: planoCom(9, { pred1: 7, pred2: null }, planoCom(7, { inicioFixo: '2026-11-03' })) })
    expect(ativ(r2, 9).inicioPrevisto).toBe('2026-11-05')
    // Projeção realista: a 7 não iniciada só começa após a 6 projetada (05–06/11); a 9 parte do projetado da 7.
    expect(ativ(r2, 7).inicioProjetado).toBe('2026-11-05')
    expect(ativ(r2, 9).inicioProjetado).toBe('2026-11-09')
  })

  it('projeção de não iniciada com início fixo respeita as predecessoras projetadas e a data de status', () => {
    const plano = planoCom(7, { inicioFixo: '2026-11-03' })
    // 6 em andamento a 0% em 10/11: projeção da 6 termina depois; 7 projeta após ela.
    const r = calcular({ plano, hoje: '2026-11-10' })
    const a6 = ativ(r, 6)
    const a7 = ativ(r, 7)
    expect(a7.inicioPrevisto).toBe('2026-11-03')
    expect(a7.inicioProjetado > a6.fimProjetado).toBe(true)
  })

  it('início fixo no futuro sem conflito: projeção começa na data fixa', () => {
    const r = calcular({ plano: planoCom(7, { inicioFixo: '2026-11-16' }) })
    expect(ativ(r, 7).inicioPrevisto).toBe('2026-11-16')
    expect(ativ(r, 7).inicioProjetado).toBe('2026-11-16')
  })
})

describe('dias restantes', () => {
  it('em andamento com 3 dias restantes na data de status 10/11 → fim projetado 12/11', () => {
    const r = calcular({ exec: execCom(6, { diasRestantes: 3, inicioReal: '2026-10-30' }), hoje: '2026-11-10', dataStatus: '2026-11-10' })
    expect(ativ(r, 6).fimProjetado).toBe('2026-11-12')
  })

  it('0 dias restantes → fim projetado = data de status', () => {
    const r = calcular({ exec: execCom(6, { diasRestantes: 0, inicioReal: '2026-10-30' }), hoje: '2026-11-10', dataStatus: '2026-11-10' })
    expect(ativ(r, 6).fimProjetado).toBe('2026-11-10')
  })

  it('dataStatus padrão = hoje', () => {
    const r = calcular({ exec: execCom(6, { diasRestantes: 3, inicioReal: '2026-10-30' }), hoje: '2026-11-10' })
    expect(ativ(r, 6).fimProjetado).toBe('2026-11-12')
  })

  it('ancorado na data em que foi informado: hoje avançando 3 dias úteis não muda o fim projetado', () => {
    const exec = execCom(6, { diasRestantes: 3, diasRestantesEm: '2026-11-10', inicioReal: '2026-10-30' })
    const antes = calcular({ exec, hoje: '2026-11-10' })
    const depois = calcular({ exec, hoje: '2026-11-13' })
    expect(ativ(antes, 6).fimProjetado).toBe('2026-11-12')
    expect(ativ(depois, 6).fimProjetado).toBe('2026-11-12')
  })

  it('âncora em dia não útil vai para o próximo dia útil', () => {
    // 07/11/2026 é sábado → conta a partir de segunda 09/11.
    const r = calcular({ exec: execCom(6, { diasRestantes: 2, diasRestantesEm: '2026-11-07', inicioReal: '2026-10-30' }), hoje: '2026-11-12' })
    expect(ativ(r, 6).fimProjetado).toBe('2026-11-10')
  })

  it('sem âncora: cai na data de status/hoje', () => {
    const r = calcular({ exec: execCom(6, { diasRestantes: 3, diasRestantesEm: null, inicioReal: '2026-10-30' }), hoje: '2026-11-13' })
    expect(ativ(r, 6).fimProjetado).toBe('2026-11-17')
  })
})

describe('resumirEtapas', () => {
  it('etapa 1 começa na data-base, na ordem de aparição', () => {
    const r = calcular()
    const etapas = resumirEtapas(r.atividades, F)
    expect(etapas.map((e) => e.etapa)).toEqual([
      '1 – Mobilização e isolamento',
      '2 – Estabilização',
      '3 – Investigação e projeto',
      '4 – Desmobilização e demolição',
      '5 – Reforço e reconstrução',
      '6 – Acabamentos e entrega',
      'R – Reforma light',
    ])
    const e1 = etapas[0]
    expect(e1.inicio).toBe('2026-10-26')
    expect(e1.fim).toBe('2026-11-03') // nº 4: 29/10 → 03/11 (Finados)
    expect(e1.diasUteis).toBe(6)
    expect(e1.numeros).toEqual([1, 2, 3, 4, 5])
  })

  it('% ponderado pelo peso', () => {
    const exec = execInicialMacae3().map((e) => (e.numero === 1 ? { ...e, status: 'concluido' as const, percentual: 1 } : e))
    const e1 = resumirEtapas(calcular({ exec }).atividades, F)[0]
    const soma = 6650 + 4500 + 17869.2 + 5851
    expect(e1.percentual).toBeCloseTo(6650 / soma, 9)
  })

  it('etapa com todos os pesos 0 → % ponderado pela duração (sem NaN)', () => {
    const plano = PLANO_MACAE3.map((a) => (a.etapa === '3 – Investigação e projeto' ? { ...a, pesoValor: 0 } : a))
    const exec = execInicialMacae3().map((e) =>
      e.numero === 7 ? { ...e, percentual: 1 } : e.numero === 8 ? { ...e, percentual: 0.5 } : e,
    )
    const e3 = resumirEtapas(calcular({ plano, exec }).atividades, F).find((e) => e.etapa === '3 – Investigação e projeto')!
    // durações 7:2, 8:5, 9:10, 10:5 → (2·1 + 5·0,5) / 22
    expect(e3.percentual).toBeCloseTo((2 * 1 + 5 * 0.5) / 22, 9)
    expect(Number.isNaN(e3.percentual)).toBe(false)
  })
})

describe('compararComBase', () => {
  it('vigente igual à base → Δ 0 em todas', () => {
    const r = calcular()
    const m = compararComBase(r.atividades, r.atividades, F)
    expect(m.size).toBe(28)
    for (const c of m.values()) expect(c.deltaDias).toBe(0)
    expect(m.get(7)?.inicioBase).toBe('2026-11-05')
  })

  it('atividade nova na vigente → null; base null → tudo null', () => {
    const base = calcular({ plano: PLANO_MACAE3.filter((a) => a.numero !== 28) })
    const vig = calcular()
    const m = compararComBase(vig.atividades, base.atividades, F)
    expect(m.get(28)).toEqual({ numero: 28, inicioBase: null, fimBase: null, deltaDias: null })
    expect(compararComBase(vig.atividades, null, F).get(1)?.deltaDias).toBeNull()
  })

  it('Δ positivo quando atrasa e negativo quando adianta', () => {
    const base = calcular()
    const atrasada = calcular({ plano: planoCom(28, { duracao: 5 }) }) // fim +2 dias úteis
    expect(compararComBase(atrasada.atividades, base.atividades, F).get(28)?.deltaDias).toBe(2)
    expect(compararComBase(base.atividades, atrasada.atividades, F).get(28)?.deltaDias).toBe(-2)
  })
})

describe('duracaoPorFim', () => {
  it('dias úteis inclusivos (pula Finados)', () => {
    expect(duracaoPorFim('2026-10-29', '2026-11-03', F)).toBe(3)
  })
  it('fim antes do início lança', () => {
    expect(() => duracaoPorFim('2026-10-29', '2026-10-28', F)).toThrow('Fim antes do início (29/10)')
  })
})
