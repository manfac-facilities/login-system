/**
 * Leva 1b, itens 1 e 15: estrutura do cronograma no rascunho — etapas
 * (adicionar, renomear, mover), atividades (adicionar, mover, excluir) e
 * a revisão copiando a ordem. Invariante: `numero` nunca muda e a execução
 * (`obras_atividade_exec`, ligada por `numero`) fica intacta.
 * Banco em memória igual ao de actions.test.ts, com `delete`.
 */

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select'
  let payload: Linha | Linha[] | null = null
  let unico: 'maybe' | 'single' | null = null

  const executar = () => {
    const linhas = (db[tabela] ??= [])
    const alvo = () => linhas.filter((l) => filtros.every((f) => f(l)))
    const salva = (versaoId: unknown) =>
      (db.obras_cronograma_versao ?? []).some((v) => v.id === versaoId && v.salva_em)
    const erroSalva = { data: null, error: { message: 'OBRAS_VERSAO_SALVA: x' } }
    let data: Linha[]
    if (op === 'select') data = alvo()
    else if (op === 'update') {
      data = alvo()
      if (tabela === 'obras_atividade' && data.some((l) => salva(l.versao_id))) return erroSalva
      data.forEach((l) => Object.assign(l, payload))
    } else if (op === 'delete') {
      data = alvo()
      if (tabela === 'obras_atividade' && data.some((l) => salva(l.versao_id))) return erroSalva
      db[tabela] = linhas.filter((l) => !data.includes(l))
    } else if (op === 'insert') {
      const novas = (Array.isArray(payload) ? payload : [payload!]).map((p): Linha => ({ id: `id${++seq}`, ...p }))
      if (tabela === 'obras_atividade' && novas.some((l) => salva(l.versao_id))) return erroSalva
      if (
        tabela === 'obras_atividade_exec' &&
        novas.some((n) => linhas.some((l) => l.numero === n.numero && l.obra_id === n.obra_id))
      )
        return { data: null, error: { message: 'duplicate key' } }
      linhas.push(...novas)
      data = novas
    } else {
      const p = payload as Linha
      const existente = linhas.find((l) => l.obra_id === p.obra_id && l.numero === p.numero)
      if (existente) Object.assign(existente, p)
      else linhas.push({ ...p })
      data = [existente ?? p]
    }
    if (unico === 'single')
      return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'not single' } }
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
    delete: () => ((op = 'delete'), q),
    maybeSingle: async () => ((unico = 'maybe'), executar()),
    single: async () => ((unico = 'single'), executar()),
    then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) =>
      Promise.resolve(executar()).then(ok, falha),
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
import { planoDe } from '../../../_lib/leitura'
import {
  adicionarAtividadeAction,
  adicionarEtapaAction,
  criarCronogramaAction,
  criarRevisaoAction,
  excluirAtividadeAction,
  moverAtividadeAction,
  moverEtapaAction,
  renomearEtapaAction,
  salvarLinhaRascunhoAction,
} from '../_actions'

const ENG = 'gabriel@manfac.com.br'
const OBRA = 'o1'

function atv(versao: string, numero: number, etapa: string, etapa_ordem: number, over: Linha = {}): Linha {
  return {
    id: `a-${versao}-${numero}`, versao_id: versao, obra_id: OBRA, numero, frente: null, etapa,
    descricao: `Atividade ${numero}`, saida_trava: null, pred1: numero > 1 ? numero - 1 : null, pred2: null,
    duracao: 2, responsavel_funcao: null, bloqueia_por_trava: false, peso_valor: 10, inicio_fixo: null,
    ordem: numero, etapa_ordem, ...over,
  }
}

/** v1 rascunho: Mobilização (1, 2, 3) e Estrutura (4, 5, 6), em cadeia. A 2 já andou 50%. */
function semear() {
  db = {
    obras_obra: [{ id: OBRA, modalidade: 'obra', engenheiro_email: ENG, atividade_trava: null, data_base: '2026-11-02' }],
    obras_cronograma_versao: [{ id: 'v1', obra_id: OBRA, numero: 1, motivo: null, salva_em: null }],
    obras_atividade: [
      atv('v1', 1, 'Mobilização', 1), atv('v1', 2, 'Mobilização', 1), atv('v1', 3, 'Mobilização', 1),
      atv('v1', 4, 'Estrutura', 2), atv('v1', 5, 'Estrutura', 2), atv('v1', 6, 'Estrutura', 2),
    ],
    obras_atividade_exec: [1, 2, 3, 4, 5, 6].map((n) => ({
      obra_id: OBRA, numero: n, status: n === 2 ? 'em_andamento' : 'nao_iniciado', percentual: n === 2 ? 0.5 : 0,
      inicio_real: null, fim_real: null,
    })),
  }
}

const doV1 = () => db.obras_atividade.filter((a) => a.versao_id === 'v1')
const ordemExibida = (v = 'v1') => planoDe(db.obras_atividade, v).map((a) => a.numero)
const etapasExibidas = (v = 'v1') => [...new Set(planoDe(db.obras_atividade, v).map((a) => a.etapa))]
const execCongelado = () => JSON.stringify(db.obras_atividade_exec)

beforeEach(() => {
  jest.clearAllMocks()
  seq = 0
  semear()
  getUserMock.mockResolvedValue({ data: { user: { email: ENG } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
})

describe('permissão e versão salva', () => {
  it('quem não é engenheiro nem admin é recusado em todas as actions novas, sem gravar', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'outro@manfac.com.br' } } })
    const antes = JSON.stringify(db)
    const SEM = { ok: false, erro: 'Só o engenheiro da obra ou um administrador altera o cronograma' }
    expect(await adicionarEtapaAction(OBRA, 'v1', 'Nova')).toEqual(SEM)
    expect(await renomearEtapaAction(OBRA, 'v1', 'Estrutura', 'X')).toEqual(SEM)
    expect(await moverEtapaAction(OBRA, 'v1', 'Estrutura', 'cima')).toEqual(SEM)
    expect(
      await adicionarAtividadeAction(OBRA, 'v1', 'Estrutura', { descricao: 'x', duracao: 1, pred1: null, pred2: null }),
    ).toEqual(SEM)
    expect(await moverAtividadeAction(OBRA, 'v1', 5, 'cima')).toEqual(SEM)
    expect(await excluirAtividadeAction(OBRA, 'v1', 6)).toEqual(SEM)
    expect(await criarCronogramaAction(OBRA)).toEqual(SEM)
    expect(JSON.stringify(db)).toBe(antes)
  })

  it('versão salva: recusa com a mensagem de revisão', async () => {
    db.obras_cronograma_versao[0].salva_em = '2026-11-01T00:00:00Z'
    const SALVA = { ok: false, erro: 'Versão salva não se altera — crie uma revisão' }
    expect(await renomearEtapaAction(OBRA, 'v1', 'Estrutura', 'X')).toEqual(SALVA)
    expect(await moverAtividadeAction(OBRA, 'v1', 5, 'cima')).toEqual(SALVA)
    expect(await excluirAtividadeAction(OBRA, 'v1', 6)).toEqual(SALVA)
    expect(await adicionarEtapaAction(OBRA, 'v1', 'Nova')).toEqual(SALVA)
  })
})

describe('etapas', () => {
  it('renomear troca a etapa de todas as atividades dela; numero e execução não mudam', async () => {
    const exec = execCongelado()
    expect(await renomearEtapaAction(OBRA, 'v1', 'Estrutura', ' Estrutura metálica ')).toEqual({ ok: true })
    expect(doV1().filter((a) => a.etapa === 'Estrutura metálica').map((a) => a.numero)).toEqual([4, 5, 6])
    expect(doV1().map((a) => a.numero)).toEqual([1, 2, 3, 4, 5, 6])
    expect(execCongelado()).toBe(exec)
  })

  it('renomear para um nome que já existe (ou vazio) é recusado', async () => {
    expect(await renomearEtapaAction(OBRA, 'v1', 'Estrutura', 'mobilização')).toEqual({
      ok: false, erro: 'Já existe a etapa “mobilização” neste cronograma',
    })
    expect(await renomearEtapaAction(OBRA, 'v1', 'Estrutura', '  ')).toEqual({ ok: false, erro: 'Informe o nome da etapa' })
    expect(doV1().filter((a) => a.etapa === 'Estrutura')).toHaveLength(3)
  })

  it('mover para cima troca a ordem das etapas; numero e execução não mudam', async () => {
    const exec = execCongelado()
    expect(await moverEtapaAction(OBRA, 'v1', 'Estrutura', 'cima')).toEqual({ ok: true })
    expect(etapasExibidas()).toEqual(['Estrutura', 'Mobilização'])
    expect(ordemExibida()).toEqual([4, 5, 6, 1, 2, 3])
    expect(doV1().map((a) => a.numero)).toEqual([1, 2, 3, 4, 5, 6])
    expect(execCongelado()).toBe(exec)
    // Já na ponta: não muda nada.
    expect(await moverEtapaAction(OBRA, 'v1', 'Estrutura', 'cima')).toEqual({ ok: true })
    expect(etapasExibidas()).toEqual(['Estrutura', 'Mobilização'])
  })

  it('mover funciona com etapa_ordem nula (linha de antes do SQL da Leva 1b)', async () => {
    doV1().forEach((a) => {
      a.etapa_ordem = null
      a.ordem = null
    })
    expect(await moverEtapaAction(OBRA, 'v1', 'Mobilização', 'baixo')).toEqual({ ok: true })
    expect(ordemExibida()).toEqual([4, 5, 6, 1, 2, 3])
  })

  it('adicionar etapa cria a 1ª atividade "Nova atividade" no fim, com numero novo e execução', async () => {
    db.obras_atividade_exec.push({ obra_id: OBRA, numero: 9, status: 'nao_iniciado', percentual: 0 })
    const r = await adicionarEtapaAction(OBRA, 'v1', ' Acabamento ')
    expect(r).toEqual({ ok: true, numero: 10 })
    const nova = doV1().find((a) => a.numero === 10)!
    expect(nova).toMatchObject({ etapa: 'Acabamento', descricao: 'Nova atividade', duracao: 1, pred1: null, obra_id: OBRA })
    expect(etapasExibidas()).toEqual(['Mobilização', 'Estrutura', 'Acabamento'])
    expect(db.obras_atividade_exec.find((e) => e.numero === 10)).toMatchObject({
      obra_id: OBRA, status: 'nao_iniciado', percentual: 0,
    })
    expect(await adicionarEtapaAction(OBRA, 'v1', 'estrutura')).toEqual({
      ok: false, erro: 'Já existe a etapa “estrutura” neste cronograma',
    })
  })
})

describe('atividades', () => {
  it('adicionar gera numero novo (maior da obra em todas as versões + 1), vai para o fim da etapa e cria a execução', async () => {
    db.obras_cronograma_versao[0].salva_em = '2026-11-01T00:00:00Z'
    db.obras_cronograma_versao.push({ id: 'v2', obra_id: OBRA, numero: 2, motivo: null, salva_em: null })
    db.obras_atividade.push(...doV1().map((a) => ({ ...a, id: `c${a.numero}`, versao_id: 'v2' })))
    db.obras_atividade.push(atv('v1', 8, 'Mobilização', 1)) // só na versão salva
    const exec = db.obras_atividade_exec.map((e) => ({ ...e }))
    const r = await adicionarAtividadeAction(OBRA, 'v2', 'Mobilização', {
      descricao: ' Isolar área ', duracao: 3, pred1: 3, pred2: null, inicioFixo: '2026-11-10',
    })
    expect(r).toEqual({ ok: true, numero: 9 })
    expect(db.obras_atividade.find((a) => a.versao_id === 'v2' && a.numero === 9)).toMatchObject({
      etapa: 'Mobilização', descricao: 'Isolar área', duracao: 3, pred1: 3, pred2: null, inicio_fixo: '2026-11-10',
      obra_id: OBRA, etapa_ordem: 1,
    })
    expect(ordemExibida('v2')).toEqual([1, 2, 3, 9, 4, 5, 6])
    expect(db.obras_atividade_exec.find((e) => e.numero === 9)).toMatchObject({ status: 'nao_iniciado', percentual: 0 })
    expect(db.obras_atividade_exec.filter((e) => e.numero !== 9)).toEqual(exec)
  })

  it('adicionar valida descrição, duração e predecessora', async () => {
    const base = { descricao: 'x', duracao: 1, pred1: null, pred2: null }
    expect(await adicionarAtividadeAction(OBRA, 'v1', 'Estrutura', { ...base, descricao: ' ' })).toEqual({
      ok: false, erro: 'Informe a descrição da atividade',
    })
    expect(await adicionarAtividadeAction(OBRA, 'v1', 'Estrutura', { ...base, duracao: 0 })).toEqual({
      ok: false, erro: 'Duração deve ser um número inteiro de dias úteis, a partir de 1',
    })
    expect(await adicionarAtividadeAction(OBRA, 'v1', 'Estrutura', { ...base, pred1: 99 })).toEqual({
      ok: false, erro: 'Predecessora 99 não existe neste cronograma',
    })
    expect(doV1()).toHaveLength(6)
  })

  it('mover troca a posição dentro da etapa; numero e execução não mudam; na ponta, nada', async () => {
    const exec = execCongelado()
    expect(await moverAtividadeAction(OBRA, 'v1', 5, 'cima')).toEqual({ ok: true })
    expect(ordemExibida()).toEqual([1, 2, 3, 5, 4, 6])
    expect(await moverAtividadeAction(OBRA, 'v1', 6, 'baixo')).toEqual({ ok: true })
    expect(await moverAtividadeAction(OBRA, 'v1', 4, 'baixo')).toEqual({ ok: true })
    expect(ordemExibida()).toEqual([1, 2, 3, 5, 6, 4])
    expect(execCongelado()).toBe(exec)
  })

  it('mudar a etapa pela linha leva a atividade para o fim da outra etapa', async () => {
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', { numero: 1, etapa: 'Estrutura' })).toEqual({ ok: true })
    expect(ordemExibida()).toEqual([2, 3, 4, 5, 6, 1])
    expect(doV1().find((a) => a.numero === 1)).toMatchObject({ etapa: 'Estrutura', etapa_ordem: 2, descricao: 'Atividade 1' })
  })

  it('salvar só um campo não sobrescreve os outros (edições seguidas na tabela)', async () => {
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', { numero: 4, descricao: 'Pilares' })).toEqual({ ok: true })
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', { numero: 4, duracao: 7 })).toEqual({ ok: true })
    expect(doV1().find((a) => a.numero === 4)).toMatchObject({ descricao: 'Pilares', duracao: 7, pred1: 3, etapa: 'Estrutura' })
  })

  it('Valor (R$) grava em peso_valor (centavos); negativo ou inválido é recusado sem gravar', async () => {
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', { numero: 4, pesoValor: 1234.567 })).toEqual({ ok: true })
    expect(doV1().find((a) => a.numero === 4)).toMatchObject({ peso_valor: 1234.57, descricao: 'Atividade 4', duracao: 2 })
    const ERRO = { ok: false, erro: 'Valor deve ser um número a partir de R$ 0,00' }
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', { numero: 4, pesoValor: -1 })).toEqual(ERRO)
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', { numero: 4, pesoValor: NaN })).toEqual(ERRO)
    expect(doV1().find((a) => a.numero === 4)!.peso_valor).toBe(1234.57)
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', { numero: 4, pesoValor: 0 })).toEqual({ ok: true })
    expect(doV1().find((a) => a.numero === 4)!.peso_valor).toBe(0)

    const base = { descricao: 'x', duracao: 1, pred1: null, pred2: null }
    expect(await adicionarAtividadeAction(OBRA, 'v1', 'Estrutura', { ...base, pesoValor: -5 })).toEqual(ERRO)
    const r = await adicionarAtividadeAction(OBRA, 'v1', 'Estrutura', { ...base, pesoValor: 500 })
    expect(doV1().find((a) => a.numero === (r as { numero: number }).numero)!.peso_valor).toBe(500)
    const sem = await adicionarAtividadeAction(OBRA, 'v1', 'Estrutura', base)
    expect(doV1().find((a) => a.numero === (sem as { numero: number }).numero)!.peso_valor).toBe(0)
  })

  it('excluir com sucessora é recusado', async () => {
    expect(await excluirAtividadeAction(OBRA, 'v1', 4)).toEqual({
      ok: false, erro: 'A atividade 2.2 (Atividade 5) depende dela — tire a predecessora antes de excluir',
    })
    expect(doV1()).toHaveLength(6)
  })

  it('excluir com avanço executado é recusado', async () => {
    db.obras_atividade.find((a) => a.numero === 3)!.pred1 = 1
    expect(await excluirAtividadeAction(OBRA, 'v1', 2)).toEqual({
      ok: false, erro: 'A atividade 1.2 já tem avanço registrado — não pode ser excluída',
    })
    expect(doV1()).toHaveLength(6)
  })

  it('mensagens citam o código da tela (etapa.posição), não o numero — também no ciclo', async () => {
    await moverEtapaAction(OBRA, 'v1', 'Estrutura', 'cima') // Estrutura (4, 5, 6) vira a etapa 1
    expect(await excluirAtividadeAction(OBRA, 'v1', 4)).toEqual({
      ok: false, erro: 'A atividade 1.2 (Atividade 5) depende dela — tire a predecessora antes de excluir',
    })
    // 4 → 6 fecha o ciclo 4 → 6 → 5 → 4.
    expect(await salvarLinhaRascunhoAction(OBRA, 'v1', { numero: 4, pred1: 6 })).toEqual({
      ok: false, erro: 'Ciclo nas predecessoras: 1.1 → 1.3 → 1.2 → 1.1',
    })
  })

  it('excluir a atividade-trava é recusado', async () => {
    db.obras_obra[0].atividade_trava = 6
    expect(await excluirAtividadeAction(OBRA, 'v1', 6)).toEqual({
      ok: false, erro: 'A atividade 2.3 é a atividade-trava da obra — não pode ser excluída',
    })
  })

  it('excluir a última da cadeia remove só ela; a execução fica', async () => {
    expect(await excluirAtividadeAction(OBRA, 'v1', 6)).toEqual({ ok: true })
    expect(doV1().map((a) => a.numero)).toEqual([1, 2, 3, 4, 5])
    expect(db.obras_atividade_exec).toHaveLength(6)
  })
})

describe('revisão e cronograma novo', () => {
  it('criarRevisaoAction copia ordem e etapa_ordem', async () => {
    await moverEtapaAction(OBRA, 'v1', 'Estrutura', 'cima')
    await moverAtividadeAction(OBRA, 'v1', 2, 'baixo')
    db.obras_cronograma_versao[0].salva_em = '2026-11-01T00:00:00Z'
    const r = await criarRevisaoAction(OBRA)
    expect(r).toMatchObject({ ok: true, numero: 2 })
    const v2 = (r as { versaoId: string }).versaoId
    expect(ordemExibida(v2)).toEqual(ordemExibida('v1'))
    expect(ordemExibida(v2)).toEqual([4, 5, 6, 1, 3, 2])
  })

  it('criarCronogramaAction cria a v1 em rascunho vazia; se já existe versão, recusa', async () => {
    expect(await criarCronogramaAction(OBRA)).toEqual({ ok: false, erro: 'Esta OBRA já tem cronograma' })
    db.obras_cronograma_versao = []
    db.obras_atividade = []
    expect(await criarCronogramaAction(OBRA)).toEqual({ ok: true })
    expect(db.obras_cronograma_versao).toEqual([expect.objectContaining({ obra_id: OBRA, numero: 1, criada_por: ENG })])
    const v1 = db.obras_cronograma_versao[0].id as string
    expect(await adicionarEtapaAction(OBRA, v1, 'Mobilização')).toEqual({ ok: true, numero: 7 })
  })
})
