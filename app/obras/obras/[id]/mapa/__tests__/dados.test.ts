import { montarMapaTela, fotosRecentesPorAmbiente } from '../_dados'
import { montarMapaDiario } from '../../diario/_mapa-diario'
import type { AtividadeCalculada } from '../../../_lib/cronograma'
import type { FotoMapa } from '../../../_lib/mapa'
import type { MapaDaObra } from '../../../_lib/mapa-leitura'

const at = (numero: number, peso: number, percentual: number, percentualPrevisto: number, situacao = 'no_prazo') =>
  ({ numero, descricao: `Atividade ${numero}`, etapa: 'E', peso, percentual, percentualPrevisto, duracao: 2, situacao }) as unknown as AtividadeCalculada

const mapa: MapaDaObra = {
  configurado: true,
  mapa: { modo: 'croqui', plantaPath: null, plantaLargura: null, plantaAltura: null },
  ambientes: [
    { id: 'A', nome: 'Salão', areaM2: 412, x: 0, y: 0, w: 0.5, h: 0.5, ordem: 1 },
    { id: 'B', nome: 'Banheiros', areaM2: null, x: null, y: null, w: null, h: null, ordem: 2 },
    { id: 'C', nome: 'Depósito', areaM2: null, x: null, y: null, w: null, h: null, ordem: 3 },
  ],
  pontos: [
    { id: 'p1', numero: 1, nome: 'Entrada', ambienteId: 'A', x: 0.1, y: 0.1, ativo: true },
    { id: 'p2', numero: 2, nome: 'Fundo', ambienteId: 'A', x: 0.2, y: 0.2, ativo: false },
  ],
  vinculos: [
    { ambienteId: 'A', atividadeNumero: 1 },
    { ambienteId: 'A', atividadeNumero: 2 },
    // C só tem atividade fora da versão vigente
    { ambienteId: 'C', atividadeNumero: 99 },
  ],
}
const f = (id: string, data: string, over: Partial<FotoMapa> = {}): FotoMapa => ({
  id, rdoId: 'r' + data, path: `o/${id}.jpg`, legenda: null, ordem: 1, data, estado: 'validado', ambienteId: 'A', pontoId: null, atividadeNumero: null, ...over,
})

describe('montarMapaTela', () => {
  const atividades = [at(1, 0.5, 1, 1, 'concluida'), at(2, 0.5, 0.2, 0.6, 'atrasada')]
  const tela = montarMapaTela({
    mapa,
    atividades,
    fotos: [f('f1', '2026-10-30', { pontoId: 'p1', ambienteId: null }), f('f2', '2026-10-31')],
    impedimentos: [{ id: 'i1', ambienteId: 'A', descricao: 'Falta material' }],
    urls: new Map([['o/f2.jpg', 'https://x/f2']]),
    plantaUrl: null,
  })
  const [A, B, C] = tela.ambientes

  it('avanço e previsto ponderados; faixa de cor', () => {
    expect(A.pct).toBeCloseTo(0.6)
    expect(A.previsto).toBeCloseTo(0.8)
    expect(A.faixa).toBe(3)
    expect(A.atividades).toEqual([
      { numero: 1, descricao: 'Atividade 1', pct: 1, atrasada: false, concluida: true },
      { numero: 2, descricao: 'Atividade 2', pct: 0.2, atrasada: true, concluida: false },
    ])
  })

  it('sem atividade ligada ou só fora da versão vigente → null ("—"), sem NaN (Review Focus 4)', () => {
    expect([B.pct, B.previsto, B.faixa]).toEqual([null, null, null])
    expect([C.pct, C.faixa, C.atividades]).toEqual([null, null, []])
  })

  it('impedimento aberto, fotos recentes (mais nova primeiro, foto só com ponto conta no ambiente do ponto)', () => {
    expect(A.impedimentos).toEqual([{ id: 'i1', descricao: 'Falta material' }])
    expect(A.fotos).toEqual([
      { id: 'f2', url: 'https://x/f2', data: '2026-10-31', pontoNumero: null },
      { id: 'f1', url: null, data: '2026-10-30', pontoNumero: 1 },
    ])
  })

  it('só os pontos ativos vão ao mapa', () => {
    expect(tela.pontos.map((p) => p.id)).toEqual(['p1'])
  })

  it('fotos recentes respeitam o teto por ambiente', () => {
    const muitas = Array.from({ length: 9 }, (_, i) => f(`x${i}`, `2026-10-${10 + i}`))
    expect(fotosRecentesPorAmbiente(mapa, muitas).get('A')!.map((x) => x.id)).toEqual(['x8', 'x7', 'x6', 'x5', 'x4', 'x3'])
  })
})

describe('montarMapaDiario', () => {
  it('obra sem ambiente → null (diário de sempre)', () => {
    expect(montarMapaDiario({ mapa: { ...mapa, ambientes: [] }, fotos: [], data: '2026-11-01', atividades: [] })).toBeNull()
  })

  it('ronda = pontos ativos; referência = última foto do ponto em dia anterior', () => {
    const fotos = [
      f('a', '2026-10-30', { pontoId: 'p1' }),
      f('b', '2026-10-31', { pontoId: 'p1' }),
      f('c', '2026-11-01', { pontoId: 'p1' }), // do próprio dia: não é referência
    ]
    const r = montarMapaDiario({ mapa, fotos, data: '2026-11-01', atividades: [{ numero: 1, descricao: 'A1' }], urls: new Map([['o/b.jpg', 'u-b']]) })!
    expect(r.caminhos).toEqual(['o/b.jpg'])
    expect(r.mapa.pontos).toEqual([{ id: 'p1', numero: 1, nome: 'Entrada', ambienteId: 'A', referenciaUrl: 'u-b', referenciaData: '2026-10-31' }])
    expect(r.mapa.ambientes[0]).toEqual({ id: 'A', nome: 'Salão', atividades: [1, 2] })
  })
})
