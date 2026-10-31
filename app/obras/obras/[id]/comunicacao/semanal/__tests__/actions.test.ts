/**
 * @jest-environment node
 *
 * Actions do relatório semanal (Leva 3 §2.3): só engenheiro/admin (falha
 * fechada), observações só em rascunho, validar envia o que está SALVO,
 * versão cliente × interna, um obras_envio tipo semanal por lado, IA recebe só
 * o conteúdo do cliente e não grava nada. Supabase, e-mail, SDK e react-pdf mockados.
 */
import { obraGrandePdf } from '../../../../_pdf/__tests__/fixtures/rdo'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
let db: Record<string, Linha[]>
let seq = 0

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op = 'select'
  let payload: Linha = {}
  const executar = (unico: boolean) => {
    const linhas = (db[tabela] ??= [])
    if (op === 'insert') {
      const nova = { id: `id-${++seq}`, ...payload }
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
    gte: (c: string, v: string) => (filtros.push((l) => String(l[c]) >= v), q),
    lte: (c: string, v: string) => (filtros.push((l) => String(l[c]) <= v), q),
    in: (c: string, v: unknown[]) => (filtros.push((l) => v.includes(l[c])), q),
    contains: (c: string, v: unknown[]) => (filtros.push((l) => v.every((x) => (l[c] ?? []).includes(x))), q),
    order: () => q,
    insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
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
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 semanal'))
const createMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t) })),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ storage: { from: () => ({ download: jest.fn() }) } }) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../../../_lib/enviar', () => ({ enviarEmail: (...a: unknown[]) => enviarEmailMock(...a) }))
jest.mock('../../../../_lib/leitura', () => ({
  ...jest.requireActual('../../../../_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a),
}))
jest.mock('../../../../_pdf/carregar-semanal', () => ({
  ...jest.requireActual('../../../../_pdf/carregar-semanal'),
  renderizarSemanal: (...a: unknown[]) => renderMock(...(a as [])),
}))
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ beta: { messages: { create: (...a: unknown[]) => createMock(...a) } } })),
}))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { salvarObservacoesSemanalAction, sugerirObservacoesIaAction, validarEEnviarSemanalAction } from '../_actions'

const OBRA = 'o1'
const SEG = '2026-10-26'
const ENG = 'eng@manfac.com.br'
const USU = 'usu@manfac.com.br'
const ADM = 'adm@manfac.com.br'
const logar = (email: string | null) => getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } })
const semanal = (over: Linha = {}) => ({ id: 's1', obra_id: OBRA, semana_inicio: SEG, estado: 'rascunho', observacoes: 'Texto salvo.', ...over })
const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

beforeEach(() => {
  jest.clearAllMocks()
  seq = 0
  db = {
    obras_obra: [{ id: OBRA, modalidade: 'obra', engenheiro_email: ENG }],
    obras_semanal: [],
    obras_plano_semana: [],
    obras_restricao: [
      { id: 'r1', obra_id: OBRA, atividade_numero: 3, tipo: 'decisao_cliente', descricao: 'Aprovar layout', responsavel: 'cliente', prazo: null, situacao: 'em_tratativa', criado_em: 'x' },
      { id: 'r2', obra_id: OBRA, atividade_numero: 3, tipo: 'acesso', descricao: 'Área já liberada', responsavel: 'cliente', prazo: null, situacao: 'liberada', criado_em: 'x' },
    ],
    obras_rdo: [],
    obras_destinatario: [
      { obra_id: OBRA, email: 'cli@cliente.com', lado: 'cliente', tipos: ['semanal'], ativo: true },
      { obra_id: OBRA, email: 'so-diario@cliente.com', lado: 'cliente', tipos: ['diario'], ativo: true },
      { obra_id: OBRA, email: 'int@manfac.com.br', lado: 'interno', tipos: ['semanal'], ativo: true },
      { obra_id: OBRA, email: 'velho@cliente.com', lado: 'cliente', tipos: ['semanal'], ativo: false },
    ],
    obras_envio: [],
  }
  logar(ENG)
  ;(isAdmin as jest.Mock).mockImplementation(async (_s, e: string) => e === ADM)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  lerObraGrandeMock.mockResolvedValue({ ok: true, dados: obraGrandePdf() })
  enviarEmailMock.mockImplementation(async ({ para }: { para: string[] }) => ({ ok: true, aceitos: para, falhas: [] }))
  process.env.ANTHROPIC_API_KEY = 'sk-teste'
})
afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
})

describe('guarda', () => {
  it('sem sessão, sem acesso e usuário que não é o engenheiro: recusa sem gravar', async () => {
    logar(null)
    expect((await salvarObservacoesSemanalAction(OBRA, SEG, 'x')).ok).toBe(false)
    logar(USU)
    const r = await salvarObservacoesSemanalAction(OBRA, SEG, 'x')
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/engenheiro/) })
    expect((await validarEEnviarSemanalAction(OBRA, SEG)).ok).toBe(false)
    expect((await sugerirObservacoesIaAction(OBRA, SEG)).ok).toBe(false)
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    logar(ENG)
    expect((await salvarObservacoesSemanalAction(OBRA, SEG, 'x')).ok).toBe(false)
    expect(db.obras_semanal).toEqual([])
    expect(enviarEmailMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('obra de outra modalidade ou inexistente: não encontrada', async () => {
    db.obras_obra[0].modalidade = 'spot'
    expect(await salvarObservacoesSemanalAction(OBRA, SEG, 'x')).toEqual({ ok: false, erro: 'Obra não encontrada' })
    expect(await salvarObservacoesSemanalAction('outra', SEG, 'x')).toEqual({ ok: false, erro: 'Obra não encontrada' })
  })

  it('admin passa mesmo sem ser o engenheiro', async () => {
    logar(ADM)
    expect(await salvarObservacoesSemanalAction(OBRA, SEG, 'x')).toEqual({ ok: true })
  })
})

describe('salvarObservacoesSemanalAction', () => {
  it('cria o rascunho e depois atualiza; semana inválida recusa', async () => {
    expect(await salvarObservacoesSemanalAction(OBRA, SEG, '  Primeira versão  ')).toEqual({ ok: true })
    expect(db.obras_semanal).toEqual([expect.objectContaining({ obra_id: OBRA, semana_inicio: SEG, observacoes: 'Primeira versão' })])
    db.obras_semanal[0].estado = 'rascunho'
    expect(await salvarObservacoesSemanalAction(OBRA, SEG, 'Segunda')).toEqual({ ok: true })
    expect(db.obras_semanal[0].observacoes).toBe('Segunda')
    expect((await salvarObservacoesSemanalAction(OBRA, '2026-10-27', 'x')).ok).toBe(false)
  })

  it('validado: não muda as observações', async () => {
    db.obras_semanal = [semanal({ estado: 'validado' })]
    const r = await salvarObservacoesSemanalAction(OBRA, SEG, 'Mudou')
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/já validado/) })
    expect(db.obras_semanal[0].observacoes).toBe('Texto salvo.')
  })
})

describe('validarEEnviarSemanalAction', () => {
  it('sem rascunho salvo: recusa', async () => {
    expect(await validarEEnviarSemanalAction(OBRA, SEG)).toEqual({ ok: false, erro: expect.stringMatching(/Salve/) })
  })

  it('sem destinatário semanal do cliente: não valida', async () => {
    db.obras_semanal = [semanal()]
    db.obras_destinatario = db.obras_destinatario.filter((d) => d.lado === 'interno')
    expect((await validarEEnviarSemanalAction(OBRA, SEG)).ok).toBe(false)
    expect(db.obras_semanal[0].estado).toBe('rascunho')
    expect(enviarEmailMock).not.toHaveBeenCalled()
  })

  it('valida, envia cliente e interno com o PDF e registra obras_envio semanal por lado', async () => {
    db.obras_semanal = [semanal()]
    const r = await validarEEnviarSemanalAction(OBRA, SEG)
    expect(r).toEqual({ ok: true, enviados: 2 })
    expect(db.obras_semanal[0].estado).toBe('enviado')
    expect(enviarEmailMock).toHaveBeenCalledTimes(2)
    const [cli, int] = enviarEmailMock.mock.calls.map((c) => c[0])
    expect(cli.para).toEqual(['cli@cliente.com'])
    expect(int.para).toEqual(['int@manfac.com.br'])
    expect(cli.anexos).toEqual([{ nome: 'semanal-dp-macae-3-2026-10-26.pdf', conteudo: Buffer.from('%PDF-1.4 semanal') }])
    // Cliente: observação salva, sem R$, sem oculto, sem restrição liberada. Interno: o oculto aparece.
    expect(cli.texto).toContain('Texto salvo.')
    expect(cli.html + cli.texto).not.toMatch(/R\$|98765|123456/)
    expect(cli.html + cli.texto).not.toContain('Pedreiro faltou')
    expect(cli.texto).not.toContain('Área já liberada')
    expect(cli.texto).toContain('Aprovar layout')
    expect(int.texto).toContain('Pedreiro faltou')
    expect(int.assunto).toMatch(/interno$/)
    expect(db.obras_envio).toEqual([
      expect.objectContaining({ obra_id: OBRA, tipo: 'semanal', referencia: SEG, semanal_id: 's1', lado: 'cliente', destinatarios: ['cli@cliente.com'], resultado: 'ok' }),
      expect.objectContaining({ tipo: 'semanal', semanal_id: 's1', lado: 'interno', resultado: 'ok' }),
    ])
    // PDF é a versão cliente.
    const pdf = (renderMock.mock.calls[0] as unknown[])[0] as { conteudo: { lado: string } }
    expect(pdf.conteudo.lado).toBe('cliente')
  })

  it('validar congela cliente, interno e fotos em obras_semanal.conteudo', async () => {
    db.obras_semanal = [semanal()]
    await validarEEnviarSemanalAction(OBRA, SEG)
    const c = db.obras_semanal[0].conteudo
    expect(c.cliente).toMatchObject({ lado: 'cliente', observacoes: 'Texto salvo.' })
    expect(c.interno).toMatchObject({ lado: 'interno' })
    expect(c.fotos).toEqual([])
    expect(JSON.stringify(c.cliente)).not.toContain('Pedreiro faltou')
    expect(JSON.stringify(c.interno)).toContain('Pedreiro faltou')
  })

  it('reenvio a quem falta sai do conteúdo congelado, não do estado de hoje', async () => {
    db.obras_semanal = [semanal()]
    db.obras_destinatario = db.obras_destinatario.filter((d) => d.lado === 'cliente')
    expect(await validarEEnviarSemanalAction(OBRA, SEG)).toEqual({ ok: true, enviados: 1 })
    // Depois da validação: restrição liberada e observação mexida direto no banco; entra um interno.
    db.obras_restricao[0].situacao = 'liberada'
    db.obras_semanal[0].observacoes = 'Mexido depois.'
    db.obras_destinatario.push({ obra_id: OBRA, email: 'int@manfac.com.br', lado: 'interno', tipos: ['semanal'], ativo: true })
    enviarEmailMock.mockClear()
    expect(await validarEEnviarSemanalAction(OBRA, SEG)).toEqual({ ok: true, enviados: 1 })
    const int = enviarEmailMock.mock.calls[0][0]
    expect(int.para).toEqual(['int@manfac.com.br'])
    expect(int.texto).toContain('Aprovar layout')
    expect(int.texto).toContain('Texto salvo.')
    expect(int.texto).not.toContain('Mexido depois.')
  })

  it('já validado: manda só a quem não recebeu; falha do cliente mantém validado', async () => {
    db.obras_semanal = [semanal({ estado: 'validado' })]
    db.obras_envio = [{ semanal_id: 's1', lado: 'interno', destinatarios: ['int@manfac.com.br'] }]
    enviarEmailMock.mockResolvedValueOnce({ ok: false, aceitos: [], falhas: [{ para: 'cli@cliente.com', erro: '550' }] })
    const r = await validarEEnviarSemanalAction(OBRA, SEG)
    expect(r.ok).toBe(false)
    expect(enviarEmailMock).toHaveBeenCalledTimes(1)
    expect(db.obras_semanal[0].estado).toBe('validado')
    expect(db.obras_envio[1]).toMatchObject({ lado: 'cliente', resultado: 'falha', destinatarios: [] })
  })
})

describe('sugerirObservacoesIaAction', () => {
  it('sem chave: recusa e não chama o SDK', async () => {
    delete process.env.ANTHROPIC_API_KEY
    expect((await sugerirObservacoesIaAction(OBRA, SEG)).ok).toBe(false)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('manda só o resumo do cliente e não grava nada', async () => {
    db.obras_semanal = [semanal({ observacoes: 'Observação antiga' })]
    createMock.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Rascunho da IA.' }] })
    expect(await sugerirObservacoesIaAction(OBRA, SEG)).toEqual({ ok: true, texto: 'Rascunho da IA.' })
    const conteudo = createMock.mock.calls[0][0].messages[0].content as string
    expect(conteudo).not.toMatch(/R\$|98765|123456/)
    expect(conteudo).not.toContain('Pedreiro faltou')
    expect(conteudo).not.toContain('Área já liberada')
    expect(conteudo).not.toContain('Observação antiga')
    expect(conteudo).toContain('Aprovar layout')
    expect(db.obras_semanal[0].observacoes).toBe('Observação antiga')
    expect(enviarEmailMock).not.toHaveBeenCalled()
  })

  it('refusal: mensagem amigável', async () => {
    createMock.mockResolvedValue({ stop_reason: 'refusal', content: [] })
    const r = await sugerirObservacoesIaAction(OBRA, SEG)
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/à mão/) })
  })
})
