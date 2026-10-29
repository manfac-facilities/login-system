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
import {
  atualizarExecucaoAction,
  criarRevisaoAction,
  salvarLinhaRascunhoAction,
  salvarVersaoAction,
} from '../_actions'
import type { LinhaPlano } from '../_tipos'

const ENG = 'eduardo@manfac.com.br'
const OBRA = 'o1'

function atv(versao: string, numero: number, over: Linha = {}): Linha {
  return {
    id: `a-${versao}-${numero}`,
    versao_id: versao,
    obra_id: OBRA,
    numero,
    frente: 'F',
    etapa: 'E',
    descricao: `Atividade ${numero}`,
    saida_trava: null,
    pred1: numero > 1 ? numero - 1 : null,
    pred2: null,
    duracao: 2,
    responsavel_funcao: null,
    bloqueia_por_trava: false,
    peso_valor: 100,
    ...over,
  }
}

/** Obra com v1 rascunho de 12 atividades; 11 e 12 bloqueiam pela trava 6. */
function semear() {
  db = {
    obras_obra: [
      { id: OBRA, modalidade: 'obra', engenheiro_email: 'Eduardo@Manfac.com.br', atividade_trava: 6, data_base: '2026-10-26' },
    ],
    obras_cronograma_versao: [{ id: 'v1', obra_id: OBRA, numero: 1, motivo: null, salva_em: null, salva_por: null }],
    obras_atividade: Array.from({ length: 12 }, (_, i) =>
      atv('v1', i + 1, i + 1 >= 11 ? { bloqueia_por_trava: true } : {}),
    ),
    obras_atividade_exec: Array.from({ length: 12 }, (_, i) => ({
      obra_id: OBRA,
      numero: i + 1,
      status: i + 1 === 6 ? 'em_andamento' : 'nao_iniciado',
      percentual: 0,
      inicio_real: null,
      fim_real: null,
    })),
  }
}

function salvarV1() {
  db.obras_cronograma_versao[0].salva_em = '2026-10-29T12:00:00Z'
}

const linha = (over: Partial<LinhaPlano> = {}): LinhaPlano => ({
  numero: 3,
  etapa: 'Estrutura',
  descricao: 'Concretagem',
  pred1: 2,
  pred2: null,
  duracao: 5,
  bloqueiaPorTrava: false,
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  seq = 0
  erroForcado = {}
  semear()
  getUserMock.mockResolvedValue({ data: { user: { email: ENG } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
})

describe('permissão', () => {
  const SEM = { ok: false, erro: 'Só o engenheiro da obra ou um administrador altera o cronograma' }

  it('quem não é engenheiro nem admin é recusado em todas as actions, sem gravar', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'outro@manfac.com.br' } } })
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', linha())).toEqual(SEM)
    expect(await salvarVersaoAction(OBRA, 'v1', null)).toEqual(SEM)
    expect(await criarRevisaoAction(OBRA)).toEqual(SEM)
    expect(await atualizarExecucaoAction(OBRA, 1, { percentual: 0.5 })).toEqual(SEM)
    expect(db.obras_atividade.find((a) => a.numero === 3)!.duracao).toBe(2)
    expect(db.obras_cronograma_versao[0].salva_em).toBeNull()
    expect(db.obras_atividade_exec[0].percentual).toBe(0)
  })

  it('obra sem engenheiro: só admin passa (falha fechada)', async () => {
    db.obras_obra[0].engenheiro_email = null
    expect(await salvarVersaoAction(OBRA, 'v1', null)).toEqual(SEM)
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    getUserMock.mockResolvedValue({ data: { user: { email: 'admin@manfac.com.br' } } })
    expect(await salvarVersaoAction(OBRA, 'v1', null)).toEqual({ ok: true })
  })

  it('engenheiro sem acesso ao sistema obras é recusado; sem usuário também', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect(await salvarVersaoAction(OBRA, 'v1', null)).toEqual(SEM)
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await salvarVersaoAction(OBRA, 'v1', null)).toEqual({ ok: false, erro: 'Não autenticado' })
  })
})

describe('salvarLinhaRascunhoAction', () => {
  it('edita a linha do rascunho e revalida', async () => {
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', linha())).toEqual({ ok: true })
    expect(db.obras_atividade.find((a) => a.numero === 3)).toMatchObject({
      etapa: 'Estrutura', descricao: 'Concretagem', pred1: 2, pred2: null, duracao: 5, bloqueia_por_trava: false,
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/obras/obras/${OBRA}`, 'layout')
  })

  it('versão salva → recusa com a mensagem certa, sem gravar', async () => {
    salvarV1()
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', linha())).toEqual({
      ok: false,
      erro: 'Versão salva não se altera — crie uma revisão',
    })
    expect(db.obras_atividade.find((a) => a.numero === 3)!.duracao).toBe(2)
  })

  it('o erro OBRAS_VERSAO_SALVA do banco (corrida) vira a mesma mensagem', async () => {
    erroForcado['obras_atividade.update'] = { message: 'OBRAS_VERSAO_SALVA: versão de cronograma já salva não pode ser alterada' }
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', linha())).toEqual({
      ok: false,
      erro: 'Versão salva não se altera — crie uma revisão',
    })
  })

  it('recusa ciclo nas predecessoras', async () => {
    // 3 depende de 5, e 5 → 4 → 3 já existe.
    const r = await salvarLinhaRascunhoAction(OBRA, 'v1', linha({ pred1: 5 }))
    expect(r).toEqual({ ok: false, erro: 'Ciclo nas predecessoras: 3 → 5 → 4 → 3' })
    expect(db.obras_atividade.find((a) => a.numero === 3)!.pred1).toBe(2)
  })

  it('recusa duração inválida, predecessora inexistente e versão de outra obra', async () => {
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', linha({ duracao: 0 }))).toEqual({
      ok: false, erro: 'Duração deve ser um número inteiro de dias úteis, a partir de 1',
    })
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', linha({ pred2: 99 }))).toEqual({
      ok: false, erro: 'Predecessora 99 não existe neste cronograma',
    })
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', linha({ pred1: 3 }))).toEqual({
      ok: false, erro: 'Uma atividade não pode ser predecessora dela mesma',
    })
    db.obras_cronograma_versao[0].obra_id = 'outra'
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', linha())).toEqual({ ok: false, erro: 'Versão não encontrada' })
  })
})

describe('salvarVersaoAction', () => {
  it('salva a base (v1) sem motivo', async () => {
    expect(await salvarVersaoAction(OBRA, 'v1', null)).toEqual({ ok: true })
    expect(db.obras_cronograma_versao[0].salva_em).toEqual(expect.any(String))
    expect(db.obras_cronograma_versao[0].salva_por).toBe(ENG)
  })

  it('v2 sem motivo → erro; com motivo → salva', async () => {
    salvarV1()
    db.obras_cronograma_versao.push({ id: 'v2', obra_id: OBRA, numero: 2, motivo: null, salva_em: null })
    expect(await salvarVersaoAction(OBRA, 'v2', '  ')).toEqual({ ok: false, erro: 'Informe o motivo da revisão' })
    expect(await salvarVersaoAction(OBRA, 'v2', null)).toEqual({ ok: false, erro: 'Informe o motivo da revisão' })
    expect(await salvarVersaoAction(OBRA, 'v2', ' Chuva de 3 dias ')).toEqual({ ok: true })
    expect(db.obras_cronograma_versao[1]).toMatchObject({ motivo: 'Chuva de 3 dias', salva_por: ENG })
  })

  it('versão já salva → erro', async () => {
    salvarV1()
    expect(await salvarVersaoAction(OBRA, 'v1', null)).toEqual({ ok: false, erro: 'Esta versão já foi salva' })
  })
})

describe('criarRevisaoAction', () => {
  it('sem base salva → erro', async () => {
    expect(await criarRevisaoAction(OBRA)).toEqual({ ok: false, erro: 'Salve a base antes de criar uma revisão' })
  })

  it('copia as atividades da vigente para v(n+1) em rascunho', async () => {
    salvarV1()
    const r = await criarRevisaoAction(OBRA)
    expect(r).toEqual({ ok: true, versaoId: expect.any(String) })
    const nova = db.obras_cronograma_versao.find((v) => v.id === (r as { versaoId: string }).versaoId)!
    expect(nova).toMatchObject({ obra_id: OBRA, numero: 2 })
    expect(nova.salva_em ?? null).toBeNull()
    const copias = db.obras_atividade.filter((a) => a.versao_id === nova.id)
    expect(copias).toHaveLength(12)
    const original = db.obras_atividade.find((a) => a.versao_id === 'v1' && a.numero === 11)!
    const copia = copias.find((a) => a.numero === 11)!
    const { id: _a, versao_id: _b, ...resto } = original // eslint-disable-line @typescript-eslint/no-unused-vars
    expect(copia).toMatchObject(resto)
    expect(copia.id).not.toBe(original.id)
  })

  it('já existe rascunho → erro, nada criado', async () => {
    salvarV1()
    db.obras_cronograma_versao.push({ id: 'v2', obra_id: OBRA, numero: 2, motivo: null, salva_em: null })
    db.obras_atividade.push(atv('v2', 1))
    expect(await criarRevisaoAction(OBRA)).toEqual({
      ok: false,
      erro: 'Já existe uma revisão em rascunho (v2) — salve-a antes de criar outra',
    })
    expect(db.obras_cronograma_versao).toHaveLength(2)
  })

  it('rascunho vazio (cópia que falhou antes) é reaproveitado', async () => {
    salvarV1()
    db.obras_cronograma_versao.push({ id: 'v2', obra_id: OBRA, numero: 2, motivo: null, salva_em: null })
    expect(await criarRevisaoAction(OBRA)).toEqual({ ok: true, versaoId: 'v2' })
    expect(db.obras_atividade.filter((a) => a.versao_id === 'v2')).toHaveLength(12)
  })
})

describe('atualizarExecucaoAction', () => {
  it('11 em andamento com a 6 não concluída → travada', async () => {
    expect(await atualizarExecucaoAction(OBRA, 11, { status: 'em_andamento' })).toEqual({
      ok: false,
      erro: 'Travada até a atividade 6 ser concluída',
    })
    expect(await atualizarExecucaoAction(OBRA, 11, { percentual: 0.1 })).toEqual({
      ok: false,
      erro: 'Travada até a atividade 6 ser concluída',
    })
    expect(db.obras_atividade_exec.find((e) => e.numero === 11)!.status).toBe('nao_iniciado')
  })

  it('com a 6 concluída, a 11 pode iniciar', async () => {
    db.obras_atividade_exec.find((e) => e.numero === 6)!.status = 'concluido'
    expect(await atualizarExecucaoAction(OBRA, 11, { status: 'em_andamento', inicioReal: '2026-11-03' })).toEqual({ ok: true })
    expect(db.obras_atividade_exec.find((e) => e.numero === 11)).toMatchObject({
      status: 'em_andamento', inicio_real: '2026-11-03',
    })
  })

  it('concluído força percentual 1 e exige fim real', async () => {
    expect(await atualizarExecucaoAction(OBRA, 6, { status: 'concluido' })).toEqual({
      ok: false,
      erro: 'Informe o fim real para concluir a atividade',
    })
    expect(await atualizarExecucaoAction(OBRA, 6, { status: 'concluido', percentual: 0.4, fimReal: '2026-10-30' })).toEqual({ ok: true })
    expect(db.obras_atividade_exec.find((e) => e.numero === 6)).toMatchObject({
      status: 'concluido', percentual: 1, fim_real: '2026-10-30',
    })
  })

  it('valida percentual, data e atividade inexistente', async () => {
    expect(await atualizarExecucaoAction(OBRA, 1, { percentual: 1.5 })).toEqual({
      ok: false, erro: 'Percentual deve estar entre 0% e 100%',
    })
    expect(await atualizarExecucaoAction(OBRA, 1, { inicioReal: '30/10/2026' })).toEqual({
      ok: false, erro: 'Data inválida',
    })
    expect(await atualizarExecucaoAction(OBRA, 99, { percentual: 0.5 })).toEqual({
      ok: false, erro: 'Atividade 99 não existe no cronograma',
    })
  })

  it('usa a versão vigente quando há base salva e revisão em rascunho', async () => {
    salvarV1()
    // Na revisão (rascunho) a 1 passaria a bloquear; a vigente manda.
    db.obras_cronograma_versao.push({ id: 'v2', obra_id: OBRA, numero: 2, motivo: null, salva_em: null })
    db.obras_atividade.push(atv('v2', 1, { bloqueia_por_trava: true }))
    expect(await atualizarExecucaoAction(OBRA, 1, { status: 'em_andamento' })).toEqual({ ok: true })
  })
})
