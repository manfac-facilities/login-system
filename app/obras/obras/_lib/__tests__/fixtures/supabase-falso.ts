/* Banco falso mínimo para testar Server Actions (from/select/eq/in/or/order/limit/insert/update/upsert/delete/rpc). */
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type Falso = {
  db: Record<string, Linha[]>
  /** Erro do próximo insert/update/upsert/delete (por tabela). */
  erroEscrita: Record<string, { message: string; code?: string } | undefined>
  /** Erro de toda leitura (select) da tabela — ex.: tabela que ainda não existe. */
  erroLeitura: Record<string, { message: string; code?: string } | undefined>
  rpcs: Record<string, (args: Record<string, unknown>) => { data: unknown; error: unknown }>
  cliente: (getUser: () => Promise<unknown>) => unknown
}

export function criarFalso(): Falso {
  let seq = 0
  const f: Falso = {
    db: {},
    erroEscrita: {},
    erroLeitura: {},
    rpcs: {},
    cliente: (getUser) => ({
      auth: { getUser },
      rpc: async (nome: string, args: Record<string, unknown>) => (f.rpcs[nome] ? f.rpcs[nome](args) : { data: null, error: { message: `rpc ${nome} ausente` } }),
      from: (t: string) => construtor(t),
    }),
  }
  function construtor(tabela: string) {
    const filtros: ((l: Linha) => boolean)[] = []
    let op = 'select'
    let payload: Linha = {}
    let ordem: string | null = null
    let desc = false
    let limite: number | null = null
    let conflito: string | null = null
    const executar = (unico: boolean) => {
      const linhas = (f.db[tabela] ??= [])
      if (op !== 'select' && f.erroEscrita[tabela]) return { data: null, error: f.erroEscrita[tabela] }
      if (op === 'select' && f.erroLeitura[tabela]) return { data: null, error: f.erroLeitura[tabela] }
      if (op === 'insert') {
        const nova = { id: `id${++seq}`, ...payload }
        linhas.push(nova)
        return { data: unico ? nova : [nova], error: null }
      }
      if (op === 'upsert') {
        const ja = conflito ? linhas.find((l) => l[conflito!] === payload[conflito!]) : undefined
        if (ja) Object.assign(ja, payload)
        else linhas.push({ id: `id${++seq}`, ...payload })
        return { data: null, error: null }
      }
      let alvo = linhas.filter((l) => filtros.every((x) => x(l)))
      if (op === 'delete') {
        f.db[tabela] = linhas.filter((l) => !alvo.includes(l))
        return { data: null, error: null }
      }
      if (op === 'update') alvo.forEach((l) => Object.assign(l, payload))
      if (ordem) alvo = [...alvo].sort((a, b) => (a[ordem!] > b[ordem!] ? 1 : a[ordem!] < b[ordem!] ? -1 : 0) * (desc ? -1 : 1))
      if (limite !== null) alvo = alvo.slice(0, limite)
      return { data: unico ? (alvo[0] ?? null) : alvo, error: null }
    }
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
      in: (c: string, v: unknown[]) => (filtros.push((l) => v.includes(l[c])), q),
      or: (expr: string) => {
        const partes = expr.split(',').map((p) => p.split('.eq.'))
        filtros.push((l) => partes.some(([c, v]) => String(l[c]) === v))
        return q
      },
      order: (c: string, o?: { ascending?: boolean }) => {
        if (!ordem) {
          ordem = c
          desc = o?.ascending === false
        }
        return q
      },
      limit: (n: number) => ((limite = n), q),
      insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
      upsert: (p: Linha, o?: { onConflict?: string }) => ((op = 'upsert'), (payload = p), (conflito = o?.onConflict ?? null), q),
      delete: () => ((op = 'delete'), q),
      update: (p: Linha) => ((op = 'update'), (payload = p), q),
      maybeSingle: async () => executar(true),
      single: async () => executar(true),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar(false)).then(ok, ko),
    }
    return q
  }
  return f
}
