import { feriadosDaObra, lerObraGrande } from '../leitura'

/**
 * Leva 2: feriados globais + da obra (§3.6) e critério do peso (§3.4).
 * Banco em memória que entende `.or('obra_id.is.null,obra_id.eq.<id>')`.
 */
type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
let erro: Record<string, { message: string } | undefined>

function chain(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  const executar = () =>
    erro[tabela] ? { data: null, error: erro[tabela] } : { data: (db[tabela] ?? []).filter((l) => filtros.every((f) => f(l))), error: null }
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'order', 'not', 'limit', 'in']) c[m] = () => c
  c.eq = (col: string, v: unknown) => (filtros.push((l) => l[col] === v), c)
  c.or = (expr: string) => {
    const m = /^obra_id\.is\.null,obra_id\.eq\.(.+)$/.exec(expr)
    if (!m) throw new Error(`or inesperado: ${expr}`)
    filtros.push((l) => (l.obra_id ?? null) === null || l.obra_id === m[1])
    return c
  }
  c.maybeSingle = async () => { const r = executar(); return { data: r.data?.[0] ?? null, error: r.error } }
  c.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, ko)
  return c
}
const supabase = { from: (t: string) => chain(t) } as never

const ver = { id: 'v1', obra_id: '00000000-0000-4000-8000-00000000000a', numero: 1, motivo: null, salva_em: '2026-10-01T00:00:00Z' }
const ativ = (numero: number, duracao: number, peso_valor: number) => ({
  versao_id: 'v1', numero, etapa: 'E', descricao: `a${numero}`, pred1: numero > 1 ? numero - 1 : null, pred2: null,
  duracao, bloqueia_por_trava: false, peso_valor,
})

beforeEach(() => {
  erro = {}
  db = {
    obras_obra: [
      { id: '00000000-0000-4000-8000-00000000000a', modalidade: 'obra', data_base: '2026-10-05', atividade_trava: null, peso_avanco: null },
      { id: '00000000-0000-4000-8000-00000000000b', modalidade: 'obra', data_base: '2026-10-05', atividade_trava: null, peso_avanco: null },
    ],
    obras_cronograma_versao: [ver],
    obras_atividade: [ativ(1, 1, 90), ativ(2, 9, 10)],
    obras_feriado: [
      { data: '2026-11-02', obra_id: null },
      { data: '2026-10-06', obra_id: '00000000-0000-4000-8000-00000000000a' },
      { data: '2026-10-07', obra_id: '00000000-0000-4000-8000-00000000000b' },
    ],
  }
})

describe('feriadosDaObra', () => {
  it('globais + os da própria obra; feriado da obra B não entra na A', async () => {
    const a = await feriadosDaObra(supabase, '00000000-0000-4000-8000-00000000000a')
    expect(a).toEqual({ ok: true, feriados: new Set(['2026-11-02', '2026-10-06']) })
    const b = await feriadosDaObra(supabase, '00000000-0000-4000-8000-00000000000b')
    expect(b).toEqual({ ok: true, feriados: new Set(['2026-11-02', '2026-10-07']) })
  })

  it('obraId fora do formato UUID: ok false, sem montar o filtro .or', async () => {
    expect(await feriadosDaObra(supabase, 'x,obra_id.not.is.null')).toEqual({ ok: false, erro: 'Obra inválida' })
  })

  it('erro do banco: ok false', async () => {
    erro.obras_feriado = { message: 'boom' }
    expect(await feriadosDaObra(supabase, '00000000-0000-4000-8000-00000000000a')).toEqual({ ok: false, erro: 'boom' })
  })
})

describe('lerObraGrande — Leva 2', () => {
  it('feriado da obra A muda as datas da A, não as da B', async () => {
    db.obras_cronograma_versao.push({ ...ver, id: 'vb', obra_id: '00000000-0000-4000-8000-00000000000b' })
    db.obras_atividade.push({ ...ativ(1, 1, 90), versao_id: 'vb' })
    const ra = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-05')
    const rb = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000b', '2026-10-05')
    if (!ra.ok || !rb.ok) throw new Error('falhou')
    // A: atividade 2 começa ter 06/10, que é feriado da A → qua 07/10.
    expect(ra.dados.calc?.atividades[1].inicioPrevisto).toBe('2026-10-07')
    expect(ra.dados.feriados.has('2026-10-07')).toBe(false)
    expect(rb.dados.feriados.has('2026-10-06')).toBe(false)
  })

  it('peso_avanco nulo com Σ valor > 0: por valor', async () => {
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-05')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.criterioPeso).toBe('valor')
    expect(r.dados.calc?.atividades.map((a) => a.peso)).toEqual([0.9, 0.1])
  })

  it('peso_avanco nulo com Σ valor = 0: por duração, na vigente e na base', async () => {
    db.obras_atividade = [ativ(1, 1, 0), ativ(2, 9, 0)]
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-05')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.criterioPeso).toBe('duracao')
    expect(r.dados.calc?.atividades.map((a) => a.peso)).toEqual([0.1, 0.9])
    expect(r.dados.calcBase?.atividades.map((a) => a.peso)).toEqual([0.1, 0.9])
  })

  it('peso_avanco explícito manda; coluna ausente = automático', async () => {
    db.obras_obra[0].peso_avanco = 'duracao'
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-05')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.criterioPeso).toBe('duracao')
    expect(r.dados.calc?.atividades.map((a) => a.peso)).toEqual([0.1, 0.9])
    delete db.obras_obra[0].peso_avanco
    const r2 = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-05')
    if (!r2.ok) throw new Error(r2.erro)
    expect(r2.dados.criterioPeso).toBe('valor')
  })

  it('base com durações próprias: peso da base usa as durações da base', async () => {
    db.obras_cronograma_versao.push({ ...ver, id: 'v2', numero: 2, motivo: 'replan', salva_em: '2026-10-08T00:00:00Z' })
    db.obras_obra[0].peso_avanco = 'duracao'
    db.obras_atividade.push({ ...ativ(1, 5, 90), versao_id: 'v2' }, { ...ativ(2, 5, 10), versao_id: 'v2' })
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-05')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.calc?.atividades.map((a) => a.peso)).toEqual([0.5, 0.5])
    expect(r.dados.calcBase?.atividades.map((a) => a.peso)).toEqual([0.1, 0.9])
  })
})
