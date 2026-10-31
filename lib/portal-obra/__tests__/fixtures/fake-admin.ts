/**
 * Cliente admin falso, em memória, com o subconjunto do query builder do supabase-js
 * que o portal usa. Filtros valem para select, update e count — o que permite testar
 * o compare-and-swap das tentativas e do uso único de verdade.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

export type FakeDb = Record<string, Row[]>

const comoTempo = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? Date.parse(v) : v)

class Query implements PromiseLike<any> {
  private filtros: ((r: Row) => boolean)[] = []
  private op: 'select' | 'update' | 'insert' = 'select'
  private patch: Row | Row[] | null = null
  private retorna = false
  private head = false
  private ordem: { col: string; asc: boolean } | null = null
  private lim: number | null = null
  private unico: 'maybe' | 'single' | null = null

  constructor(private fake: FakeAdmin, private tabela: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.head = !!opts?.head
    } else this.retorna = true
    return this
  }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.patch = rows; return this }
  update(p: Row) { this.op = 'update'; this.patch = p; return this }
  eq(c: string, v: any) { this.filtros.push((r) => r[c] === v); return this }
  is(c: string, v: null) { this.filtros.push((r) => (r[c] ?? null) === v); return this }
  gt(c: string, v: any) { this.filtros.push((r) => comoTempo(r[c]) > comoTempo(v)); return this }
  gte(c: string, v: any) { this.filtros.push((r) => comoTempo(r[c]) >= comoTempo(v)); return this }
  lt(c: string, v: any) { this.filtros.push((r) => comoTempo(r[c]) < comoTempo(v)); return this }
  in(c: string, vs: any[]) { this.filtros.push((r) => vs.includes(r[c])); return this }
  order(col: string, o?: { ascending?: boolean }) { this.ordem = { col, asc: o?.ascending !== false }; return this }
  limit(n: number) { this.lim = n; return this }
  maybeSingle() { this.unico = 'maybe'; return this }
  single() { this.unico = 'single'; return this }

  private executar(): { data: any; error: any; count?: number | null } {
    this.fake.chamadas.push({ tabela: this.tabela, op: this.op, patch: this.patch })
    if (this.fake.falhar.has(this.tabela) || this.fake.falhar.has(`${this.tabela}:${this.op}`)) {
      return { data: null, error: { message: 'falha simulada' }, count: null }
    }
    const linhas = (this.fake.db[this.tabela] ??= [])
    if (this.op === 'insert') {
      const novas = (Array.isArray(this.patch) ? this.patch : [this.patch!]).map((r) => ({
        id: `id-${++this.fake.seq}`, criado_em: this.fake.agora().toISOString(), ...r,
      }))
      linhas.push(...novas)
      return { data: this.retorna ? novas : null, error: null }
    }
    let alvo = linhas.filter((r) => this.filtros.every((f) => f(r)))
    if (this.op === 'update') {
      alvo.forEach((r) => Object.assign(r, this.patch))
      return { data: this.retorna ? alvo.map((r) => ({ ...r })) : null, error: null }
    }
    if (this.head) return { data: null, error: null, count: alvo.length }
    if (this.ordem) {
      const { col, asc } = this.ordem
      alvo = [...alvo].sort((a, b) => (comoTempo(a[col]) < comoTempo(b[col]) ? -1 : 1) * (asc ? 1 : -1))
    }
    if (this.lim !== null) alvo = alvo.slice(0, this.lim)
    const copia = alvo.map((r) => ({ ...r }))
    if (this.unico) {
      if (copia.length > 1) return { data: null, error: { message: 'mais de uma linha' } }
      return { data: copia[0] ?? null, error: null }
    }
    return { data: copia, error: null }
  }

  then<A, B>(ok?: ((v: any) => A | PromiseLike<A>) | null, erro?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.executar()).then(ok, erro)
  }
}

export class FakeAdmin {
  seq = 0
  chamadas: { tabela: string; op: string; patch: any }[] = []
  falhar = new Set<string>()
  constructor(public db: FakeDb = {}, public agora: () => Date = () => new Date()) {}
  from(tabela: string) { return new Query(this, tabela) }
}
