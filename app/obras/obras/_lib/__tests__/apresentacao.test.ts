import { obraPeriodo } from '../../_pdf/__tests__/fixtures/periodo'
import {
  BLOCOS, lerParams, montarApresentacao, paramsParaQuery, periodoDaApresentacao, slidesDe,
} from '../apresentacao'

const hoje = '2026-11-10'
const base = { inicio: '2026-11-01', fim: hoje, ref: hoje, hoje, planos: [], restricoes: [], destaques: [] as string[], blocos: [...BLOCOS] }

describe('lerParams', () => {
  it('sem query: padrão mês, todos os blocos, fotos null', () => {
    const p = lerParams({})
    expect(p.preset).toBe('mes')
    expect(p.blocos).toEqual([...BLOCOS])
    expect(p.fotos).toBeNull()
  })
  it('formulário enviado: só os blocos marcados; fotos limitadas a 12 e com formato estrito', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `f${i}`).join(',')
    const p = lerParams({ f: '1', blocos: 'capa,xx,ppc', fotos: `${ids},../x,a b`, periodo: 'lixo' })
    expect(p.blocos).toEqual(['capa', 'ppc'])
    expect(p.fotos).toHaveLength(12)
    expect(p.preset).toBe('mes')
    expect(lerParams({ f: '1', fotos: '../x' }).fotos).toEqual([])
  })
  it('limita o tamanho de blocos e fotos antes de processar', () => {
    const lixo = 'a,'.repeat(50_000)
    const p = lerParams({ f: '1', blocos: lixo, fotos: lixo })
    expect(p.blocos).toEqual([])
    expect(p.fotos).toEqual(['a'])
  })
  it('datas inválidas viram null', () => {
    const p = lerParams(new URLSearchParams('periodo=custom&de=2026-02-31&ate=2026-11-01'))
    expect(p.de).toBeNull()
    expect(p.ate).toBe('2026-11-01')
  })
  it('query canônica volta ao mesmo estado', () => {
    const p = lerParams({ f: '1', periodo: 'custom', de: '2026-11-01', ate: '2026-11-05', blocos: 'capa,resumo', fotos: 'a,b' })
    const q = lerParams(new URLSearchParams(paramsParaQuery(p, p.fotos ?? [])))
    expect(q).toEqual(p)
  })
})

describe('periodoDaApresentacao', () => {
  it('presets', () => {
    expect(periodoDaApresentacao({ preset: 'semana', de: null, ate: null }, hoje, null)).toEqual({ ok: true, inicio: '2026-11-09', fim: hoje })
    expect(periodoDaApresentacao({ preset: 'mes', de: null, ate: null }, hoje, null)).toEqual({ ok: true, inicio: '2026-11-01', fim: hoje })
    expect(periodoDaApresentacao({ preset: 'inicio', de: null, ate: null }, hoje, '2026-10-26')).toEqual({ ok: true, inicio: '2026-10-26', fim: hoje })
    expect(periodoDaApresentacao({ preset: 'inicio', de: null, ate: null }, hoje, null).ok).toBe(false)
  })
  it('personalizado exige datas coerentes', () => {
    expect(periodoDaApresentacao({ preset: 'custom', de: null, ate: '2026-11-01' }, hoje, null).ok).toBe(false)
    expect(periodoDaApresentacao({ preset: 'custom', de: '2026-11-05', ate: '2026-11-01' }, hoje, null).ok).toBe(false)
    expect(periodoDaApresentacao({ preset: 'custom', de: '2026-12-01', ate: '2026-12-05' }, hoje, null).ok).toBe(false)
    expect(periodoDaApresentacao({ preset: 'custom', de: '2026-11-01', ate: '2026-11-05' }, hoje, null)).toEqual({ ok: true, inicio: '2026-11-01', fim: '2026-11-05' })
  })
})

describe('montarApresentacao', () => {
  it('com dados: blocos presentes, sem NaN, sem numero/ids/R$', () => {
    const c = montarApresentacao({ ...base, obra: obraPeriodo(), destaques: ['Etapa 1 concluída antes'] })
    expect(c.blocos).toEqual(expect.arrayContaining(['capa', 'resumo', 'cronograma', 'marcos', 'impedimentos']))
    const json = JSON.stringify(c)
    expect(json).not.toMatch(/NaN|Infinity|98765|Pedreiro faltou/)
    expect(c.marcos?.destaques).toEqual(['Etapa 1 concluída antes'])
  })
  it('período sem dados: blocos vazios somem e nada vira NaN', () => {
    const og = obraPeriodo()
    og.calc = null
    og.calcBase = null
    og.etapas = []
    og.hist = []
    og.impedimentos = []
    const c = montarApresentacao({ ...base, obra: og })
    expect(c.blocos).toEqual(['capa'])
    expect(c.resumo ?? c.curva ?? c.cronograma ?? c.marcos ?? c.impedimentos ?? c.ppc ?? c.proximos).toBeNull()
    expect(JSON.stringify(c)).not.toMatch(/NaN|Infinity|undefined/)
  })
  it('só os blocos pedidos; fotos entra pelos slides quando há fotos', () => {
    const c = montarApresentacao({ ...base, obra: obraPeriodo(), blocos: ['capa', 'resumo'] })
    expect(c.blocos).toEqual(['capa', 'resumo'])
    expect(slidesDe(c, false)).toEqual(['capa', 'resumo'])
    expect(slidesDe({ ...c, blocos: ['capa', 'resumo'] }, true)).toEqual(['capa', 'resumo', 'fotos'])
  })
  it('impedimento oculto e área interna nunca aparecem', () => {
    const c = montarApresentacao({ ...base, inicio: '2026-10-26', obra: obraPeriodo() })
    expect(JSON.stringify(c.impedimentos)).not.toMatch(/Pedreiro/)
  })
})
