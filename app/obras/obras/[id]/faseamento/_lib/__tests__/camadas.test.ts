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

  it('recusa Infinity, coordenada em texto, r/ponto com tamanho errado e arrays esparsos', () => {
    expect(ok([{ id: 'a', t: 'extintor', at: [Infinity, 0.5] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'extintor', at: ['0.5', 0.5] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'zona_obra', r: [0.1, 0.1, 0.2] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'extintor', at: [0.1, 0.1, 0.1] }])).toBe(false)
    expect(ok([{ id: 'a', t: 'drywall', p: [[0, 0], [0.1, 0.1, 0.1]] }])).toBe(false)
    // eslint-disable-next-line no-sparse-arrays
    expect(ok([{ id: 'a', t: 'zona_obra', r: [0.1, , 0.2, 0.2] }])).toBe(false)
    // eslint-disable-next-line no-sparse-arrays
    expect(ok([{ id: 'a', t: 'drywall', p: [[0, 0], , [1, 1]] }])).toBe(false)
  })

  it('polilinha com exatamente 2 pontos é aceita; id duplicado é recusado', () => {
    expect(ok([{ id: 'a', t: 'balcao', p: [[0, 0], [1, 1]] }])).toBe(true)
    const dup = [
      { id: 'a', t: 'extintor', at: [0.1, 0.1] },
      { id: 'a', t: 'emerg', at: [0.2, 0.2] },
    ]
    expect(ok(dup)).toBe(false)
  })

  it('descarta campo extra e __proto__ na saída', () => {
    const entrada = JSON.parse(
      '[{"id":"a","t":"extintor","at":[0.5,0.5],"extra":"x","__proto__":{"admin":true}},{"id":"b","t":"zona_obra","r":[0,0,0.5,0.5],"rot":"  Zona\\n  A ","extra":1}]',
    )
    const r = camadasSchema.safeParse(entrada)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data[0]).toEqual({ id: 'a', t: 'extintor', at: [0.5, 0.5] })
    expect(Object.keys(r.data[0])).toEqual(['id', 't', 'at'])
    expect((r.data[0] as Record<string, unknown>).admin).toBeUndefined()
    expect(r.data[1]).toEqual({ id: 'b', t: 'zona_obra', r: [0, 0, 0.5, 0.5], rot: 'Zona A' })
  })

  it('zona: w e h > 0, dentro da planta (tolerância 1e-6); rot até 120; oculta booleana mantida', () => {
    const z = (r: number[], extra = {}) => [{ id: 'a', t: 'zona_obra', r, ...extra }]
    expect(ok(z([0, 0, 1, 1]))).toBe(true)
    expect(ok(z([0.5, 0.5, 0.5 + 1e-7, 0.2]))).toBe(true)
    expect(ok(z([0.5, 0.5, 0.6, 0.2]))).toBe(false)
    expect(ok(z([0.5, 0.5, 0.2, 0.6]))).toBe(false)
    expect(ok(z([0.1, 0.1, 0, 0.2]))).toBe(false)
    expect(ok(z([0.1, 0.1, 0.2, 0]))).toBe(false)
    expect(ok(z([0.1, 0.1, 0.2, 0.2], { rot: 'x'.repeat(120) }))).toBe(true)
    expect(ok(z([0.1, 0.1, 0.2, 0.2], { rot: 'x'.repeat(121) }))).toBe(false)
    expect(ok(z([0.1, 0.1, 0.2, 0.2], { rot: null }))).toBe(true)
    const r = camadasSchema.safeParse([
      ...z([0.1, 0.1, 0.2, 0.2], { oculta: true }),
      { id: 'b', t: 'extintor', at: [0.5, 0.5], oculta: false },
      { id: 'c', t: 'drywall', p: [[0, 0], [1, 1]], oculta: true },
    ])
    expect(r.success && r.data.map((c) => c.oculta)).toEqual([true, false, true])
    expect(ok([{ id: 'a', t: 'extintor', at: [0.5, 0.5], oculta: 'sim' }])).toBe(false)
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
  it('regras: até 12 textos de 1 a 200 caracteres, aparados', () => {
    expect(regrasSchema.safeParse(Array.from({ length: 12 }, () => 'ok')).success).toBe(true)
    expect(regrasSchema.safeParse(Array.from({ length: 13 }, () => 'ok')).success).toBe(false)
    expect(regrasSchema.safeParse(['']).success).toBe(false)
    expect(regrasSchema.safeParse(['   \n ']).success).toBe(false)
    expect(regrasSchema.safeParse(['x'.repeat(200)]).success).toBe(true)
    expect(regrasSchema.safeParse(['x'.repeat(201)]).success).toBe(false)
    expect(regrasSchema.safeParse([1]).success).toBe(false)
    // array esparso: o buraco conta como inválido
    // eslint-disable-next-line no-sparse-arrays
    expect(regrasSchema.safeParse(['a', , 'b']).success).toBe(false)
    const r = regrasSchema.safeParse(['  texto  '])
    expect(r.success && r.data).toEqual(['texto'])
  })

  it('carimbo: cinco strings curtas', () => {
    const c = { titulo: 'Fase 1', cliente: 'DPSP', desenho: 'Planta', base: 'Layout', rt: 'Eng. X CREA 1' }
    expect(carimboSchema.safeParse(c).success).toBe(true)
    expect(carimboSchema.safeParse({ ...c, rt: 'x'.repeat(301) }).success).toBe(false)
    expect(carimboSchema.safeParse({ ...c, rt: 3 }).success).toBe(false)
    const l = carimboSchema.safeParse({ ...c, rt: ' Eng.\n  X   CREA 1 ' })
    expect(l.success && l.data.rt).toBe('Eng. X CREA 1')
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

  it('camadas ocultas não entram na legenda', () => {
    expect(legendaDe([{ t: 'extintor', oculta: true }, { t: 'emerg' }])).toEqual([{ t: 'emerg', nome: 'Luminária de emergência' }])
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
