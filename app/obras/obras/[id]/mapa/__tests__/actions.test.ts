/**
 * Server Actions do mapa (Leva 6). O Supabase é um banco em memória mínimo;
 * as guardas do banco (triggers OBRAS_MAPA/OBRAS_MAPA_VINCULO, FK com foto)
 * entram como erro forçado, para conferir a mensagem em pt-BR.
 */

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
let erroForcado: Record<string, { message: string; code?: string; details?: string } | undefined>
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op: 'select' | 'update' | 'insert' | 'upsert' | 'delete' = 'select'
  let payload: Linha | Linha[] | null = null
  let unico: 'maybe' | 'single' | null = null

  const executar = () => {
    const forcado = erroForcado[`${tabela}.${op}`]
    if (forcado) return { data: null, error: forcado }
    const linhas = (db[tabela] ??= [])
    const alvo = () => linhas.filter((l) => filtros.every((f) => f(l)))
    let data: Linha[]
    if (op === 'select') data = alvo()
    else if (op === 'update') {
      data = alvo()
      data.forEach((l) => Object.assign(l, payload))
    } else if (op === 'delete') {
      data = alvo()
      db[tabela] = linhas.filter((l) => !data.includes(l))
    } else if (op === 'insert') {
      data = (Array.isArray(payload) ? payload : [payload!]).map((p): Linha => {
        const extra: Linha = tabela === 'obras_ponto_foto' ? { numero: linhas.filter((l) => l.obra_id === p.obra_id).length + 1, ativo: true } : {}
        return { id: `id${++seq}`, ...extra, ...p }
      })
      linhas.push(...data)
    } else {
      const p = payload as Linha
      const existente = linhas.find((l) => l.obra_id === p.obra_id)
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
    in: (c: string, vs: unknown[]) => (filtros.push((l) => vs.includes(l[c])), q),
    order: () => q,
    limit: () => q,
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    insert: (p: Linha | Linha[]) => ((op = 'insert'), (payload = p), q),
    upsert: (p: Linha) => ((op = 'upsert'), (payload = p), q),
    delete: () => ((op = 'delete'), q),
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

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import {
  apagarAmbienteAction,
  atualizarAmbienteAction,
  atualizarPontoAction,
  criarAmbienteAction,
  criarPontoAction,
  definirAtividadesAction,
  definirPontoAtivoAction,
  salvarModoAction,
  salvarPlantaAction,
} from '../_actions'

const OBRA = '11111111-2222-4333-8444-555555555555'
const PLANTA = `${OBRA}/mapa/0b6f1c1e-3d4a-4b8e-9a51-2f1c3e4d5a6b.png`
const ENG = 'eng@manfac.com.br'
const SEM_PERMISSAO = { ok: false, erro: 'Só o engenheiro da obra ou um administrador monta o mapa' }

const como = (email: string | null, { admin = false, acesso = true } = {}) => {
  getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } })
  ;(isAdmin as jest.Mock).mockResolvedValue(admin)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(acesso)
}

beforeEach(() => {
  jest.clearAllMocks()
  seq = 0
  erroForcado = {}
  db = {
    obras_obra: [
      { id: OBRA, modalidade: 'obra', engenheiro_email: 'Eng@Manfac.com.br' },
      { id: 'spot1', modalidade: 'spot', engenheiro_email: ENG },
    ],
    obras_mapa: [],
    obras_ambiente: [{ id: 'a1', obra_id: OBRA, nome: 'Salão', ordem: 1, x: 0.1, y: 0.1, w: 0.3, h: 0.3 }],
    obras_ponto_foto: [{ id: 'p1', obra_id: OBRA, numero: 1, nome: 'Entrada', ambiente_id: 'a1', ativo: true }],
    obras_ambiente_atividade: [{ ambiente_id: 'a1', atividade_numero: 3 }],
  }
  como(ENG)
})

describe('permissão (espelha o banco: engenheiro da obra ou admin)', () => {
  it('sem usuário → Não autenticado, nada gravado', async () => {
    como(null)
    expect(await criarAmbienteAction(OBRA, { nome: 'X', areaM2: null, retangulo: null })).toEqual({ ok: false, erro: 'Não autenticado' })
    expect(db.obras_ambiente).toHaveLength(1)
  })

  it('supervisor (acesso obras, não é o engenheiro) não altera mapa, ambiente, ponto nem atividades', async () => {
    como('supervisor@manfac.com.br')
    expect(await salvarModoAction(OBRA, 'croqui')).toEqual(SEM_PERMISSAO)
    expect(await salvarPlantaAction(OBRA, PLANTA, 800, 600)).toEqual(SEM_PERMISSAO)
    expect(await criarAmbienteAction(OBRA, { nome: 'X', areaM2: null, retangulo: null })).toEqual(SEM_PERMISSAO)
    expect(await atualizarAmbienteAction('a1', { nome: 'Outro' })).toEqual(SEM_PERMISSAO)
    expect(await apagarAmbienteAction('a1')).toEqual(SEM_PERMISSAO)
    expect(await definirAtividadesAction('a1', [])).toEqual(SEM_PERMISSAO)
    expect(await criarPontoAction(OBRA, { nome: 'P', ambienteId: 'a1', x: null, y: null })).toEqual(SEM_PERMISSAO)
    expect(await atualizarPontoAction('p1', { nome: 'Q' })).toEqual(SEM_PERMISSAO)
    expect(await definirPontoAtivoAction('p1', false)).toEqual(SEM_PERMISSAO)
    expect(db.obras_mapa).toHaveLength(0)
    expect(db.obras_ambiente).toEqual([expect.objectContaining({ id: 'a1', nome: 'Salão' })])
    expect(db.obras_ponto_foto[0]).toMatchObject({ nome: 'Entrada', ativo: true })
    expect(db.obras_ambiente_atividade).toHaveLength(1)
  })

  it('engenheiro sem o acesso ao sistema obras também não passa (falha fechada)', async () => {
    como(ENG, { acesso: false })
    expect(await salvarModoAction(OBRA, 'croqui')).toEqual(SEM_PERMISSAO)
  })

  it('admin passa mesmo sem ser o engenheiro', async () => {
    como('admin@manfac.com.br', { admin: true, acesso: false })
    expect(await salvarModoAction(OBRA, 'croqui')).toEqual({ ok: true })
    expect(db.obras_mapa).toEqual([{ obra_id: OBRA, modo: 'croqui' }])
  })

  it('obra SPOT ou inexistente → Obra não encontrada', async () => {
    expect(await salvarModoAction('spot1', 'croqui')).toEqual({ ok: false, erro: 'Obra não encontrada' })
    expect(await salvarModoAction('nao-existe', 'croqui')).toEqual({ ok: false, erro: 'Obra não encontrada' })
  })

  it('trigger OBRAS_MAPA recusou (ex.: engenheiro trocado no meio) → mensagem de permissão', async () => {
    erroForcado['obras_ambiente.insert'] = { message: 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera os ambientes', code: '42501' }
    expect(await criarAmbienteAction(OBRA, { nome: 'X', areaM2: null, retangulo: null })).toEqual(SEM_PERMISSAO)
  })
})

describe('mapa: modo e planta', () => {
  it('modo inválido e modo planta sem planta são recusados', async () => {
    expect(await salvarModoAction(OBRA, 'satelite')).toEqual({ ok: false, erro: 'Modo inválido' })
    expect(await salvarModoAction(OBRA, 'planta')).toEqual({ ok: false, erro: 'Envie a imagem da planta para usar o modo planta' })
  })

  it('salva a planta no caminho canônico e passa ao modo planta; trocar de modo mantém a planta', async () => {
    expect(await salvarPlantaAction(OBRA, PLANTA, 1600, 900)).toEqual({ ok: true })
    expect(db.obras_mapa[0]).toEqual({ obra_id: OBRA, modo: 'planta', planta_path: PLANTA, planta_largura: 1600, planta_altura: 900 })
    expect(await salvarModoAction(OBRA, 'croqui')).toEqual({ ok: true })
    expect(db.obras_mapa[0]).toMatchObject({ modo: 'croqui', planta_path: PLANTA })
    expect(await salvarModoAction(OBRA, 'planta')).toEqual({ ok: true })
  })

  it('caminho fora de <obra>/mapa/<uuid>.<ext>, extensão PDF ou tamanho inválido → recusa', async () => {
    const outra = PLANTA.replace(OBRA, '99999999-2222-4333-8444-555555555555')
    expect(await salvarPlantaAction(OBRA, outra, 10, 10)).toEqual({ ok: false, erro: 'Caminho da planta inválido' })
    expect(await salvarPlantaAction(OBRA, PLANTA.replace('.png', '.pdf'), 10, 10)).toEqual({ ok: false, erro: 'Caminho da planta inválido' })
    expect(await salvarPlantaAction(OBRA, `${OBRA}/rdo/2026-11-01/0b6f1c1e-3d4a-4b8e-9a51-2f1c3e4d5a6b.jpg`, 10, 10)).toEqual({
      ok: false,
      erro: 'Caminho da planta inválido',
    })
    expect(await salvarPlantaAction(OBRA, PLANTA, 0, 10)).toEqual({ ok: false, erro: 'Não deu para ler o tamanho da imagem' })
    expect(db.obras_mapa).toHaveLength(0)
  })
})

describe('ambientes', () => {
  it('cria com ordem seguinte e retângulo encaixado no quadro (0–1)', async () => {
    const r = await criarAmbienteAction(OBRA, { nome: '  Farmácia ', areaM2: 96.456, retangulo: { x: 0.8, y: -0.2, w: 0.5, h: 0.3 } })
    expect(r).toEqual({ ok: true, id: 'id1' })
    expect(db.obras_ambiente[1]).toEqual({ id: 'id1', obra_id: OBRA, nome: 'Farmácia', area_m2: 96.46, x: 0.8, y: 0, w: 0.2, h: 0.3, ordem: 2 })
  })

  it('modo ambientes: sem retângulo; nome vazio, área ≤ 0 e retângulo não numérico recusados', async () => {
    expect((await criarAmbienteAction(OBRA, { nome: 'Banheiros', areaM2: null, retangulo: null })).ok).toBe(true)
    expect(db.obras_ambiente[1]).toMatchObject({ x: null, y: null, w: null, h: null })
    expect(await criarAmbienteAction(OBRA, { nome: '  ', areaM2: null, retangulo: null })).toEqual({ ok: false, erro: 'Dê um nome' })
    expect(await criarAmbienteAction(OBRA, { nome: 'X', areaM2: 0, retangulo: null })).toEqual({ ok: false, erro: 'Área precisa ser maior que zero' })
    expect(await criarAmbienteAction(OBRA, { nome: 'X', areaM2: null, retangulo: { x: NaN, y: 0, w: 0.1, h: 0.1 } })).toEqual({
      ok: false,
      erro: 'Retângulo inválido',
    })
  })

  it('move/redimensiona e renomeia; retangulo null tira do desenho', async () => {
    expect(await atualizarAmbienteAction('a1', { retangulo: { x: 0.5, y: 0.5, w: 0.25, h: 0.25 } })).toEqual({ ok: true })
    expect(db.obras_ambiente[0]).toMatchObject({ x: 0.5, y: 0.5, w: 0.25, h: 0.25, nome: 'Salão' })
    expect(await atualizarAmbienteAction('a1', { nome: 'Salão de vendas', retangulo: null })).toEqual({ ok: true })
    expect(db.obras_ambiente[0]).toMatchObject({ nome: 'Salão de vendas', x: null, w: null })
  })

  it('apagar ambiente com foto: o banco recusa e a mensagem explica', async () => {
    erroForcado['obras_ambiente.delete'] = {
      message: 'update or delete on table "obras_ambiente" violates foreign key constraint "obras_rdo_foto_ambiente_id_fkey" on table "obras_rdo_foto"',
      code: '23503',
    }
    expect(await apagarAmbienteAction('a1')).toEqual({
      ok: false,
      erro: 'Este ambiente tem fotos no diário e não pode ser apagado. Desative os pontos dele em vez de apagar.',
    })
  })

  it('apagar ambiente sem foto', async () => {
    expect(await apagarAmbienteAction('a1')).toEqual({ ok: true })
    expect(db.obras_ambiente).toHaveLength(0)
  })

  it('ambiente inexistente → mensagem própria', async () => {
    expect(await apagarAmbienteAction('zzz')).toEqual({ ok: false, erro: 'Ambiente não encontrado' })
  })

  it('atividades do ambiente: troca pelo conjunto marcado (só apaga/insere a diferença)', async () => {
    expect(await definirAtividadesAction('a1', [3, 5, 7])).toEqual({ ok: true })
    expect(db.obras_ambiente_atividade.map((l) => l.atividade_numero).sort()).toEqual([3, 5, 7])
    expect(await definirAtividadesAction('a1', [7])).toEqual({ ok: true })
    expect(db.obras_ambiente_atividade).toEqual([{ id: expect.any(String), ambiente_id: 'a1', atividade_numero: 7 }])
    expect(await definirAtividadesAction('a1', [0])).toEqual({ ok: false, erro: 'Atividade inválida' })
  })
})

describe('pontos de foto', () => {
  it('cria ponto (número vem do banco) com posição relativa', async () => {
    const r = await criarPontoAction(OBRA, { nome: 'Fundo', ambienteId: 'a1', x: 0.33333, y: 1.4 })
    expect(r).toEqual({ ok: true, id: 'id1', numero: 2 })
    expect(db.obras_ponto_foto[1]).toMatchObject({ nome: 'Fundo', ambiente_id: 'a1', x: 0.3333, y: 1 })
  })

  it('ambiente de outra obra: a recusa do banco volta em pt-BR', async () => {
    erroForcado['obras_ponto_foto.insert'] = { message: 'OBRAS_MAPA_VINCULO: o ambiente do ponto não é desta obra', code: '23514' }
    expect(await criarPontoAction(OBRA, { nome: 'X', ambienteId: 'amb-outra-obra', x: null, y: null })).toEqual({
      ok: false,
      erro: 'O ambiente do ponto não é desta obra',
    })
  })

  it('ponto com foto não muda de ambiente (banco) → mensagem', async () => {
    erroForcado['obras_ponto_foto.update'] = {
      message: 'OBRAS_MAPA_VINCULO: ponto com foto não muda de ambiente (desative e crie outro)',
      code: 'P0001',
    }
    expect(await atualizarPontoAction('p1', { ambienteId: 'a2' })).toEqual({
      ok: false,
      erro: 'Ponto com foto não muda de ambiente (desative e crie outro)',
    })
  })

  it('move, renomeia, desativa e reativa', async () => {
    expect(await atualizarPontoAction('p1', { x: 0.2, y: 0.4 })).toEqual({ ok: true })
    expect(await atualizarPontoAction('p1', { nome: 'Entrada principal' })).toEqual({ ok: true })
    expect(db.obras_ponto_foto[0]).toMatchObject({ x: 0.2, y: 0.4, nome: 'Entrada principal' })
    expect(await definirPontoAtivoAction('p1', false)).toEqual({ ok: true })
    expect(db.obras_ponto_foto[0].ativo).toBe(false)
    expect(await definirPontoAtivoAction('p1', true)).toEqual({ ok: true })
    expect(db.obras_ponto_foto[0].ativo).toBe(true)
  })
})
