/**
 * Banco em memória mínimo para as actions e a rota de PDF do faseamento. Imita
 * só o que o banco atribui (numero da fase, revisao/status da revisão, a
 * emissão pela rpc congelando planta e fase) e um erro forçado por
 * `tabela.op`, para conferir a tradução em pt-BR.
 */
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type ErroBanco = { message: string; code?: string; details?: string }

export type Banco = {
  db: Record<string, Linha[]>
  erro: Record<string, ErroBanco | undefined>
  rpcChamadas: { nome: string; args: Record<string, unknown> }[]
  assinadas: string[]
  cliente: (getUser: () => Promise<unknown>) => unknown
}

export function criarBanco(): Banco {
  let seq = 0
  const b: Banco = {
    db: {},
    erro: {},
    rpcChamadas: [],
    assinadas: [],
    cliente: (getUser) => ({
      auth: { getUser },
      from: (t: string) => construtor(t),
      rpc: async (nome: string, args: Record<string, unknown>) => {
        b.rpcChamadas.push({ nome, args })
        if (b.erro[`rpc.${nome}`]) return { data: null, error: b.erro[`rpc.${nome}`] }
        if (nome !== 'obras_emitir_fase_revisao') return { data: null, error: { message: `rpc ${nome} ausente` } }
        const r = (b.db.obras_fase_revisao ?? []).find((x) => x.id === args.p_revisao && x.status === 'rascunho')
        if (!r) return { data: null, error: { message: 'OBRAS_FASEAMENTO: revisão não encontrada ou já emitida', code: 'P0002' } }
        const fase = (b.db.obras_fase ?? []).find((f) => f.id === r.fase_id)!
        const mapa = (b.db.obras_mapa ?? []).find((m) => m.obra_id === r.obra_id)
        Object.assign(r, {
          status: 'emitida',
          emitida_em: '2026-11-01T15:00:00Z',
          emitida_por: 'quem@manfac.com.br',
          fase_nome: fase.nome,
          fase_numero: fase.numero,
          planta_path: mapa?.planta_path ?? null,
          planta_largura: mapa?.planta_path ? mapa.planta_largura : null,
          planta_altura: mapa?.planta_path ? mapa.planta_altura : null,
        })
        return { data: r, error: null }
      },
      storage: {
        from: () => ({
          createSignedUrl: async (path: string) => {
            b.assinadas.push(path)
            return { data: { signedUrl: `https://assinada/${path}` }, error: null }
          },
        }),
      },
    }),
  }

  function construtor(tabela: string) {
    const filtros: ((l: Linha) => boolean)[] = []
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Linha = {}
    let ordem: { c: string; desc: boolean } | null = null
    const executar = (unico: 'single' | 'maybe' | null) => {
      const forcado = b.erro[`${tabela}.${op}`]
      if (forcado) return { data: null, error: forcado }
      const linhas = (b.db[tabela] ??= [])
      let data: Linha[]
      if (op === 'insert') {
        const extra: Linha = {}
        if (tabela === 'obras_fase') extra.numero = linhas.filter((l) => l.obra_id === payload.obra_id).length + 1
        if (tabela === 'obras_fase_revisao') {
          const da = linhas.filter((l) => l.fase_id === payload.fase_id)
          if (da.some((l) => l.status === 'rascunho')) {
            return { data: null, error: { message: 'OBRAS_FASEAMENTO: esta fase já tem uma revisão em rascunho', code: '23505' } }
          }
          extra.revisao = da.reduce((m, l) => Math.max(m, l.revisao), -1) + 1
          extra.status = 'rascunho'
        }
        const nova = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, ...payload, ...extra }
        linhas.push(nova)
        data = [nova]
      } else {
        data = linhas.filter((l) => filtros.every((f) => f(l)))
        if (op === 'update') data.forEach((l) => Object.assign(l, payload))
        if (op === 'delete') b.db[tabela] = linhas.filter((l) => !data.includes(l))
        if (ordem) {
          const { c, desc } = ordem
          data = [...data].sort((x, y) => (x[c] > y[c] ? 1 : x[c] < y[c] ? -1 : 0) * (desc ? -1 : 1))
        }
      }
      if (unico === 'single') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'not single' } }
      if (unico === 'maybe') return { data: data[0] ?? null, error: null }
      return { data, error: null }
    }
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
      in: (c: string, v: unknown[]) => (filtros.push((l) => v.includes(l[c])), q),
      overlaps: (c: string, v: unknown[]) => (filtros.push((l) => ((l[c] ?? []) as unknown[]).some((x) => v.includes(x))), q),
      order: (c: string, o?: { ascending?: boolean }) => ((ordem ??= { c, desc: o?.ascending === false }), q),
      limit: () => q,
      insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
      update: (p: Linha) => ((op = 'update'), (payload = p), q),
      delete: () => ((op = 'delete'), q),
      maybeSingle: async () => executar('maybe'),
      single: async () => executar('single'),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar(null)).then(ok, ko),
    }
    return q
  }
  return b
}
