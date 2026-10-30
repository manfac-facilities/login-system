/**
 * Server Actions do diário de obra (Task 8). `lerObraGrande` é mockado (dá
 * plano/exec/base); o Supabase é um banco em memória mínimo que imita o trigger
 * OBRAS_RDO_ESTADO (conteúdo de RDO não-rascunho é imutável) e a RLS de
 * avanço/foto (só com o RDO pai em rascunho).
 */

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
let erroForcado: Record<string, { message: string; code?: string } | undefined>
let seq = 0
let inseridos: Linha[] = []

const RLS = { message: 'new row violates row-level security policy for table "obras_rdo_avanco"', code: '42501' }

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select'
  let payload: Linha | Linha[] | null = null
  let unico: 'maybe' | 'single' | null = null
  let limite: number | null = null

  const paiRascunho = (rdoId: unknown) => (db.obras_rdo ?? []).some((r) => r.id === rdoId && r.estado === 'rascunho')

  const executar = () => {
    const forcado = erroForcado[`${tabela}.${op}`]
    if (forcado) return { data: null, error: forcado }
    const linhas = (db[tabela] ??= [])
    const alvo = () => linhas.filter((l) => filtros.every((f) => f(l)))
    let data: Linha[]
    if (op === 'select') data = alvo()
    else if (op === 'update') {
      data = alvo()
      if (tabela === 'obras_rdo' && data.some((l) => l.estado !== 'rascunho'))
        return { data: null, error: { message: 'OBRAS_RDO_ESTADO: RDO validado não pode ter o conteúdo alterado', code: 'P0001' } }
      data.forEach((l) => Object.assign(l, payload))
    } else if (op === 'delete') {
      data = alvo()
      if ((tabela === 'obras_rdo_avanco' || tabela === 'obras_rdo_foto') && data.some((l) => !paiRascunho(l.rdo_id)))
        data = data.filter((l) => paiRascunho(l.rdo_id)) // RLS: some sem erro
      db[tabela] = linhas.filter((l) => !data.includes(l))
    } else if (op === 'insert') {
      const novas = (Array.isArray(payload) ? payload : [payload!]).map((p): Linha => ({ id: `id${++seq}`, ...p }))
      if (tabela === "obras_rdo") {
        inseridos.push(...novas.map((n) => ({ ...n })))
        novas.forEach((n) => (n.estado ??= "rascunho")) // default do banco
      }
      if (tabela === 'obras_rdo_foto' && novas.some((l) => !paiRascunho(l.rdo_id))) return { data: null, error: RLS }
      linhas.push(...novas)
      data = novas
    } else {
      const novas = Array.isArray(payload) ? payload : [payload!]
      if (tabela === 'obras_rdo_avanco' && novas.some((l) => !paiRascunho(l.rdo_id))) return { data: null, error: RLS }
      data = novas.map((p) => {
        const existente = linhas.find((l) => l.rdo_id === p.rdo_id && l.numero === p.numero)
        if (existente) return Object.assign(existente, p)
        linhas.push({ ...p })
        return p
      })
    }
    if (limite !== null) data = data.slice(0, limite)
    if (unico === 'single') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'not single' } }
    if (unico === 'maybe') return { data: data[0] ?? null, error: null }
    return { data, error: null }
  }

  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    lt: (c: string, v: string) => (filtros.push((l) => String(l[c]) < v), q),
    not: (c: string, operador: string, lista: string) => {
      const vs = lista.replace(/[()]/g, '').split(',').map(Number)
      filtros.push((l) => !vs.includes(l[c] as number))
      return q
    },
    order: () => q,
    limit: (n: number) => ((limite = n), q),
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    insert: (p: Linha | Linha[]) => ((op = 'insert'), (payload = p), q),
    upsert: (p: Linha | Linha[]) => ((op = 'upsert'), (payload = p), q),
    delete: () => ((op = 'delete'), q),
    maybeSingle: async () => ((unico = 'maybe'), executar()),
    single: async () => ((unico = 'single'), executar()),
    then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, falha),
  }
  return q
}

const getUserMock = jest.fn()
const lerObraGrandeMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t), storage: { from: (b: string) => ({ remove: (p: string[]) => removerStorageMock(b, p) }) } })),
}))
const removerStorageMock = jest.fn()
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../../_lib/leitura', () => ({ lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a) }))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { registrarFotoAction, removerFotoAction, salvarRascunhoAction } from '../_actions'
import type { AvancoRdo, RascunhoRdo } from '../_tipos'

const OBRA = 'o1'
const DIA = '2026-10-29'
const UUID = '0b6f1c1e-3d4a-4b8e-9a51-2f1c3e4d5a6b'

/** Atividades 1..12; 11 e 12 bloqueiam pela trava 6 (em andamento → travadas). */
function dadosObra(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    dados: {
      obra: { id: OBRA, modalidade: 'obra', atividade_trava: 6, data_base: '2026-10-26' },
      versaoBase: { id: 'v1', numero: 1, salvaEm: '2026-10-26T12:00:00Z', motivo: null },
      versaoVigente: { id: 'v1', numero: 1, salvaEm: '2026-10-26T12:00:00Z', motivo: null },
      rascunho: null,
      plano: Array.from({ length: 12 }, (_, i) => ({
        numero: i + 1, etapa: 'E', descricao: `Atividade ${i + 1}`, pred1: null, pred2: null,
        duracao: 2, bloqueiaPorTrava: i + 1 >= 11, pesoValor: 100,
      })),
      exec: Array.from({ length: 12 }, (_, i) => ({
        numero: i + 1,
        status: i + 1 === 6 ? 'em_andamento' : 'nao_iniciado',
        percentual: i + 1 === 6 ? 0.5 : 0,
        inicioReal: null,
        fimReal: null,
      })),
      ...over,
    },
  }
}

const av = (over: Partial<AvancoRdo> = {}): AvancoRdo => ({ numero: 6, de: 0.5, para: 0.7, concluida: false, causa: null, ...over })

const corpo = (over: Partial<RascunhoRdo> = {}): RascunhoRdo => ({
  semExecucao: false,
  motivoSemExecucao: null,
  efetivo: 6,
  equipeTexto: 'Equipe própria',
  clima: 'sol',
  climaManha: null,
  climaTarde: null,
  programacaoAmanha: '7 · Atividade 7',
  semImpedimento: false,
  avancos: [av()],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  seq = 0
  inseridos = []
  erroForcado = {}
  db = { obras_rdo: [], obras_rdo_avanco: [], obras_rdo_foto: [] }
  getUserMock.mockResolvedValue({ data: { user: { email: 'supervisor@manfac.com.br' } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  lerObraGrandeMock.mockResolvedValue(dadosObra())
})

describe('salvarRascunhoAction — acesso', () => {
  it('sem acesso ao sistema obras é recusado sem gravar; sem usuário também', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect(await salvarRascunhoAction(OBRA, DIA, corpo())).toEqual({ ok: false, erro: 'Sem acesso ao Gestão de Obras' })
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await salvarRascunhoAction(OBRA, DIA, corpo())).toEqual({ ok: false, erro: 'Não autenticado' })
    expect(db.obras_rdo).toHaveLength(0)
  })

  it('admin sem o slug obras passa', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    expect((await salvarRascunhoAction(OBRA, DIA, corpo())).ok).toBe(true)
  })

  it('obra sem base salva → recusa', async () => {
    lerObraGrandeMock.mockResolvedValue(dadosObra({ versaoBase: null, versaoVigente: null }))
    expect(await salvarRascunhoAction(OBRA, DIA, corpo())).toEqual({
      ok: false,
      erro: 'Sem cronograma — o diário começa quando a base for salva',
    })
  })

  it('data malformada → recusa', async () => {
    expect(await salvarRascunhoAction(OBRA, '29/10/2026', corpo())).toEqual({ ok: false, erro: 'Data inválida' })
  })
})

describe('salvarRascunhoAction — gravação', () => {
  it('cria o rascunho e as linhas de avanço; devolve o rdoId', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo())
    expect(r).toEqual({ ok: true, rdoId: 'id1' })
    expect(db.obras_rdo[0]).toMatchObject({
      obra_id: OBRA, data: DIA, sem_execucao: false, motivo_sem_execucao: null, efetivo: 6,
      equipe_texto: 'Equipe própria', clima: 'sol', programacao_amanha: '7 · Atividade 7',
    })
    expect(inseridos[0]).not.toHaveProperty('estado')
    expect(db.obras_rdo_avanco).toEqual([{ rdo_id: 'id1', numero: 6, de: 0.5, para: 0.7, concluida: false, causa: null }])
  })

  it('grava "sem impedimentos hoje" (item 7)', async () => {
    await salvarRascunhoAction(OBRA, DIA, corpo({ semImpedimento: true }))
    expect(db.obras_rdo[0]).toMatchObject({ sem_impedimento: true })
    await salvarRascunhoAction(OBRA, DIA, corpo())
    expect(db.obras_rdo[0]).toMatchObject({ sem_impedimento: false })
  })

  it('grava o clima da manhã e da tarde (e mantém o clima legado)', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ climaManha: 'sol', climaTarde: 'chuva' }))
    expect(r.ok).toBe(true)
    expect(db.obras_rdo[0]).toMatchObject({ clima_manha: 'sol', clima_tarde: 'chuva', clima: 'sol' })
  })

  it('clima de turno inválido → recusa sem gravar', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ climaTarde: 'neve' as never }))
    expect(r).toEqual({ ok: false, erro: 'Clima inválido' })
    expect(db.obras_rdo).toHaveLength(0)
  })

  it('salvar de novo atualiza o mesmo RDO e substitui as linhas de avanço', async () => {
    await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av(), av({ numero: 7, de: 0, para: 0.2 })] }))
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ efetivo: 8, avancos: [av({ numero: 7, de: 0, para: 0.4 })] }))
    expect(r).toEqual({ ok: true, rdoId: 'id1' })
    expect(db.obras_rdo).toHaveLength(1)
    expect(db.obras_rdo[0].efetivo).toBe(8)
    expect(db.obras_rdo_avanco).toEqual([{ rdo_id: 'id1', numero: 7, de: 0, para: 0.4, concluida: false, causa: null }])
  })

  it('"de" vem da execução atual, não do navegador; concluída grava para = 1', async () => {
    await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ de: 0.1, para: 0.6, concluida: true })] }))
    expect(db.obras_rdo_avanco[0]).toMatchObject({ de: 0.5, para: 1, concluida: true })
  })

  it('diário já validado → "Diário já validado", sem gravar', async () => {
    db.obras_rdo.push({ id: 'r1', obra_id: OBRA, data: DIA, estado: 'validado', efetivo: 3 })
    expect(await salvarRascunhoAction(OBRA, DIA, corpo())).toEqual({ ok: false, erro: 'Diário já validado' })
    expect(db.obras_rdo[0].efetivo).toBe(3)
    expect(db.obras_rdo_avanco).toHaveLength(0)
  })

  it('diário já enviado → recusa', async () => {
    db.obras_rdo.push({ id: 'r1', obra_id: OBRA, data: DIA, estado: 'enviado' })
    expect(await salvarRascunhoAction(OBRA, DIA, corpo())).toEqual({ ok: false, erro: 'Diário já enviado' })
  })

  it('o banco recusando (validado no meio do caminho) vira "Diário já validado"', async () => {
    db.obras_rdo.push({ id: 'r1', obra_id: OBRA, data: DIA, estado: 'rascunho' })
    erroForcado['obras_rdo.update'] = { message: 'OBRAS_RDO_ESTADO: RDO validado não pode ter o conteúdo alterado', code: 'P0001' }
    expect(await salvarRascunhoAction(OBRA, DIA, corpo())).toEqual({ ok: false, erro: 'Diário já validado' })
    erroForcado = { 'obras_rdo_avanco.upsert': RLS }
    expect(await salvarRascunhoAction(OBRA, DIA, corpo())).toEqual({ ok: false, erro: 'Diário já validado' })
  })
})

describe('salvarRascunhoAction — regras do avanço', () => {
  it('avanço em atividade travada → erro da trava, sem gravar', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ numero: 11, de: 0, para: 0.3 })] }))
    expect(r).toEqual({ ok: false, erro: 'Atividade 11: travada até a atividade 6 ser concluída' })
    expect(db.obras_rdo).toHaveLength(0)
  })

  it('concluir atividade travada → erro da trava', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ numero: 11, de: 0, para: 0, concluida: true })] }))
    expect(r).toEqual({ ok: false, erro: 'Atividade 11: travada até a atividade 6 ser concluída' })
  })

  it('atividade travada sem avanço (só a causa) é aceita', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ numero: 11, de: 0, para: 0, causa: 'cliente' })] }))
    expect(r.ok).toBe(true)
  })

  it('para < de sem causa → erro; com causa → aceito', async () => {
    expect(await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ para: 0.3 })] }))).toEqual({
      ok: false,
      erro: 'Atividade 6: o percentual caiu — diga por quê',
    })
    expect(db.obras_rdo).toHaveLength(0)
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ para: 0.3, causa: 'projeto' })] }))
    expect(r.ok).toBe(true)
    expect(db.obras_rdo_avanco[0]).toMatchObject({ de: 0.5, para: 0.3, causa: 'projeto' })
  })

  it('atividade fora do cronograma, percentual fora de 0–1 e causa inválida → erro', async () => {
    expect((await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ numero: 99 })] }))).ok).toBe(false)
    expect((await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ para: 1.5 })] }))).ok).toBe(false)
    expect(
      (await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ causa: 'xx' as never })] }))).ok,
    ).toBe(false)
    expect(db.obras_rdo).toHaveLength(0)
  })
})

describe('salvarRascunhoAction — atividade incluída à mão (itens 6/11)', () => {
  it('atividade fora da lista do dia (antecipada) grava como avanço normal; "de" vem da execução', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ numero: 9, de: 0.4, para: 0.2 })] }))
    expect(r.ok).toBe(true)
    expect(db.obras_rdo_avanco).toEqual([{ rdo_id: 'id1', numero: 9, de: 0, para: 0.2, concluida: false, causa: null }])
  })
  it('incluída mas travada: a trava vale', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ avancos: [av({ numero: 12, de: 0, para: 0.2 })] }))
    expect(r.ok).toBe(false)
    expect(db.obras_rdo).toHaveLength(0)
  })
})

describe('salvarRascunhoAction — sem execução', () => {
  it('sem execução sem motivo → erro', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ semExecucao: true, motivoSemExecucao: '  ' }))
    expect(r).toEqual({ ok: false, erro: 'Diga o motivo de não ter tido execução hoje' })
    expect(db.obras_rdo).toHaveLength(0)
  })

  it('sem execução com motivo: grava o motivo e descarta equipe e avanços', async () => {
    const r = await salvarRascunhoAction(OBRA, DIA, corpo({ semExecucao: true, motivoSemExecucao: 'Área não liberada pela loja', clima: 'chuva' }))
    expect(r.ok).toBe(true)
    expect(db.obras_rdo[0]).toMatchObject({
      sem_execucao: true, motivo_sem_execucao: 'Área não liberada pela loja', efetivo: null, equipe_texto: null, clima: 'chuva',
    })
    expect(db.obras_rdo_avanco).toHaveLength(0)
  })
})

describe('fotos', () => {
  const path = `${OBRA}/rdo/${DIA}/${UUID}.jpg`
  beforeEach(() => {
    db.obras_rdo.push({ id: 'r1', obra_id: OBRA, data: DIA, estado: 'rascunho' })
  })

  it('registra a foto do rascunho com legenda e ordem', async () => {
    expect(await registrarFotoAction('r1', path, ' Fachada ')).toEqual({ ok: true, fotoId: 'id1' })
    expect(await registrarFotoAction('r1', path.replace('0b6f', '1b6f'), null)).toEqual({ ok: true, fotoId: 'id2' })
    expect(db.obras_rdo_foto).toEqual([
      { id: 'id1', rdo_id: 'r1', path, legenda: 'Fachada', ordem: 1 },
      { id: 'id2', rdo_id: 'r1', path: path.replace('0b6f', '1b6f'), legenda: null, ordem: 2 },
    ])
  })

  it('caminho fora de {obra}/rdo/{data}/ é recusado', async () => {
    expect(await registrarFotoAction('r1', `outra/rdo/${DIA}/${UUID}.jpg`, null)).toEqual({ ok: false, erro: 'Caminho de foto inválido' })
    expect(await registrarFotoAction('r1', `${OBRA}/rdo/2026-10-28/${UUID}.jpg`, null)).toEqual({ ok: false, erro: 'Caminho de foto inválido' })
    expect(await registrarFotoAction('r1', `${OBRA}/rdo/${DIA}/../x.jpg`, null)).toEqual({ ok: false, erro: 'Caminho de foto inválido' })
    expect(db.obras_rdo_foto).toHaveLength(0)
  })

  it('RDO validado não recebe nem perde foto', async () => {
    db.obras_rdo_foto.push({ id: 'f1', rdo_id: 'r1', path, legenda: null, ordem: 1 })
    db.obras_rdo[0].estado = 'validado'
    expect(await registrarFotoAction('r1', path, null)).toEqual({ ok: false, erro: 'Diário já validado' })
    expect(await removerFotoAction('f1')).toEqual({ ok: false, erro: 'Diário já validado' })
    expect(db.obras_rdo_foto).toHaveLength(1)
  })

  it('remove a foto do rascunho', async () => {
    db.obras_rdo_foto.push({ id: 'f1', rdo_id: 'r1', path, legenda: null, ordem: 1 })
    removerStorageMock.mockResolvedValue({ data: [], error: null })
    expect(await removerFotoAction('f1')).toEqual({ ok: true })
    expect(db.obras_rdo_foto).toHaveLength(0)
    expect(removerStorageMock).toHaveBeenCalledWith('obras-fotos', [path])
  })

  it('arquivo já ausente no bucket (not found): remove a foto mesmo assim', async () => {
    db.obras_rdo_foto.push({ id: 'f1', rdo_id: 'r1', path, legenda: null, ordem: 1 })
    removerStorageMock.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
    expect(await removerFotoAction('f1')).toEqual({ ok: true })
    expect(db.obras_rdo_foto).toHaveLength(0)
  })

  it('caminho fora do prefixo do RDO ou com ..: remove a linha mas não toca no bucket', async () => {
    db.obras_rdo_foto.push({ id: 'f1', rdo_id: 'r1', path: `outra/rdo/${DIA}/${UUID}.jpg`, legenda: null, ordem: 1 })
    db.obras_rdo_foto.push({ id: 'f2', rdo_id: 'r1', path: `${OBRA}/rdo/${DIA}/../x.jpg`, legenda: null, ordem: 2 })
    expect(await removerFotoAction('f1')).toEqual({ ok: true })
    expect(await removerFotoAction('f2')).toEqual({ ok: true })
    expect(removerStorageMock).not.toHaveBeenCalled()
  })

  it('RDO validado: não toca no bucket', async () => {
    db.obras_rdo_foto.push({ id: 'f1', rdo_id: 'r1', path, legenda: null, ordem: 1 })
    db.obras_rdo[0].estado = 'validado'
    await removerFotoAction('f1')
    expect(removerStorageMock).not.toHaveBeenCalled()
  })

  it('sem acesso → recusa', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect(await registrarFotoAction('r1', path, null)).toEqual({ ok: false, erro: 'Sem acesso ao Gestão de Obras' })
    expect(await removerFotoAction('f1')).toEqual({ ok: false, erro: 'Sem acesso ao Gestão de Obras' })
  })
})
