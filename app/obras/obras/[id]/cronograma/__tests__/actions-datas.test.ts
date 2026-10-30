/**
 * Server Actions do cronograma da OBRA (Task 7). O Supabase é um banco em
 * memória mínimo (select/eq/is/in/update/insert/upsert) que imita também o
 * trigger OBRAS_VERSAO_SALVA, para provar a tradução da mensagem.
 */

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
let erroForcado: Record<string, { message: string } | undefined>
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op: 'select' | 'update' | 'insert' | 'upsert' = 'select'
  let payload: Linha | Linha[] | null = null
  let unico: 'maybe' | 'single' | null = null

  const executar = () => {
    const forcado = erroForcado[`${tabela}.${op}`]
    if (forcado) return { data: null, error: forcado }
    const linhas = (db[tabela] ??= [])
    const alvo = () => linhas.filter((l) => filtros.every((f) => f(l)))
    // Trigger obras_atividade_imutavel / obras_versao_imutavel.
    const salva = (versaoId: unknown) =>
      (db.obras_cronograma_versao ?? []).some((v) => v.id === versaoId && v.salva_em)
    let data: Linha[]
    if (op === 'select') data = alvo()
    else if (op === 'update') {
      data = alvo()
      if (tabela === 'obras_atividade' && data.some((l) => salva(l.versao_id)))
        return { data: null, error: { message: 'OBRAS_VERSAO_SALVA: versão de cronograma já salva não pode ser alterada' } }
      if (tabela === 'obras_cronograma_versao' && data.some((l) => l.salva_em))
        return { data: null, error: { message: 'OBRAS_VERSAO_SALVA: versão de cronograma já salva não pode ser alterada' } }
      data.forEach((l) => Object.assign(l, payload))
    } else if (op === 'insert') {
      const novas = (Array.isArray(payload) ? payload : [payload!]).map((p): Linha => ({ id: `id${++seq}`, ...p }))
      if (tabela === 'obras_atividade' && novas.some((l) => salva(l.versao_id)))
        return { data: null, error: { message: 'OBRAS_VERSAO_SALVA: x' } }
      linhas.push(...novas)
      data = novas
    } else {
      const p = payload as Linha
      const existente = linhas.find((l) => l.obra_id === p.obra_id && l.numero === p.numero)
      if (existente) Object.assign(existente, p)
      else linhas.push({ ...p })
      data = [existente ?? p]
    }
    if (unico === 'single') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'not single' } }
    if (unico === 'maybe') return { data: data[0] ?? null, error: null }
    return { data, error: null }
  }

  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    is: (c: string, v: unknown) => (filtros.push((l) => (l[c] ?? null) === v), q),
    in: (c: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[c])), q),
    order: () => q,
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    insert: (p: Linha | Linha[]) => ((op = 'insert'), (payload = p), q),
    upsert: (p: Linha) => ((op = 'upsert'), (payload = p), q),
    maybeSingle: async () => ((unico = 'maybe'), executar()),
    single: async () => ((unico = 'single'), executar()),
    then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, falha),
  }
  return q
}

const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t) })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import { revalidatePath } from 'next/cache'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { definirFimAction, definirInicioAction } from '../_actions'

/**
 * Edição de datas na árvore (Leva 1, Task 5): Início digitado grava
 * `inicio_fixo`; Fim digitado grava só a duração (spec §5 e §8.1 item 4).
 * Mock do banco copiado de `actions.test.ts` (mais `obras_feriado`).
 */
const ENG = 'eduardo@manfac.com.br'
const OBRA = 'o1'

function atv(numero: number, over: Linha = {}): Linha {
  return {
    id: `a-${numero}`, versao_id: 'v1', obra_id: OBRA, numero, frente: 'F', etapa: 'E',
    descricao: `Atividade ${numero}`, saida_trava: null, pred1: numero > 1 ? numero - 1 : null, pred2: null,
    duracao: 2, responsavel_funcao: null, bloqueia_por_trava: false, peso_valor: 100, inicio_fixo: null, ...over,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  seq = 0
  erroForcado = {}
  db = {
    // Quinta 29/10/2026; Finados (02/11) é feriado.
    obras_obra: [{ id: OBRA, modalidade: 'obra', engenheiro_email: ENG, atividade_trava: null, data_base: '2026-10-29' }],
    obras_cronograma_versao: [{ id: 'v1', obra_id: OBRA, numero: 1, motivo: null, salva_em: null, salva_por: null }],
    obras_atividade: [atv(1), atv(2), atv(3)],
    obras_atividade_exec: [],
    obras_feriado: [{ data: '2026-11-02' }],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: ENG } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
})

const linhaDe = (n: number) => db.obras_atividade.find((a) => a.numero === n)!

describe('guardas', () => {
  it('quem não é engenheiro nem admin é recusado, sem gravar', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'outro@manfac.com.br' } } })
    const SEM = { ok: false, erro: 'Só o engenheiro da obra ou um administrador altera o cronograma' }
    expect(await definirInicioAction(OBRA, 'v1', 2, '2026-11-04')).toEqual(SEM)
    expect(await definirFimAction(OBRA, 'v1', 1, '2026-11-03')).toEqual(SEM)
    expect(linhaDe(2).inicio_fixo).toBeNull()
    expect(linhaDe(1).duracao).toBe(2)
  })

  it('versão salva recusa as duas, sem gravar', async () => {
    db.obras_cronograma_versao[0].salva_em = '2026-10-29T12:00:00Z'
    const SALVA = { ok: false, erro: 'Versão salva não se altera — crie uma revisão' }
    expect(await definirInicioAction(OBRA, 'v1', 2, '2026-11-04')).toEqual(SALVA)
    expect(await definirFimAction(OBRA, 'v1', 1, '2026-11-03')).toEqual(SALVA)
    expect(linhaDe(2).inicio_fixo).toBeNull()
    expect(linhaDe(1).duracao).toBe(2)
  })

  it('data malformada e atividade inexistente', async () => {
    expect(await definirInicioAction(OBRA, 'v1', 2, '04/11/2026')).toEqual({ ok: false, erro: 'Data inválida' })
    expect(await definirFimAction(OBRA, 'v1', 99, '2026-11-03')).toEqual({
      ok: false, erro: 'Atividade 99 não existe neste cronograma',
    })
  })
})

describe('definirInicioAction', () => {
  it('grava o início fixo e revalida; null volta a seguir as predecessoras', async () => {
    expect(await definirInicioAction(OBRA, 'v1', 2, '2026-11-04')).toEqual({ ok: true })
    expect(linhaDe(2).inicio_fixo).toBe('2026-11-04')
    expect(revalidatePath).toHaveBeenCalledWith(`/obras/obras/${OBRA}`, 'layout')
    expect(await definirInicioAction(OBRA, 'v1', 2, null)).toEqual({ ok: true })
    expect(linhaDe(2).inicio_fixo).toBeNull()
  })
})

describe('definirFimAction', () => {
  it('sem início fixo: grava só a duração (29/10 → 03/11, com Finados = 3 dias úteis)', async () => {
    expect(await definirFimAction(OBRA, 'v1', 1, '2026-11-03')).toEqual({ ok: true })
    expect(linhaDe(1).duracao).toBe(3)
    expect(linhaDe(1).inicio_fixo).toBeNull()
  })

  it('com início fixo: duração entre ele (próximo dia útil) e o fim', async () => {
    // Sábado 31/10 → seg 02/11 é feriado → começa 03/11; até 05/11 = 3 dias.
    linhaDe(2).inicio_fixo = '2026-10-31'
    expect(await definirFimAction(OBRA, 'v1', 2, '2026-11-05')).toEqual({ ok: true })
    expect(linhaDe(2).duracao).toBe(3)
    expect(linhaDe(2).inicio_fixo).toBe('2026-10-31')
  })

  it('fim antes do início → mensagem com a data do início, sem gravar', async () => {
    expect(await definirFimAction(OBRA, 'v1', 1, '2026-10-28')).toEqual({ ok: false, erro: 'Fim antes do início (29/10)' })
    expect(linhaDe(1).duracao).toBe(2)
  })
})
