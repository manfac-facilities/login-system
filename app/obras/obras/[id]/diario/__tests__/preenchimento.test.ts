import { montarDiario } from '../_preenchimento'
import type { AtividadeCalculada, AtividadePlano, ResultadoCronograma } from '../../../_lib/cronograma'

const ativ = (over: Partial<AtividadeCalculada>): AtividadeCalculada => ({
  numero: 1, etapa: 'E', descricao: 'A', pred1: null, pred2: null, duracao: 2, bloqueiaPorTrava: false, pesoValor: 0,
  status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
  inicioPrevisto: '2026-10-26', fimPrevisto: '2026-10-27', inicioProjetado: '2026-10-26', fimProjetado: '2026-10-27',
  peso: 0, percentualPrevisto: 0, situacao: 'no_prazo', travada: false,
  inicioFixo: null, diasRestantes: null, alertaInicioFixo: null, inicioFixoAjustado: false, ...over,
})

const atividades = [
  ativ({ numero: 1, status: 'concluido', percentual: 1 }),
  ativ({ numero: 6, descricao: 'Escoramento', status: 'em_andamento', percentual: 0.5 }),
  ativ({ numero: 7, descricao: 'Topografia', inicioPrevisto: '2026-10-29' }),
  ativ({ numero: 11, descricao: 'Porta', inicioPrevisto: '2026-10-28', bloqueiaPorTrava: true }),
  ativ({ numero: 8, descricao: 'Pintura', inicioPrevisto: '2026-11-02' }), // segunda: próximo útil depois de sex 30/10
  ativ({ numero: 9, descricao: 'Forro', inicioPrevisto: '2026-10-30' }),
]
const calc = { atividades } as ResultadoCronograma
const plano = atividades as AtividadePlano[]
const exec = atividades.map((a) => ({ numero: a.numero, status: a.status, percentual: a.percentual, inicioReal: null, fimReal: null }))

const base = { calc, plano, exec, atividadeTrava: 6, feriados: new Set<string>(), avancosSalvos: [], rdo: null }

describe('montarDiario', () => {
  it('lista em andamento + não iniciadas com início ≤ data; trava pela atividade 6', () => {
    const r = montarDiario({ ...base, data: '2026-10-29', ultimo: { efetivo: 6, equipeTexto: 'Própria' } })
    expect(r.atividades.map((a) => a.numero)).toEqual([6, 7, 11])
    expect(r.atividades.find((a) => a.numero === 11)).toMatchObject({ travada: true, motivoTrava: 'Travada até a atividade 6 ser concluída' })
    expect(r.inicial.avancos.find((a) => a.numero === 6)).toEqual({ numero: 6, de: 0.5, para: 0.5, concluida: false, causa: null })
    expect(r.inicial).toMatchObject({ efetivo: 6, equipeTexto: 'Própria', programacaoAmanha: '9 · Forro' })
  })

  it('sexta-feira sugere o que começa na segunda', () => {
    const r = montarDiario({ ...base, data: '2026-10-30', ultimo: null })
    expect(r.inicial.programacaoAmanha).toBe('8 · Pintura')
    expect(r.inicial.efetivo).toBeNull()
  })

  it('com rascunho salvo usa os campos e avanços dele', () => {
    const rdo = { semExecucao: false, motivoSemExecucao: null, efetivo: 3, equipeTexto: null, clima: 'chuva' as const, climaManha: 'sol' as const, climaTarde: 'chuva' as const, programacaoAmanha: null }
    const r = montarDiario({
      ...base, data: '2026-10-29', rdo, ultimo: { efetivo: 9, equipeTexto: 'x' },
      avancosSalvos: [{ numero: 6, de: 0.5, para: 0.8, concluida: false, causa: null }, { numero: 9, de: 0, para: 0.1, concluida: false, causa: null }],
    })
    expect(r.inicial).toMatchObject({ efetivo: 3, clima: 'chuva', climaManha: 'sol', climaTarde: 'chuva', programacaoAmanha: null })
    expect(r.atividades.map((a) => a.numero)).toEqual([6, 7, 11, 9])
    expect(r.inicial.avancos.find((a) => a.numero === 6)?.para).toBe(0.8)
  })
})
