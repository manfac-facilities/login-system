/**
 * @jest-environment node
 *
 * Server Actions da planta de faseamento (Leva 6b): permissão igual ao banco
 * (engenheiro, coordenador ou admin; coordenador NULL/vazio nunca passa),
 * schemas da Task 2 antes de gravar, emitir, nova revisão e envio `faseamento`.
 */
import { criarBanco, type Banco } from './fixtures/banco'

let b: Banco
const getUserMock = jest.fn()
const enviarEmailMock = jest.fn()
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 prancha'))

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => b.cliente(getUserMock)) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../../_lib/enviar', () => ({ enviarEmail: (...a: unknown[]) => enviarEmailMock(...a) }))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: (...a: unknown[]) => renderMock(...(a as [])),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image', Svg: 'Svg', G: 'G', Rect: 'Rect', Path: 'Path',
  Polygon: 'Polygon', Polyline: 'Polyline', Circle: 'Circle', Line: 'Line',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { criarFaseAction, emitirRevisaoAction, enviarFaseamentoAction, novaRevisaoAction, salvarRascunhoAction } from '../_actions'
import type { EntradaRevisao } from '../_tipos'

const OBRA = '11111111-2222-4333-8444-555555555555'
const FASE = '22222222-2222-4222-8222-222222222222'
const R0 = '33333333-3333-4333-8333-333333333333'
const ENG = 'eng@manfac.com.br'
const COORD = 'coord@manfac.com.br'
const SEM_PERMISSAO = { ok: false, erro: 'Só o engenheiro da obra, o coordenador ou um administrador mexe na planta de faseamento' }

const como = (email: string | null, { admin = false, acesso = true } = {}) => {
  getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } })
  ;(isAdmin as jest.Mock).mockResolvedValue(admin)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(acesso)
}

const entrada = (over: Partial<EntradaRevisao> = {}): EntradaRevisao => ({
  camadas: [{ id: 'c1', t: 'zona_obra', r: [0.1, 0.1, 0.3, 0.3], rot: 'ZONA DE OBRA' }],
  regras: ['Nenhuma demolição antes do escoramento.'],
  carimbo: { titulo: 'Fase 1', cliente: 'DPSP', desenho: 'FAS-01', base: 'Layout', rt: 'Eng. Fulano' },
  usaTrava: false,
  ...over,
})
const r0 = () => b.db.obras_fase_revisao.find((r) => r.id === R0)!

beforeEach(() => {
  jest.clearAllMocks()
  b = criarBanco()
  b.db = {
    obras_obra: [
      { id: OBRA, os: '24.0871', loja: 'Macaé 3', cliente: 'DPSP', modalidade: 'obra', engenheiro_email: 'Eng@Manfac.com.br', coordenador_email: ' Coord@Manfac.com.br ', atividade_trava: 6 },
    ],
    obras_fase: [{ id: FASE, obra_id: OBRA, numero: 1, nome: 'Demolição e reforço', ordem: 1 }],
    obras_fase_revisao: [{ id: R0, fase_id: FASE, obra_id: OBRA, revisao: 0, status: 'rascunho', camadas: [], regras: [], carimbo: {}, usa_trava: false }],
    obras_mapa: [{ obra_id: OBRA, planta_path: `${OBRA}/mapa/a.png`, planta_largura: 1200, planta_altura: 840 }],
    obras_destinatario: [
      { obra_id: OBRA, email: 'cli@dpsp.com.br', lado: 'cliente', tipos: ['semanal'], ativo: true },
      { obra_id: OBRA, email: 'so-diario@dpsp.com.br', lado: 'cliente', tipos: ['diario'], ativo: true },
      { obra_id: OBRA, email: 'inativo@dpsp.com.br', lado: 'cliente', tipos: ['mensal'], ativo: false },
      { obra_id: OBRA, email: 'int@manfac.com.br', lado: 'interno', tipos: ['mensal'], ativo: true },
    ],
    obras_envio: [],
  }
  enviarEmailMock.mockImplementation(async (p: { para: string[] }) => ({ aceitos: p.para, falhas: [] }))
  como(ENG)
})

describe('permissão (igual ao banco: engenheiro, coordenador ou admin)', () => {
  it('coordenador (lower/trim) com acesso obras grava', async () => {
    como(COORD)
    expect(await salvarRascunhoAction(R0, entrada())).toEqual({ ok: true })
    expect(r0().camadas).toHaveLength(1)
  })
  it.each([
    ['NULL', null],
    ['vazio', '   '],
    ['outro e-mail', 'outro@manfac.com.br'],
  ])('coordenador_email %s: o coordenador não grava e nada muda', async (_n, coord) => {
    b.db.obras_obra[0].coordenador_email = coord
    como(COORD)
    expect(await salvarRascunhoAction(R0, entrada())).toEqual(SEM_PERMISSAO)
    expect(await criarFaseAction(OBRA, 'Fase 2')).toEqual(SEM_PERMISSAO)
    expect(r0().camadas).toEqual([])
    expect(b.db.obras_fase).toHaveLength(1)
  })
  it('sessão sem e-mail não casa com coordenador NULL', async () => {
    b.db.obras_obra[0].coordenador_email = null
    b.db.obras_obra[0].engenheiro_email = null
    getUserMock.mockResolvedValue({ data: { user: { email: '' } } })
    expect(await salvarRascunhoAction(R0, entrada())).toEqual({ ok: false, erro: 'Não autenticado' })
  })
  it('coordenador ou engenheiro sem acesso obras não grava; admin grava', async () => {
    como(COORD, { acesso: false })
    expect(await salvarRascunhoAction(R0, entrada())).toEqual(SEM_PERMISSAO)
    como(ENG, { acesso: false })
    expect(await salvarRascunhoAction(R0, entrada())).toEqual(SEM_PERMISSAO)
    como('adm@manfac.com.br', { admin: true, acesso: false })
    expect(await salvarRascunhoAction(R0, entrada())).toEqual({ ok: true })
  })
  it('supervisor (acesso obras, sem papel na obra) não grava', async () => {
    como('sup@manfac.com.br')
    expect(await salvarRascunhoAction(R0, entrada())).toEqual(SEM_PERMISSAO)
    expect(await emitirRevisaoAction(R0)).toEqual(SEM_PERMISSAO)
    expect(r0().status).toBe('rascunho')
  })
  it('obra SPOT: Obra não encontrada', async () => {
    b.db.obras_obra[0].modalidade = 'spot'
    expect(await salvarRascunhoAction(R0, entrada())).toEqual({ ok: false, erro: 'Obra não encontrada' })
  })
  it('a recusa do banco (OBRAS_FASEAMENTO 42501) vira a mensagem de permissão', async () => {
    b.erro['obras_fase_revisao.update'] = { message: 'OBRAS_FASEAMENTO: só o engenheiro da obra, o coordenador ou administrador altera as revisões', code: '42501' }
    expect(await salvarRascunhoAction(R0, entrada())).toEqual(SEM_PERMISSAO)
  })
})

describe('schemas da Task 2 antes de gravar', () => {
  it.each([
    ['fora de 0–1', { camadas: [{ id: 'c1', t: 'zona_obra', r: [0.8, 0.1, 0.3, 0.3] }] }],
    ['tipo desconhecido', { camadas: [{ id: 'c1', t: 'parede', at: [0.1, 0.1] }] }],
    ['ids repetidos', { camadas: [{ id: 'c1', t: 'extintor', at: [0.1, 0.1] }, { id: 'c1', t: 'emerg', at: [0.2, 0.2] }] }],
    ['301 camadas', { camadas: Array.from({ length: 301 }, (_, i) => ({ id: `c${i}`, t: 'extintor', at: [0.1, 0.1] })) }],
    ['13 regras', { regras: Array.from({ length: 13 }, (_, i) => `Regra ${i}`) }],
    ['regra com 201 caracteres', { regras: ['x'.repeat(201)] }],
    ['carimbo sem campo', { carimbo: { titulo: 'x' } }],
    ['trava não booleana', { usaTrava: 'sim' }],
  ])('%s: recusado e nada gravado', async (_n, over) => {
    const r = await salvarRascunhoAction(R0, entrada(over as Partial<EntradaRevisao>))
    expect(r.ok).toBe(false)
    expect(r0().camadas).toEqual([])
  })
  it('trava ligada sem atividade-trava na obra é recusada', async () => {
    b.db.obras_obra[0].atividade_trava = null
    expect((await salvarRascunhoAction(R0, entrada({ usaTrava: true }))).ok).toBe(false)
    expect(r0().usa_trava).toBe(false)
  })
})

describe('criar fase', () => {
  it('cria a fase (número do banco) e a R0 em rascunho com o carimbo padrão', async () => {
    const r = await criarFaseAction(OBRA, '  Piso do salão ')
    expect(r.ok).toBe(true)
    const fase = b.db.obras_fase.find((f) => f.id === r.faseId)!
    expect(fase).toMatchObject({ nome: 'Piso do salão', numero: 2, ordem: 2 })
    const rev = b.db.obras_fase_revisao.find((x) => x.fase_id === fase.id)!
    expect(rev).toMatchObject({ revisao: 0, status: 'rascunho', camadas: [], regras: [], usa_trava: false })
    expect(rev.carimbo).toMatchObject({ titulo: 'Planta de faseamento · Fase 2', cliente: 'DPSP', desenho: 'FAS-02' })
  })
  it('nome vazio ou longo demais é recusado', async () => {
    expect((await criarFaseAction(OBRA, '  ')).ok).toBe(false)
    expect((await criarFaseAction(OBRA, 'x'.repeat(121))).ok).toBe(false)
    expect(b.db.obras_fase).toHaveLength(1)
  })
})

describe('emitir e nova revisão', () => {
  it('emitir chama a rpc; depois a revisão fica em leitura no servidor', async () => {
    await salvarRascunhoAction(R0, entrada())
    expect(await emitirRevisaoAction(R0)).toEqual({ ok: true })
    expect(b.rpcChamadas).toEqual([{ nome: 'obras_emitir_fase_revisao', args: { p_revisao: R0 } }])
    expect(r0()).toMatchObject({ status: 'emitida', planta_path: `${OBRA}/mapa/a.png`, fase_numero: 1 })
    expect(await salvarRascunhoAction(R0, entrada({ regras: ['Mudou'] }))).toEqual({
      ok: false,
      erro: 'Revisão emitida não muda. Use "Nova revisão" para alterar.',
    })
    expect(r0().regras).toEqual(['Nenhuma demolição antes do escoramento.'])
    expect((await emitirRevisaoAction(R0)).ok).toBe(false)
  })
  it('erro da rpc vira pt-BR (trava sem atividade)', async () => {
    b.erro['rpc.obras_emitir_fase_revisao'] = {
      message: 'OBRAS_FASEAMENTO: a obra não tem atividade-trava definida; desligue a regra de trava ou defina a atividade em Dados da obra',
      code: '23514',
    }
    expect(await emitirRevisaoAction(R0)).toEqual({
      ok: false,
      erro: 'A obra não tem atividade-trava definida; desligue a regra de trava ou defina a atividade em Dados da obra',
    })
  })
  it('nova revisão copia a última emitida e nasce em rascunho R1', async () => {
    await salvarRascunhoAction(R0, entrada({ usaTrava: true }))
    await emitirRevisaoAction(R0)
    const r = await novaRevisaoAction(FASE)
    expect(r.ok).toBe(true)
    const r1 = b.db.obras_fase_revisao.find((x) => x.id === r.revisaoId)!
    expect(r1).toMatchObject({ revisao: 1, status: 'rascunho', usa_trava: true, regras: ['Nenhuma demolição antes do escoramento.'] })
    expect(r1.camadas).toEqual(entrada().camadas)
    expect(r1.planta_path).toBeUndefined()
  })
  it('nova revisão com rascunho aberto ou sem emitida é recusada', async () => {
    expect(await novaRevisaoAction(FASE)).toEqual({ ok: false, erro: 'Esta fase já tem uma revisão em rascunho' })
    await emitirRevisaoAction(R0)
    await novaRevisaoAction(FASE)
    expect((await novaRevisaoAction(FASE)).ok).toBe(false)
    expect(b.db.obras_fase_revisao).toHaveLength(2)
  })
})

describe('enviar ao cliente', () => {
  it('rascunho não é enviado', async () => {
    expect(await enviarFaseamentoAction(R0)).toEqual({ ok: false, erro: 'Emita a revisão antes de enviar ao cliente' })
    expect(enviarEmailMock).not.toHaveBeenCalled()
  })
  it('emitida: e-mail aos destinatários do relatório de fase, PDF anexo, um envio faseamento por lado', async () => {
    await salvarRascunhoAction(R0, entrada())
    await emitirRevisaoAction(R0)
    como(COORD)
    expect(await enviarFaseamentoAction(R0)).toEqual({ ok: true, enviados: 2 })
    expect(enviarEmailMock).toHaveBeenCalledTimes(2)
    const [cli, int] = enviarEmailMock.mock.calls.map((c) => c[0])
    expect(cli.para).toEqual(['cli@dpsp.com.br'])
    expect(int.para).toEqual(['int@manfac.com.br'])
    expect(cli.assunto).toContain('Planta de faseamento · Macaé 3 · Fase 1 · Demolição e reforço · R0')
    expect(cli.anexos[0].nome).toMatch(/^faseamento-.*-fase1-R0\.pdf$/)
    expect(b.db.obras_envio).toEqual([
      expect.objectContaining({ obra_id: OBRA, tipo: 'faseamento', fase_revisao_id: R0, lado: 'cliente', destinatarios: ['cli@dpsp.com.br'], resultado: 'ok' }),
      expect.objectContaining({ tipo: 'faseamento', fase_revisao_id: R0, lado: 'interno', destinatarios: ['int@manfac.com.br'] }),
    ])
    // A prancha da emitida usa a planta congelada (assinada no servidor).
    expect(b.assinadas).toEqual([`${OBRA}/mapa/a.png`])
  })
  it('sem destinatário do cliente com Semanal/Mensal: não envia', async () => {
    await emitirRevisaoAction(R0)
    b.db.obras_destinatario = b.db.obras_destinatario.filter((d) => d.lado !== 'cliente' || d.tipos.includes('diario'))
    expect((await enviarFaseamentoAction(R0)).ok).toBe(false)
    expect(enviarEmailMock).not.toHaveBeenCalled()
    expect(b.db.obras_envio).toEqual([])
  })
  it('supervisor não envia', async () => {
    await emitirRevisaoAction(R0)
    como('sup@manfac.com.br')
    expect(await enviarFaseamentoAction(R0)).toEqual(SEM_PERMISSAO)
    expect(enviarEmailMock).not.toHaveBeenCalled()
  })
})

describe('rodada de correções da revisão', () => {
  const emitida = async () => {
    await salvarRascunhoAction(R0, entrada())
    await emitirRevisaoAction(R0)
  }

  it('M4: o e-mail sai mas o registro do envio falha: ok false com "Enviado a N, mas…"', async () => {
    await emitida()
    b.erro['obras_envio.insert'] = { message: 'OBRAS_ENVIO: fase_revisao_id não é revisão emitida', code: '23514' }
    const r = await enviarFaseamentoAction(R0)
    expect(r.ok).toBe(false)
    expect(r).toMatchObject({ enviados: 2 })
    expect((r as { erro: string }).erro).toMatch(/^Enviado a 2 destinatário\(s\), mas: .*registro do envio \(cliente\) falhou/)
  })

  it('M4: o provedor recusa todos: grava resultado falha e devolve "O e-mail não saiu"', async () => {
    await emitida()
    enviarEmailMock.mockImplementation(async (p: { para: string[] }) => ({ aceitos: [], falhas: p.para.map((para) => ({ para, erro: 'recusado' })) }))
    const r = await enviarFaseamentoAction(R0)
    expect(r.ok).toBe(false)
    expect((r as { erro: string }).erro).toMatch(/^O e-mail não saiu: /)
    expect(b.db.obras_envio).toEqual([
      expect.objectContaining({ lado: 'cliente', resultado: 'falha', destinatarios: [], detalhe: 'Falhou: cli@dpsp.com.br (recusado)' }),
      expect.objectContaining({ lado: 'interno', resultado: 'falha', destinatarios: [] }),
    ])
  })

  it('M2: falha do render do PDF devolve mensagem genérica (o detalhe só no console)', async () => {
    await emitida()
    const erroConsole = jest.spyOn(console, 'error').mockImplementation(() => {})
    renderMock.mockRejectedValueOnce(new Error('fetch https://assinada/segredo falhou'))
    expect(await enviarFaseamentoAction(R0)).toEqual({ ok: false, erro: 'Não foi possível gerar o PDF. Tente de novo.' })
    expect(erroConsole).toHaveBeenCalled()
    expect(enviarEmailMock).not.toHaveBeenCalled()
    erroConsole.mockRestore()
  })

  it('M3: rascunho com camada gravada ilegível não é sobrescrito nem emitido', async () => {
    r0().camadas = [{ id: 'c1', t: 'extintor', at: [0.1, 0.1] }, { t: 'drywall', p: Array.from({ length: 60 }, () => [0.1, 0.1]) }]
    const ilegivel = { ok: false, erro: expect.stringContaining('não puderam ser lidos') }
    expect(await salvarRascunhoAction(R0, entrada())).toEqual(ilegivel)
    expect(await emitirRevisaoAction(R0)).toEqual(ilegivel)
    expect(r0().camadas).toHaveLength(2)
    expect(r0().status).toBe('rascunho')
  })
})

describe('revisão final da Leva 6b', () => {
  it('M2: nova revisão a partir de emitida ilegível copia só o legível e não nasce travada', async () => {
    await salvarRascunhoAction(R0, entrada())
    await emitirRevisaoAction(R0)
    // Só por SQL manual: uma linha de 60 pontos (o app aceita até 50), uma regra vazia e um carimbo com chave estranha.
    r0().camadas = [{ id: 'c1', t: 'extintor', at: [0.1, 0.1] }, { id: 'c2', t: 'drywall', p: Array.from({ length: 60 }, () => [0.1, 0.1]) }]
    r0().regras = ['Regra boa.', '']
    r0().carimbo = { titulo: 'x', estranha: 1 }
    const r = await novaRevisaoAction(FASE)
    expect(r.ok).toBe(true)
    const r1 = b.db.obras_fase_revisao.find((x) => x.id === r.revisaoId)!
    expect(r1.camadas).toEqual([{ id: 'c1', t: 'extintor', at: [0.1, 0.1] }])
    expect(r1.regras).toEqual(['Regra boa.'])
    expect(r1.carimbo).toMatchObject({ titulo: 'Planta de faseamento · Fase 1', desenho: 'FAS-01', cliente: 'DPSP' })
    // Destravada: salva e emite.
    expect(await salvarRascunhoAction(String(r.revisaoId), entrada())).toEqual({ ok: true })
    expect(await emitirRevisaoAction(String(r.revisaoId))).toEqual({ ok: true })
  })

  it('M2: rascunho ilegível pede ajuda ao suporte (nada de "até um administrador corrigir")', async () => {
    r0().regras = ['']
    const r = await salvarRascunhoAction(R0, entrada())
    expect((r as { erro: string }).erro).toMatch(/peça ajuda ao suporte/)
    expect((r as { erro: string }).erro).not.toMatch(/administrador corrigir/)
  })

  it.each([
    ['OBRAS_ENVIO: fase_revisao_id é de outra obra', 'Esta revisão não pertence a esta obra.'],
    ['OBRAS_ENVIO: fase_revisao_id não é revisão emitida', 'Esta revisão não pode ser enviada: ela precisa estar emitida.'],
  ])('M3: "%s" chega ao usuário sem o nome da coluna', async (message, esperado) => {
    await salvarRascunhoAction(R0, entrada())
    await emitirRevisaoAction(R0)
    b.erro['obras_envio.insert'] = { message, code: '23514' }
    const r = await enviarFaseamentoAction(R0)
    expect((r as { erro: string }).erro).toContain(esperado)
    expect((r as { erro: string }).erro).not.toMatch(/fase_revisao_id/i)
  })
})
