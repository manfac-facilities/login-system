/**
 * @jest-environment node
 *
 * Actions da Comunicação (Leva 2 §3.1/§3.5, §6.1-3/4): guarda falha fechada,
 * janela de edição (autor ≤ 24 h ou admin) conferida no servidor, envio de
 * ata/imediata só engenheiro/admin, destinatários só do cadastro, PDF anexo e
 * um obras_envio por lado. Supabase, e-mail e react-pdf mockados.
 */
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
      const nova = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, ...payload }
      linhas.push(nova)
      return { data: unico ? nova : [nova], error: null }
    }
    const alvo = linhas.filter((l) => filtros.every((f) => f(l)))
    if (op === 'delete') {
      db[tabela] = linhas.filter((l) => !alvo.includes(l))
      return { data: alvo, error: null }
    }
    if (op === 'update') alvo.forEach((l) => Object.assign(l, payload))
    return { data: unico ? (alvo[0] ?? null) : alvo, error: null }
  }
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    contains: (c: string, v: unknown[]) => (filtros.push((l) => v.every((x) => (l[c] ?? []).includes(x))), q),
    order: () => q,
    insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
    delete: () => ((op = 'delete'), q),
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    maybeSingle: async () => executar(true),
    single: async () => executar(true),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar(false)).then(ok, ko),
  }
  return q
}

const getUserMock = jest.fn()
const enviarEmailMock = jest.fn()
const lerObraGrandeMock = jest.fn()
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 ata'))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t) })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../../_lib/enviar', () => ({ enviarEmail: (...a: unknown[]) => enviarEmailMock(...a) }))
jest.mock('../../../_lib/leitura', () => ({ lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a) }))
jest.mock('../../../_pdf/carregar-ata', () => ({
  ...jest.requireActual('../../../_pdf/carregar-ata'),
  renderizarAta: (...a: unknown[]) => renderMock(...(a as [])),
}))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import {
  apagarRegistroAction,
  criarRegistroAction,
  editarRegistroAction,
  enviarAtaAction,
  enviarImediataAction,
} from '../_actions'
import type { RegistroEntrada } from '../_tipos'

const OBRA = 'o1'
const REG = '11111111-1111-4111-8111-111111111111'
const ENG = 'eng@manfac.com.br'
const USU = 'usu@manfac.com.br'
const ADM = 'adm@manfac.com.br'

const logar = (email: string | null) => getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } })
const horasAtras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

const ligacao = (over: Partial<RegistroEntrada> = {}): RegistroEntrada => ({
  tipo: 'ligacao', data: '2026-10-29', participantes: 'Ana', texto: 'Combinado acesso', ata: null, ...over,
})

const impedimento = (over: Linha = {}) => ({
  id: 'i1', obraId: OBRA, categoria: 'impedimento', tipo: 'Material Manfac', responsavel: 'manfac', atividadeNumero: 3,
  descricao: 'Atraso no perfil', pessoaCliente: null, fotoPath: null, travaAtividade: false, impactoDias: null,
  exibirAoCliente: false, abertoEm: '2026-10-28', encerradoEm: null, rdoId: null, orientacaoId: null,
  criadoPor: null, criadoEm: '2026-10-28T10:00:00Z', ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  seq = 0
  erroBanco = null
  db = {
    obras_obra: [{ id: OBRA, modalidade: 'obra', engenheiro_email: ENG, os: 'OS-1', loja: 'DP Macaé 3', cliente: 'DPSP' }],
    obras_registro: [],
    obras_destinatario: [
      { obra_id: OBRA, email: 'cli@cliente.com', lado: 'cliente', tipos: ['diario', 'imediato'], ativo: true },
      { obra_id: OBRA, email: 'ger@cliente.com', lado: 'cliente', tipos: ['diario'], ativo: true },
      { obra_id: OBRA, email: 'int@manfac.com.br', lado: 'interno', tipos: ['imediato'], ativo: true },
      { obra_id: OBRA, email: 'velho@cliente.com', lado: 'cliente', tipos: ['diario', 'imediato'], ativo: false },
    ],
    obras_envio: [],
  }
  logar(USU)
  ;(isAdmin as jest.Mock).mockImplementation(async (_s, e: string) => e === ADM)
  ;(hasSystemAccess as jest.Mock).mockImplementation(async (_s, e: string) => e === USU || e === ENG)
  enviarEmailMock.mockImplementation(async ({ para }: { para: string[] }) => ({ ok: true, aceitos: para, falhas: [] }))
  lerObraGrandeMock.mockResolvedValue({
    ok: true,
    dados: {
      obra: { id: OBRA, modalidade: 'obra', engenheiro_email: ENG, loja: 'DP Macaé 3', os: 'OS-1' },
      impedimentos: [impedimento()],
      plano: [{ numero: 3, descricao: 'Forro' }],
    },
  })
})

describe('criarRegistroAction', () => {
  it('sem sessão / sem acesso → erro e nada gravado', async () => {
    logar(null)
    expect((await criarRegistroAction(OBRA, ligacao())).ok).toBe(false)
    logar('x@manfac.com.br')
    expect((await criarRegistroAction(OBRA, ligacao())).ok).toBe(false)
    expect(db.obras_registro).toHaveLength(0)
  })

  it('qualquer usuário com acesso obras registra (sem criado_por: é do trigger)', async () => {
    const r = await criarRegistroAction(OBRA, ligacao())
    expect(r.ok).toBe(true)
    expect(db.obras_registro[0]).toMatchObject({ obra_id: OBRA, tipo: 'ligacao', texto: 'Combinado acesso', ata: null })
    expect(db.obras_registro[0]).not.toHaveProperty('criado_por')
  })

  it('reunião grava a ata; validação recusa; obra SPOT recusa', async () => {
    const ata = { pauta: 'Andamento', decisoes: ['A'], pendencias: [{ oque: 'B', responsavel: 'Ana', prazo: '2026-11-05' }] }
    expect((await criarRegistroAction(OBRA, ligacao({ tipo: 'reuniao', ata }))).ok).toBe(true)
    expect(db.obras_registro[0].ata).toEqual(ata)
    expect((await criarRegistroAction(OBRA, ligacao({ texto: '' }))).ok).toBe(false)
    db.obras_obra[0].modalidade = 'spot'
    expect((await criarRegistroAction(OBRA, ligacao())).ok).toBe(false)
    expect(db.obras_registro).toHaveLength(1)
  })
})

describe('editar/apagar registro', () => {
  const semear = (over: Linha = {}) =>
    db.obras_registro.push({ id: REG, obra_id: OBRA, tipo: 'ligacao', data: '2026-10-29', texto: 'x', criado_por: USU, criado_em: horasAtras(2), ...over })

  it('autor dentro de 24 h edita e apaga', async () => {
    semear()
    expect(await editarRegistroAction(OBRA, REG, ligacao({ texto: 'novo' }))).toEqual({ ok: true })
    expect(db.obras_registro[0].texto).toBe('novo')
    expect(await apagarRegistroAction(OBRA, REG)).toEqual({ ok: true })
    expect(db.obras_registro).toHaveLength(0)
  })

  it('autor depois de 24 h e outro usuário → recusado no servidor', async () => {
    semear({ criado_em: horasAtras(25) })
    expect((await editarRegistroAction(OBRA, REG, ligacao({ texto: 'novo' }))).ok).toBe(false)
    expect((await apagarRegistroAction(OBRA, REG)).ok).toBe(false)
    db.obras_registro[0].criado_em = horasAtras(1)
    logar(ENG)
    expect((await apagarRegistroAction(OBRA, REG)).ok).toBe(false)
    expect(db.obras_registro).toHaveLength(1)
    expect(db.obras_registro[0].texto).toBe('x')
  })

  it('admin edita a qualquer tempo; registro de outra obra não é achado', async () => {
    semear({ criado_em: horasAtras(24 * 30), criado_por: USU })
    logar(ADM)
    expect((await editarRegistroAction(OBRA, REG, ligacao({ texto: 'admin' }))).ok).toBe(true)
    expect((await apagarRegistroAction('outra', REG)).ok).toBe(false)
    expect(db.obras_registro).toHaveLength(1)
  })

  it('imediata não se edita; erro do trigger vira mensagem da janela', async () => {
    semear({ tipo: 'imediata' })
    expect((await editarRegistroAction(OBRA, REG, ligacao())).ok).toBe(false)
    db.obras_registro[0].tipo = 'ligacao'
    erroBanco = { message: 'OBRAS_REGISTRO: só o autor', code: '42501' }
    const r = await editarRegistroAction(OBRA, REG, ligacao())
    expect(r.ok === false && r.erro).toMatch(/24 h/)
  })
})

describe('enviarAtaAction', () => {
  const semearAta = () =>
    db.obras_registro.push({
      id: REG, obra_id: OBRA, tipo: 'reuniao', data: '2026-10-29', participantes: 'Ana', texto: null,
      ata: { pauta: 'Andamento', decisoes: ['A'], pendencias: [] }, criado_por: USU, criado_em: horasAtras(1), editado_em: null,
    })

  it('usuário comum (não engenheiro) não envia', async () => {
    semearAta()
    const r = await enviarAtaAction(OBRA, REG, ['cli@cliente.com'])
    expect(r.ok).toBe(false)
    expect(enviarEmailMock).not.toHaveBeenCalled()
  })

  it('destinatário fora do cadastro (ou inativo) → recusa sem enviar', async () => {
    semearAta()
    logar(ENG)
    expect((await enviarAtaAction(OBRA, REG, ['cli@cliente.com', 'estranho@x.com'])).ok).toBe(false)
    expect((await enviarAtaAction(OBRA, REG, ['velho@cliente.com'])).ok).toBe(false)
    expect((await enviarAtaAction(OBRA, REG, [])).ok).toBe(false)
    expect(enviarEmailMock).not.toHaveBeenCalled()
  })

  it('engenheiro envia com PDF anexo e registra um envio por lado', async () => {
    semearAta()
    logar(ENG)
    const r = await enviarAtaAction(OBRA, REG, [' CLI@cliente.com', 'int@manfac.com.br'])
    expect(r).toEqual({ ok: true, enviados: 2 })
    expect(enviarEmailMock).toHaveBeenCalledTimes(2)
    const [chamada] = enviarEmailMock.mock.calls[0]
    expect(chamada.para).toEqual(['cli@cliente.com'])
    expect(chamada.assunto).toBe('Ata de reunião · DP Macaé 3 · 29/10/2026')
    expect(chamada.anexos).toEqual([{ nome: 'ata-dp-macae-3-2026-10-29.pdf', conteudo: Buffer.from('%PDF-1.4 ata') }])
    expect(db.obras_envio).toEqual([
      expect.objectContaining({ tipo: 'ata', lado: 'cliente', registro_id: REG, referencia: '2026-10-29', destinatarios: ['cli@cliente.com'], resultado: 'ok' }),
      expect.objectContaining({ tipo: 'ata', lado: 'interno', registro_id: REG, destinatarios: ['int@manfac.com.br'] }),
    ])
  })

  it('registro que não é reunião → não encontrado', async () => {
    semearAta()
    db.obras_registro[0].tipo = 'ligacao'
    logar(ADM)
    expect((await enviarAtaAction(OBRA, REG, ['cli@cliente.com'])).ok).toBe(false)
  })

  it('falha de SMTP fica registrada como falha', async () => {
    semearAta()
    logar(ADM)
    enviarEmailMock.mockResolvedValue({ ok: false, aceitos: [], falhas: [{ para: 'cli@cliente.com', erro: 'EAUTH' }] })
    const r = await enviarAtaAction(OBRA, REG, ['cli@cliente.com'])
    expect(r.ok).toBe(false)
    expect(db.obras_envio[0]).toMatchObject({ resultado: 'falha', destinatarios: [], detalhe: 'Falhou: cli@cliente.com (EAUTH)' })
  })
})

describe('enviarImediataAction', () => {
  const entrada = { assunto: 'Falta de energia', texto: 'Sem energia na loja', nivel: 'urgente' as const, impedimentoId: 'i1', atividadeNumero: 3 }

  it('usuário comum não envia nem registra', async () => {
    expect((await enviarImediataAction(OBRA, entrada)).ok).toBe(false)
    expect(db.obras_registro).toHaveLength(0)
  })

  it('engenheiro: registra, manda cliente e interno (só tipo imediato e ativos) e loga', async () => {
    logar(ENG)
    const r = await enviarImediataAction(OBRA, entrada)
    expect(r).toEqual({ ok: true, enviados: 2 })
    expect(db.obras_registro[0]).toMatchObject({
      tipo: 'imediata', texto: 'Sem energia na loja', ata: { assunto: 'Falta de energia' }, nivel: 'urgente', impedimento_id: 'i1', atividade_numero: 3,
    })
    const cliente = enviarEmailMock.mock.calls[0][0]
    const interno = enviarEmailMock.mock.calls[1][0]
    expect(cliente.para).toEqual(['cli@cliente.com'])
    expect(interno.para).toEqual(['int@manfac.com.br'])
    // Impedimento oculto: o cliente não vê; o interno vê com a área.
    expect(cliente.texto).not.toContain('Atraso no perfil')
    expect(cliente.texto).toContain('Atividade 3 · Forro')
    expect(interno.texto).toContain('Atraso no perfil')
    expect(interno.texto).toContain('Material Manfac')
    const regId = db.obras_registro[0].id
    expect(db.obras_envio).toEqual([
      expect.objectContaining({ tipo: 'imediata', lado: 'cliente', registro_id: regId }),
      expect.objectContaining({ tipo: 'imediata', lado: 'interno', registro_id: regId }),
    ])
  })

  it('vínculo de outra obra ou atividade inexistente → recusa', async () => {
    logar(ADM)
    expect((await enviarImediataAction(OBRA, { ...entrada, impedimentoId: 'zzz' })).ok).toBe(false)
    expect((await enviarImediataAction(OBRA, { ...entrada, atividadeNumero: 99 })).ok).toBe(false)
    expect(db.obras_registro).toHaveLength(0)
  })

  it('sem destinatário com tipo imediato → erro antes de registrar', async () => {
    logar(ADM)
    db.obras_destinatario = db.obras_destinatario.map((d) => ({ ...d, tipos: ['diario'] }))
    expect((await enviarImediataAction(OBRA, entrada)).ok).toBe(false)
    expect(db.obras_registro).toHaveLength(0)
    expect(enviarEmailMock).not.toHaveBeenCalled()
  })
})
