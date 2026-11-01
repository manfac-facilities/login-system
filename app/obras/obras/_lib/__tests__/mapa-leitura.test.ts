import { lerMapa, lerFotosDoMapa, lerReferenciasDosPontos, montarMapa, LIMITE_FOTOS_MAPA } from '../mapa-leitura'

type R = { data: unknown; error: unknown }
let tabelas: Record<string, R> = {}
const chamadas: { tabela: string; metodo: string; args: unknown[] }[] = []

function chain(tabela: string) {
  const r = tabelas[tabela] ?? { data: [], error: null }
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order', 'or', 'lt', 'limit']) {
    c[m] = jest.fn((...args: unknown[]) => { chamadas.push({ tabela, metodo: m, args }); return c })
  }
  c.maybeSingle = jest.fn(async () => r)
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(r).then(res, rej)
  return c
}
const supabase = { from: jest.fn((t: string) => chain(t)) } as never

beforeEach(() => { tabelas = {}; chamadas.length = 0 })

describe('montarMapa', () => {
  it('obra sem mapa configurado: modo ambientes, sem planta', () => {
    const m = montarMapa({ mapa: null, ambientes: [], pontos: [], vinculos: [] })
    expect(m.configurado).toBe(false)
    expect(m.mapa).toEqual({ modo: 'ambientes', plantaPath: null, plantaLargura: null, plantaAltura: null })
  })
  it('converte numerics, ordena e descarta vínculo de ambiente ausente', () => {
    const m = montarMapa({
      mapa: { modo: 'planta', planta_path: 'o/mapa/x.png', planta_largura: 1000, planta_altura: 500 },
      ambientes: [
        { id: 'b', nome: 'Sala', area_m2: '12.50', x: '0.1', y: '0.2', w: '0.3', h: '0.4', ordem: 2 },
        { id: 'a', nome: 'Copa', area_m2: null, x: null, y: null, w: null, h: null, ordem: 1 },
      ],
      pontos: [
        { id: 'p2', numero: 2, nome: 'B', ambiente_id: 'b', x: null, y: null, ativo: false },
        { id: 'p1', numero: 1, nome: 'A', ambiente_id: 'a', x: '0.5', y: '0.5', ativo: true },
      ],
      vinculos: [
        { ambiente_id: 'a', atividade_numero: 3 }, { ambiente_id: 'zz', atividade_numero: 4 },
      ],
    })
    expect(m.mapa.modo).toBe('planta')
    expect(m.ambientes.map((a) => a.id)).toEqual(['a', 'b'])
    expect(m.ambientes[1]).toMatchObject({ areaM2: 12.5, x: 0.1, h: 0.4 })
    expect(m.pontos.map((p) => [p.numero, p.ativo, p.x])).toEqual([[1, true, 0.5], [2, false, null]])
    expect(m.vinculos).toEqual([{ ambienteId: 'a', atividadeNumero: 3 }])
  })
  it('modo desconhecido cai em ambientes', () => {
    expect(montarMapa({ mapa: { modo: 'x' }, ambientes: [], pontos: [], vinculos: [] }).mapa.modo).toBe('ambientes')
  })
})

describe('lerMapa', () => {
  it('lê as quatro tabelas e monta', async () => {
    tabelas = {
      obras_mapa: { data: { modo: 'croqui' }, error: null },
      obras_ambiente: { data: [{ id: 'a', nome: 'Sala', ordem: 0 }], error: null },
      obras_ponto_foto: { data: [{ id: 'p', numero: 1, nome: 'P', ambiente_id: 'a', ativo: true }], error: null },
      obras_ambiente_atividade: { data: [{ ambiente_id: 'a', atividade_numero: 1 }], error: null },
    }
    const r = await lerMapa(supabase, 'obra')
    expect(r.ok && r.dados.mapa.modo).toBe('croqui')
    expect(r.ok && r.dados.vinculos).toHaveLength(1)
  })
  it('sem ambientes não consulta vínculos', async () => {
    await lerMapa(supabase, 'obra')
    expect(chamadas.some((c) => c.tabela === 'obras_ambiente_atividade')).toBe(false)
  })
  it('erro em qualquer leitura vira ok:false', async () => {
    tabelas = { obras_ponto_foto: { data: null, error: { message: 'boom' } } }
    const r = await lerMapa(supabase, 'obra')
    expect(r).toEqual({ ok: false, erro: 'Falha ao ler o mapa: boom' })
  })
  it('erro nos vínculos vira ok:false', async () => {
    tabelas = {
      obras_ambiente: { data: [{ id: 'a', nome: 'S', ordem: 0 }], error: null },
      obras_ambiente_atividade: { data: null, error: { message: 'v' } },
    }
    expect((await lerMapa(supabase, 'obra')).ok).toBe(false)
  })
})

describe('lerFotosDoMapa', () => {
  const linha = {
    id: 'f', rdo_id: 'r', path: 'o/rdo/d/u.jpg', legenda: null, ordem: 1,
    ambiente_id: 'a', ponto_id: 'p', atividade_numero: 4, obras_rdo: { data: '2026-10-05', estado: 'validado', obra_id: 'obra' },
  }
  it('converte com data e estado do RDO e filtra pela obra', async () => {
    tabelas = { obras_rdo_foto: { data: [linha], error: null } }
    const r = await lerFotosDoMapa(supabase, 'obra')
    expect(r.ok && r.fotos[0]).toEqual({
      id: 'f', rdoId: 'r', path: 'o/rdo/d/u.jpg', legenda: null, ordem: 1, data: '2026-10-05', estado: 'validado',
      ambienteId: 'a', pontoId: 'p', atividadeNumero: 4,
    })
    expect(chamadas).toContainEqual({ tabela: 'obras_rdo_foto', metodo: 'eq', args: ['obras_rdo.obra_id', 'obra'] })
    expect(chamadas.some((c) => c.metodo === 'or')).toBe(true)
  })
  it('com pontoId filtra o ponto (e não o or)', async () => {
    tabelas = { obras_rdo_foto: { data: [], error: null } }
    await lerFotosDoMapa(supabase, 'obra', { pontoId: 'p' })
    expect(chamadas).toContainEqual({ tabela: 'obras_rdo_foto', metodo: 'eq', args: ['ponto_id', 'p'] })
    expect(chamadas.some((c) => c.metodo === 'or')).toBe(false)
  })
  it('aceita obras_rdo como array e foto sem vínculos (nulos)', async () => {
    tabelas = { obras_rdo_foto: { data: [{ ...linha, obras_rdo: [linha.obras_rdo], ambiente_id: null, ponto_id: null, atividade_numero: null }], error: null } }
    const r = await lerFotosDoMapa(supabase, 'obra')
    expect(r.ok && r.fotos[0]).toMatchObject({ data: '2026-10-05', ambienteId: null, pontoId: null, atividadeNumero: null })
  })
  it('erro vira ok:false', async () => {
    tabelas = { obras_rdo_foto: { data: null, error: { message: 'x' } } }
    expect((await lerFotosDoMapa(supabase, 'obra')).ok).toBe(false)
  })
  it('sempre ordena pela data do RDO (desc por padrão) e limita explicitamente', async () => {
    await lerFotosDoMapa(supabase, 'obra')
    expect(chamadas).toContainEqual({ tabela: 'obras_rdo_foto', metodo: 'order', args: ['obras_rdo(data)', { ascending: false }] })
    expect(chamadas).toContainEqual({ tabela: 'obras_rdo_foto', metodo: 'order', args: ['ordem', { ascending: false }] })
    expect(chamadas).toContainEqual({ tabela: 'obras_rdo_foto', metodo: 'limit', args: [LIMITE_FOTOS_MAPA] })
  })
  it('filtros: ambiente, antes de, estados, ascendente e limite', async () => {
    await lerFotosDoMapa(supabase, 'obra', { ambienteId: 'a', antesDe: '2026-11-01', estados: ['validado', 'enviado'], ascendente: true, limite: 6 })
    expect(chamadas).toEqual(expect.arrayContaining([
      { tabela: 'obras_rdo_foto', metodo: 'eq', args: ['ambiente_id', 'a'] },
      { tabela: 'obras_rdo_foto', metodo: 'lt', args: ['obras_rdo.data', '2026-11-01'] },
      { tabela: 'obras_rdo_foto', metodo: 'in', args: ['obras_rdo.estado', ['validado', 'enviado']] },
      { tabela: 'obras_rdo_foto', metodo: 'order', args: ['obras_rdo(data)', { ascending: true }] },
      { tabela: 'obras_rdo_foto', metodo: 'limit', args: [6] },
    ]))
    expect(chamadas.some((c) => c.metodo === 'or')).toBe(false)
  })
  it('referências dos pontos: uma consulta limit 1 por ponto, antes do dia', async () => {
    tabelas = { obras_rdo_foto: { data: [linha], error: null } }
    const r = await lerReferenciasDosPontos(supabase, 'obra', ['p1', 'p2'], '2026-11-01')
    expect(r.ok && [...r.referencias.keys()]).toEqual(['p1', 'p2'])
    expect(chamadas.filter((c) => c.metodo === 'limit')).toEqual([
      { tabela: 'obras_rdo_foto', metodo: 'limit', args: [1] },
      { tabela: 'obras_rdo_foto', metodo: 'limit', args: [1] },
    ])
    expect(chamadas.filter((c) => c.metodo === 'lt')).toHaveLength(2)
  })
})
