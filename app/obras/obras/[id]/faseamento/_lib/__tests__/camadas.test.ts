import {
  CAMADAS_EXEMPLO_FASE1,
  MAX_CAMADAS,
  TIPOS,
  camadasSchema,
  carimboSchema,
  legendaDe,
  regrasSchema,
  type Camada,
} from '../camadas'

const ok = (c: unknown) => camadasSchema.safeParse(c).success

describe('camadasSchema', () => {
  it('aceita as camadas do mockup (Fase 1)', () => {
    expect(CAMADAS_EXEMPLO_FASE1).toHaveLength(14)
    const r = camadasSchema.safeParse(CAMADAS_EXEMPLO_FASE1)
    expect(r.success).toBe(true)
  })

  it('recusa coordenada fora de 0-1 em zona, linha e ponto', () => {
    expect(ok([{ id: 'a', t: 'zona_obra', r: [0.1, 0.1, 1.2, 0.2] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'zona_obra', r: [-0.1, 0.1, 0.2, 0.2] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'drywall', p: [[0, 0], [1.01, 0.5]] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'extintor', at: [0.5, 2] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'extintor', at: [Number.NaN, 0.5] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'extintor', at: [0, 1] }])).toBe(true)
  })

  it('recusa tipo desconhecido e formato que não combina com o tipo', () => {
    expect(ok([{ id: 'a', t: 'piscina', at: [0.5, 0.5] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'extintor', r: [0, 0, 0.1, 0.1] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'zona_obra', at: [0.5, 0.5] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'drywall', p: [[0.1, 0.1]] }])).toBe(false)
  })

  it('limita a 300 camadas, 50 pontos por linha e ids únicos', () => {
    const uma = (i: number): Camada => ({ id: `c${i}`, t: 'extintor', at: [0.5, 0.5] })
    expect(MAX_CAMADAS).toBe(300)
    expect(ok(Array.from({ length: 300 }, (_, i) => uma(i)))).toBe(true)
    expect(ok(Array.from({ length: 301 }, (_, i) => uma(i)))).toBe(false)
    const pts = (n: number) => Array.from({ length: n }, () => [0.2, 0.2])
    expect(ok([{ id: 'a', t: 'fluxo_obra', p: pts(50) }])).toBe(true)
    expect(ok([{ id: 'a', t: 'fluxo_obra', p: pts(51) }])).toBe(false)
    expect(ok([uma(1), uma(1)])).toBe(false)
    expect(ok('x')).toBe(false)
  })
})

describe('regrasSchema e carimboSchema', () => {
  it('regras: até 20 textos de 1 a 300 caracteres', () => {
    expect(regrasSchema.safeParse(Array.from({ length: 20 }, () => 'ok')).success).toBe(true)
    expect(regrasSchema.safeParse(Array.from({ length: 21 }, () => 'ok')).success).toBe(false)
    expect(regrasSchema.safeParse(['']).success).toBe(false)
    expect(regrasSchema.safeParse(['x'.repeat(300)]).success).toBe(true)
    expect(regrasSchema.safeParse(['x'.repeat(301)]).success).toBe(false)
    expect(regrasSchema.safeParse([1]).success).toBe(false)
  })

  it('carimbo: cinco strings curtas', () => {
    const c = { titulo: 'Fase 1', cliente: 'DPSP', desenho: 'Planta', base: 'Layout', rt: 'Eng. X CREA 1' }
    expect(carimboSchema.safeParse(c).success).toBe(true)
    expect(carimboSchema.safeParse({ ...c, rt: 'x'.repeat(201) }).success).toBe(false)
    expect(carimboSchema.safeParse({ ...c, rt: 3 }).success).toBe(false)
    const { rt: _rt, ...sem } = c
    expect(carimboSchema.safeParse(sem).success).toBe(false)
  })
})

describe('TIPOS e legendaDe', () => {
  it('tem os 13 tipos com nome, grupo e cor', () => {
    expect(Object.keys(TIPOS)).toHaveLength(13)
    expect(TIPOS.zona_obra.nome).toBe('Zona de obra')
    expect(TIPOS.extintor.grupo).toBe('icone')
  })

  it('só os tipos usados, na ordem fixa de TIPOS, sem repetir', () => {
    const l = legendaDe([
      { id: '1', t: 'emerg', at: [0.1, 0.1] },
      { id: '2', t: 'zona_obra', r: [0, 0, 0.1, 0.1] },
      { id: '3', t: 'emerg', at: [0.2, 0.2] },
      { id: '4', t: 'drywall', p: [[0, 0], [1, 1]] },
    ])
    expect(l).toEqual([
      { t: 'zona_obra', nome: 'Zona de obra' },
      { t: 'drywall', nome: 'Drywall piso a teto' },
      { t: 'emerg', nome: 'Luminária de emergência' },
    ])
    expect(legendaDe([])).toEqual([])
  })
})
