/** @jest-environment node */
import type { LinhaGantt } from '../../../../obras/painel/_calculos'
import { recorteDoCronograma } from '../_recorte'

type P = Partial<Omit<LinhaGantt, 'obra'>> & { os: string }

function l({ os, ...resto }: P): LinhaGantt {
  return {
    obra: { id: os, os, loja: null, cliente: 'c', equipe: 'e', etapa: 'em_execucao', etapaNome: 'x', valor: 0, semValor: false } as unknown as LinhaGantt['obra'],
    grupo: 'campo',
    planIni: null,
    planFim: null,
    realIni: null,
    realFim: null,
    emCurso: false,
    parada: false,
    atrasada: false,
    diasAtraso: 0,
    terminouComAtraso: null,
    remarcada: false,
    ...resto,
  }
}
const oss = (x: LinhaGantt[]) => x.map((i) => i.obra.os)

describe('recorteDoCronograma', () => {
  it('ordena por prioridade 1 a 5', () => {
    const linhas = [
      l({ os: 'terminou', grupo: 'terminou', realFim: '2026-10-01' }),
      l({ os: 'campo', grupo: 'campo', realIni: '2026-09-01' }),
      l({ os: 'iniciar', grupo: 'iniciar', planIni: '2026-10-20' }),
      l({ os: 'parada', grupo: 'campo', parada: true, realIni: '2026-09-01' }),
      l({ os: 'atrasada', grupo: 'campo', atrasada: true, diasAtraso: 3 }),
    ]
    expect(oss(recorteDoCronograma(linhas))).toEqual(['atrasada', 'parada', 'iniciar', 'campo', 'terminou'])
  })

  it('atrasada vence parada; mais dias de atraso primeiro; desempate por OS', () => {
    const linhas = [
      l({ os: 'B', atrasada: true, diasAtraso: 2 }),
      l({ os: 'A', atrasada: true, diasAtraso: 2 }),
      l({ os: 'C', atrasada: true, diasAtraso: 9 }),
      l({ os: 'P', parada: true, atrasada: true, diasAtraso: 1 }),
    ]
    expect(oss(recorteDoCronograma(linhas))).toEqual(['C', 'A', 'B', 'P'])
  })

  it('ordem interna: parada e campo por início asc, iniciar por planIni asc, terminou por realFim desc', () => {
    const linhas = [
      l({ os: 'p2', parada: true, realIni: '2026-09-10' }),
      l({ os: 'p1', parada: true, planIni: '2026-09-01' }),
      l({ os: 'i2', grupo: 'iniciar', planIni: '2026-11-01' }),
      l({ os: 'i1', grupo: 'iniciar', planIni: '2026-10-15' }),
      l({ os: 'c2', planIni: '2026-09-20' }),
      l({ os: 'c1', realIni: '2026-09-05' }),
      l({ os: 't1', grupo: 'terminou', realFim: '2026-10-02' }),
      l({ os: 't2', grupo: 'terminou', realFim: '2026-10-06' }),
    ]
    expect(oss(recorteDoCronograma(linhas, 8))).toEqual(['p1', 'p2', 'i1', 'i2', 'c1', 'c2', 't2', 't1'])
  })

  it('desempate final por OS', () => {
    const linhas = [l({ os: '20', planIni: '2026-09-01' }), l({ os: '10', planIni: '2026-09-01' })]
    expect(oss(recorteDoCronograma(linhas))).toEqual(['10', '20'])
  })

  it('corta em 7 por padrão e respeita o limite informado', () => {
    const linhas = Array.from({ length: 12 }, (_, i) => l({ os: String(100 + i), atrasada: true, diasAtraso: i }))
    expect(recorteDoCronograma(linhas)).toHaveLength(7)
    expect(recorteDoCronograma(linhas, 3)).toHaveLength(3)
    expect(oss(recorteDoCronograma(linhas, 2))).toEqual(['111', '110'])
  })

  it('prioridades baixas só entram se sobrar vaga', () => {
    const linhas = [
      ...Array.from({ length: 7 }, (_, i) => l({ os: `a${i}`, atrasada: true, diasAtraso: 5 })),
      l({ os: 'campo' }),
    ]
    expect(oss(recorteDoCronograma(linhas))).not.toContain('campo')
  })

  it('menos de 7 devolve todas; vazio devolve vazio; não muta a entrada', () => {
    const linhas = [l({ os: 'b' }), l({ os: 'a' })]
    const copia = [...linhas]
    expect(recorteDoCronograma(linhas)).toHaveLength(2)
    expect(linhas).toEqual(copia)
    expect(recorteDoCronograma([])).toEqual([])
  })
})
