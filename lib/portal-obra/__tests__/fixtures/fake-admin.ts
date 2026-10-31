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
  private ordens: { col: string; asc: boolean }[] = []
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
  order(col: string, o?: { ascending?: boolean }) { this.ordens.push({ col, asc: o?.ascending !== false }); return this }
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
        id: `id-${String(++this.fake.seq).padStart(6, '0')}`, criado_em: this.fake.agora().toISOString(), ...r,
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
    if (this.ordens.length) {
      alvo = [...alvo].sort((a, b) => {
        for (const { col, asc } of this.ordens) {
          const x = comoTempo(a[col]), y = comoTempo(b[col])
          if (x !== y) return (x < y ? -1 : 1) * (asc ? 1 : -1)
        }
        return 0
      })
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

  /**
   * Espelho de `obras_portal_emitir_codigo` (sdd-sql-obras-leva5.sql): conta e grava num
   * passo só (como as travas de transação), aposenta os códigos vivos do e-mail.
   */
  async rpc(nome: string, p: Record<string, any>) {
    this.chamadas.push({ tabela: `rpc:${nome}`, op: 'rpc', patch: p })
    if (this.falhar.has(`rpc:${nome}`)) return { data: null, error: { message: 'falha simulada' } }
    if (nome !== 'obras_portal_emitir_codigo') return { data: null, error: { message: 'rpc desconhecida' } }
    const linhas = (this.db.obras_portal_codigo ??= [])
    const agora = this.agora()
    const desde = agora.getTime() - 60 * 60_000
    const email = String(p.p_email).trim().toLowerCase()
    const naHora = linhas.filter((r) => Date.parse(r.criado_em) > desde)
    if (naHora.filter((r) => r.email === email).length >= 5) return { data: false, error: null }
    if (naHora.filter((r) => (r.ip ?? null) === (p.p_ip ?? null)).length >= 20) return { data: false, error: null }
    linhas.filter((r) => r.email === email && (r.usado_em ?? null) === null).forEach((r) => { r.usado_em = agora.toISOString() })
    linhas.push({
      id: `id-${String(++this.seq).padStart(6, '0')}`, email, codigo_hash: p.p_codigo_hash, expira_em: p.p_expira_em,
      tentativas: 0, usado_em: null, criado_em: agora.toISOString(), ip: p.p_ip,
    })
    return { data: true, error: null }
  }
}
