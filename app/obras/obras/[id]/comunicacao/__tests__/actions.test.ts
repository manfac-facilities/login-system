type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
let db: Record<string, Linha[]>
let erroBanco: { message: string; code?: string } | null
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op = 'select'
  let payload: Linha = {}
  const executar = (unico: boolean) => {
    if (erroBanco && op !== 'select') return { data: null, error: erroBanco }
    const linhas = (db[tabela] ??= [])
    if (op === 'insert') {
      const nova = { id: `id${++seq}`, ...payload }
      linhas.push(nova)
      return { data: unico ? nova : [nova], error: null }
    }
    const alvo = linhas.filter((l) => filtros.every((f) => f(l)))
    if (op === 'update') alvo.forEach((l) => Object.assign(l, payload))
    return { data: unico ? (alvo[0] ?? null) : alvo, error: null }
  }
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    not: (c: string, _o: string, v: unknown) => (filtros.push((l) => l[c] !== v), q),
    insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    maybeSingle: async () => executar(true),
    single: async () => executar(true),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar(false)).then(ok, ko),
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

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { salvarConfigObraAction, salvarDestinatarioAction } from '../_actions'
import type { DestinatarioEntrada } from '../_tipos'

const OBRA = 'o1'
const dest = (over: Partial<DestinatarioEntrada> = {}): DestinatarioEntrada => ({
  nome: 'Ana',
  funcao: 'Gerente',
  email: '  Ana@Cliente.com ',
  lado: 'cliente',
  tipos: ['diario'],
  ativo: true,
  ...over,
})

beforeEach(() => {
  seq = 0
  erroBanco = null
  db = {
    obras_obra: [{ id: OBRA, modalidade: 'obra', data_base: '2026-10-01', engenheiro_email: null, atividade_trava: null }],
    obras_cronograma_versao: [],
    obras_destinatario: [],
  }
  getUserMock.mockResolvedValue({ data: { user: { email: 'adm@manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockImplementation(async (_s, email: string) => email === 'adm@manfac.com.br')
  ;(hasSystemAccess as jest.Mock).mockImplementation(async (_s, email: string) => email === 'eng@manfac.com.br')
})

describe('salvarDestinatarioAction', () => {
  it('não-admin → erro', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'x@manfac.com.br' } } })
    const r = await salvarDestinatarioAction(OBRA, dest())
    expect(r.ok).toBe(false)
    expect(db.obras_destinatario).toHaveLength(0)
  })
  it('e-mail inválido → erro', async () => {
    expect((await salvarDestinatarioAction(OBRA, dest({ email: 'sem-arroba' }))).ok).toBe(false)
  })
  it('tipos vazio → erro', async () => {
    const r = await salvarDestinatarioAction(OBRA, dest({ tipos: [] }))
    expect(r).toEqual({ ok: false, erro: 'Escolha ao menos um tipo de envio' })
  })
  it('insere com e-mail minúsculo e aparado', async () => {
    const r = await salvarDestinatarioAction(OBRA, dest())
    expect(r.ok).toBe(true)
    expect(db.obras_destinatario[0]).toMatchObject({ obra_id: OBRA, email: 'ana@cliente.com', tipos: ['diario'], lado: 'cliente' })
  })
  it('com id, atualiza', async () => {
    db.obras_destinatario.push({ id: 'd1', obra_id: OBRA, email: 'a@a.com', tipos: ['diario'] })
    const r = await salvarDestinatarioAction(OBRA, dest({ id: 'd1', tipos: ['semanal'] }))
    expect(r.ok).toBe(true)
    expect(db.obras_destinatario[0].tipos).toEqual(['semanal'])
  })
  it('e-mail duplicado → mensagem amigável', async () => {
    erroBanco = { message: 'duplicate key', code: '23505' }
    expect(await salvarDestinatarioAction(OBRA, dest())).toEqual({ ok: false, erro: 'Este e-mail já está cadastrado nesta obra' })
  })
})

describe('salvarConfigObraAction', () => {
  const cfg = { engenheiroEmail: 'eng@manfac.com.br', dataBase: '2026-10-01', atividadeTrava: 3 }
  it('não-admin → erro', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'eng@manfac.com.br' } } })
    expect((await salvarConfigObraAction(OBRA, cfg)).ok).toBe(false)
  })
  it('engenheiro sem acesso obras → erro', async () => {
    const r = await salvarConfigObraAction(OBRA, { ...cfg, engenheiroEmail: 'outro@x.com' })
    expect(r).toEqual({ ok: false, erro: 'O engenheiro precisa ter acesso ao Gestão de Obras' })
    expect(db.obras_obra[0].engenheiro_email).toBeNull()
  })
  it('grava config válida (e-mail minúsculo)', async () => {
    const r = await salvarConfigObraAction(OBRA, { ...cfg, engenheiroEmail: 'ENG@manfac.com.br' })
    expect(r.ok).toBe(true)
    expect(db.obras_obra[0]).toMatchObject({ engenheiro_email: 'eng@manfac.com.br', data_base: '2026-10-01', atividade_trava: 3 })
  })
  it('atividade-trava inválida → erro', async () => {
    expect((await salvarConfigObraAction(OBRA, { ...cfg, atividadeTrava: 0 })).ok).toBe(false)
  })
  it('data-base com v1 salva → erro', async () => {
    db.obras_cronograma_versao.push({ obra_id: OBRA, numero: 1, salva_em: '2026-10-02T10:00:00Z' })
    const r = await salvarConfigObraAction(OBRA, { ...cfg, dataBase: '2026-10-05' })
    expect(r).toEqual({ ok: false, erro: 'A base já foi salva — a data-base não muda' })
    expect(db.obras_obra[0].data_base).toBe('2026-10-01')
  })
  it('data-base igual com v1 salva → permitido', async () => {
    db.obras_cronograma_versao.push({ obra_id: OBRA, numero: 1, salva_em: '2026-10-02T10:00:00Z' })
    expect((await salvarConfigObraAction(OBRA, cfg)).ok).toBe(true)
  })
  it('data-base muda com v1 só rascunho', async () => {
    db.obras_cronograma_versao.push({ obra_id: OBRA, numero: 1, salva_em: null })
    expect((await salvarConfigObraAction(OBRA, { ...cfg, dataBase: '2026-10-05' })).ok).toBe(true)
    expect(db.obras_obra[0].data_base).toBe('2026-10-05')
  })
})
