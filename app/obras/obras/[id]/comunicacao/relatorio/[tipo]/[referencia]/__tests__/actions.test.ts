/**
 * @jest-environment node
 *
 * Actions dos relatórios de período (Leva 4 §2.1): só engenheiro/admin (falha
 * fechada), tipo/referência estritos, fase indisponível sem etapa concluída,
 * highlights desmarcados fora do congelado/e-mail/PDF, ids (com numero) nunca
 * no lado cliente, destinatários por tipo, um obras_envio por lado com
 * relatorio_id e congelado no esquema. Supabase, e-mail, SDK e react-pdf mockados.
 */
import { obraPeriodo } from '../../../../../../_pdf/__tests__/fixtures/periodo'

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
      const nova = { id: `id-${++seq}`, estado: tabela === 'obras_relatorio' ? 'rascunho' : undefined, ...payload }
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
    overlaps: (c: string, v: unknown[]) => (filtros.push((l) => v.some((x) => (l[c] ?? []).includes(x))), q),
    order: () => q,
    insert: (p: Linha) => ((op = 'insert'), (payload = p), q),
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    maybeSingle: async () => executar(true),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(executar(false)).then(ok, ko),
  }
  return q
}

const getUserMock = jest.fn()
const enviarEmailMock = jest.fn()
const lerObraGrandeMock = jest.fn()
const renderMock = jest.fn(async () => Buffer.from('%PDF-1.4 periodo'))
const createMock = jest.fn()
const HOJE = '2026-11-10'
let mockHoje = HOJE

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t) })),
}))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ storage: { from: () => ({ download: jest.fn() }) } }) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../../../../../../_lib/tipos', () => ({
  ...jest.requireActual('../../../../../../../_lib/tipos'),
  hojeISO: () => mockHoje,
}))
jest.mock('../../../../../../_lib/enviar', () => ({ enviarEmail: (...a: unknown[]) => enviarEmailMock(...a) }))
jest.mock('../../../../../../_lib/leitura', () => ({
  ...jest.requireActual('../../../../../../_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a),
}))
jest.mock('../../../../../../_pdf/carregar-periodo', () => ({
  ...jest.requireActual('../../../../../../_pdf/carregar-periodo'),
  renderizarPeriodo: (...a: unknown[]) => renderMock(...(a as [])),
}))
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ beta: { messages: { create: (...a: unknown[]) => createMock(...a) } } })),
}))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(),
  Document: 'Document', Page: 'Page', View: 'View', Text: 'Text', Image: 'Image', Svg: 'Svg', Polyline: 'Polyline', Line: 'Line',
  StyleSheet: { create: <T,>(s: T) => s },
  Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { conteudoPeriodoValido } from '../../../../../../_lib/relatorio-periodo'
import { salvarRascunhoRelatorioAction, sugerirObservacoesRelatorioIaAction, validarEEnviarRelatorioAction } from '../_actions'

const OBRA = 'o1'
const ENG = 'eng@manfac.com.br'
const USU = 'usu@manfac.com.br'
const ADM = 'adm@manfac.com.br'
const logar = (email: string | null) => getUserMock.mockResolvedValue({ data: { user: email ? { email } : null } })
const entrada = (over: Partial<{ observacoes: string; marcados: string[]; livre: string }> = {}) => ({
  observacoes: 'Fase entregue antes.',
  marcados: ['etapa-antecipada:10', 'atividade-antecipada:20', 'inventado:99'],
  livre: 'Equipe elogiada pelo cliente',
  ...over,
})
const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY

beforeEach(() => {
  jest.clearAllMocks()
  mockHoje = HOJE
  seq = 0
  db = {
    obras_obra: [{ id: OBRA, modalidade: 'obra', engenheiro_email: ENG }],
    obras_relatorio: [],
    obras_plano_semana: [],
    obras_restricao: [
      { id: 'r1', obra_id: OBRA, atividade_numero: 30, tipo: 'decisao_cliente', descricao: 'Aprovar layout', responsavel: 'cliente', prazo: null, situacao: 'em_tratativa', criado_em: 'x' },
    ],
    obras_rdo: [],
    obras_destinatario: [
      { obra_id: OBRA, email: 'cli-semanal@cliente.com', lado: 'cliente', tipos: ['semanal'], ativo: true },
      { obra_id: OBRA, email: 'cli-mensal@cliente.com', lado: 'cliente', tipos: ['mensal'], ativo: true },
      { obra_id: OBRA, email: 'so-diario@cliente.com', lado: 'cliente', tipos: ['diario'], ativo: true },
      { obra_id: OBRA, email: 'int@manfac.com.br', lado: 'interno', tipos: ['semanal', 'mensal'], ativo: true },
      { obra_id: OBRA, email: 'velho@cliente.com', lado: 'cliente', tipos: ['mensal'], ativo: false },
    ],
    obras_envio: [],
  }
  logar(ENG)
  ;(isAdmin as jest.Mock).mockImplementation(async (_s, e: string) => e === ADM)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  lerObraGrandeMock.mockImplementation(async () => ({ ok: true, dados: obraPeriodo() }))
  enviarEmailMock.mockImplementation(async ({ para }: { para: string[] }) => ({ ok: true, aceitos: para, falhas: [] }))
  process.env.ANTHROPIC_API_KEY = 'sk-teste'
})
afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY
})

describe('guarda', () => {
  it('sem sessão, sem acesso e quem não é o engenheiro: recusa sem gravar nem ler a obra grande', async () => {
    logar(null)
    expect((await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())).ok).toBe(false)
    logar(USU)
    expect(await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())).toEqual({ ok: false, erro: expect.stringMatching(/engenheiro/) })
    expect((await validarEEnviarRelatorioAction(OBRA, 'fase', '10')).ok).toBe(false)
    expect((await sugerirObservacoesRelatorioIaAction(OBRA, 'fase', '10')).ok).toBe(false)
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    logar(ENG)
    expect((await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())).ok).toBe(false)
    expect(db.obras_relatorio).toEqual([])
    expect(lerObraGrandeMock).not.toHaveBeenCalled()
    expect(enviarEmailMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('admin passa; obra SPOT ou de outro id: não encontrada', async () => {
    logar(ADM)
    expect(await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())).toEqual({ ok: true })
    db.obras_obra[0].modalidade = 'spot'
    expect(await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())).toEqual({ ok: false, erro: 'Obra não encontrada' })
    expect(await salvarRascunhoRelatorioAction('outra', 'fase', '10', entrada())).toEqual({ ok: false, erro: 'Obra não encontrada' })
  })

  it('tipo e referência estritos: nada lido nem gravado', async () => {
    for (const [t, r] of [['semanal', '2026-10-26'], ['mensal', '2026-13'], ['mensal', '2026-1'], ['fase', '010'], ['fase', '1;drop'], ['entrega', 'x'], ['__proto__', 'entrega']]) {
      expect(await salvarRascunhoRelatorioAction(OBRA, t, r, entrada())).toEqual({ ok: false, erro: 'Relatório inválido' })
      expect(await validarEEnviarRelatorioAction(OBRA, t, r)).toEqual({ ok: false, erro: 'Relatório inválido' })
    }
    expect(lerObraGrandeMock).not.toHaveBeenCalled()
    expect(db.obras_relatorio).toEqual([])
  })
})

describe('disponibilidade', () => {
  it('fase indisponível sem a etapa concluída; entrega sem a obra concluída; mês futuro', async () => {
    expect(await salvarRascunhoRelatorioAction(OBRA, 'fase', '30', entrada())).toEqual({ ok: false, erro: expect.stringMatching(/não concluída/) })
    expect(await salvarRascunhoRelatorioAction(OBRA, 'fase', '99', entrada())).toEqual({ ok: false, erro: expect.stringMatching(/não encontrada/) })
    expect(await salvarRascunhoRelatorioAction(OBRA, 'entrega', 'entrega', entrada())).toEqual({ ok: false, erro: expect.stringMatching(/não concluída/) })
    expect(await salvarRascunhoRelatorioAction(OBRA, 'mensal', '2026-12', entrada())).toEqual({ ok: false, erro: expect.stringMatching(/não começou/) })
    expect(await salvarRascunhoRelatorioAction(OBRA, 'mensal', '2026-09', entrada())).toEqual({ ok: false, erro: expect.stringMatching(/data-base/) })
    expect(db.obras_relatorio).toEqual([])
  })

  it('rascunho de fase cuja etapa deixou de estar concluída não valida', async () => {
    await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())
    const reaberta = obraPeriodo()
    reaberta.calc!.atividades[1] = { ...reaberta.calc!.atividades[1], status: 'em_andamento', fimReal: null }
    lerObraGrandeMock.mockResolvedValue({ ok: true, dados: reaberta })
    expect(await validarEEnviarRelatorioAction(OBRA, 'fase', '10')).toEqual({ ok: false, erro: expect.stringMatching(/não concluída/) })
    expect(db.obras_relatorio[0].estado).toBe('rascunho')
    expect(enviarEmailMock).not.toHaveBeenCalled()
  })
})

describe('salvarRascunhoRelatorioAction', () => {
  it('grava período, observações e os automáticos DESmarcados (id inventado não entra); depois atualiza', async () => {
    expect(await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())).toEqual({ ok: true })
    expect(db.obras_relatorio).toEqual([
      expect.objectContaining({
        obra_id: OBRA, tipo: 'fase', referencia: '10', periodo_inicio: '2026-10-26', periodo_fim: '2026-11-06',
        observacoes: 'Fase entregue antes.',
        highlights: { desmarcados: ['atividade-antecipada:10', 'impedimento-resolvido:cli'], livre: 'Equipe elogiada pelo cliente' },
      }),
    ])
    expect(await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada({ marcados: [], livre: '' }))).toEqual({ ok: true })
    expect(db.obras_relatorio).toHaveLength(1)
    expect(db.obras_relatorio[0].highlights).toEqual({
      desmarcados: ['etapa-antecipada:10', 'atividade-antecipada:10', 'atividade-antecipada:20', 'impedimento-resolvido:cli'],
      livre: null,
    })
  })

  it('limites e seleção inválida; validado não muda', async () => {
    expect((await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada({ livre: 'x'.repeat(301) }))).ok).toBe(false)
    expect((await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', { ...entrada(), marcados: 'tudo' as unknown as string[] })).ok).toBe(false)
    db.obras_relatorio = [{ id: 'r1', obra_id: OBRA, tipo: 'fase', referencia: '10', estado: 'validado', periodo_inicio: '2026-10-26', periodo_fim: '2026-11-06', observacoes: 'Antes' }]
    expect(await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())).toEqual({ ok: false, erro: expect.stringMatching(/já validado/) })
    expect(db.obras_relatorio[0].observacoes).toBe('Antes')
  })
})

describe('validarEEnviarRelatorioAction', () => {
  it('sem rascunho salvo: recusa', async () => {
    expect(await validarEEnviarRelatorioAction(OBRA, 'fase', '10')).toEqual({ ok: false, erro: expect.stringMatching(/Salve/) })
  })

  it('fase: congela no esquema, desmarcado fora, livre dentro, ids nunca no cliente; destinatários semanal OU mensal', async () => {
    await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())
    expect(await validarEEnviarRelatorioAction(OBRA, 'fase', '10')).toEqual({ ok: true, enviados: 3 })
    const r = db.obras_relatorio[0]
    expect(r.estado).toBe('enviado')
    expect(conteudoPeriodoValido(r.conteudo.cliente, 'cliente', { tipo: 'fase', referencia: '10' })).toBe(true)
    expect(conteudoPeriodoValido(r.conteudo.interno, 'interno', { tipo: 'fase', referencia: '10' })).toBe(true)
    expect(r.conteudo.fotos).toEqual([])
    const hl = r.conteudo.cliente.highlights as string[]
    expect(hl.some((h) => h.startsWith('Etapa 1 — Demolição'))).toBe(true)
    expect(hl.some((h) => h.includes('Retirada de entulho'))).toBe(true)
    // Desmarcado (atividade 10 antecipada) fora do congelado, do e-mail e do PDF.
    expect(hl.some((h) => h.includes('Demolição do piso concluída'))).toBe(false)
    expect(hl).toContain('Equipe elogiada pelo cliente')

    const [cli, int] = enviarEmailMock.mock.calls.map((c) => c[0])
    expect(cli.para).toEqual(['cli-semanal@cliente.com', 'cli-mensal@cliente.com'])
    expect(int.para).toEqual(['int@manfac.com.br'])
    expect(cli.anexos).toEqual([{ nome: 'fase-dp-macae-3-2026-11-06.pdf', conteudo: Buffer.from('%PDF-1.4 periodo') }])
    const cliTudo = cli.html + cli.texto + JSON.stringify(r.conteudo.cliente)
    expect(cliTudo).toContain('Equipe elogiada pelo cliente')
    expect(cliTudo).not.toContain('Demolição do piso concluída em')
    expect(cliTudo).not.toMatch(/R\$|98765|123456|antecipada|Pedreiro faltou/)
    expect(int.texto).toContain('Pedreiro faltou')
    expect(int.assunto).toMatch(/interno$/)
    const pdf = (renderMock.mock.calls[0] as unknown[])[0] as { conteudo: { lado: string; highlights: string[] } }
    expect(pdf.conteudo.lado).toBe('cliente')
    expect(pdf.conteudo.highlights).toEqual(hl)

    expect(db.obras_envio).toEqual([
      expect.objectContaining({ obra_id: OBRA, tipo: 'fase', referencia: HOJE, relatorio_id: r.id, lado: 'cliente', resultado: 'ok' }),
      expect.objectContaining({ tipo: 'fase', relatorio_id: r.id, lado: 'interno', resultado: 'ok' }),
    ])
  })

  it('mensal no meio do mês: rascunho sim, validar não (só no último dia útil)', async () => {
    expect(await salvarRascunhoRelatorioAction(OBRA, 'mensal', '2026-11', entrada({ marcados: [] }))).toEqual({ ok: true })
    expect(await validarEEnviarRelatorioAction(OBRA, 'mensal', '2026-11')).toEqual({
      ok: false,
      erro: 'O relatório mensal só pode ser validado a partir de 30/11/2026 (último dia útil do mês)',
    })
    mockHoje = '2026-11-27'
    expect((await validarEEnviarRelatorioAction(OBRA, 'mensal', '2026-11')).ok).toBe(false)
    expect(db.obras_relatorio[0].estado).toBe('rascunho')
    expect(db.obras_relatorio[0].conteudo ?? null).toBeNull()
    expect(enviarEmailMock).not.toHaveBeenCalled()
    expect(db.obras_envio).toEqual([])
  })

  it('mensal com o último dia útil feriado da obra: valida a partir do dia útil anterior', async () => {
    const comFeriado = () => {
      const og = obraPeriodo()
      og.feriados = new Set(['2026-11-30'])
      return { ok: true, dados: og }
    }
    lerObraGrandeMock.mockImplementation(async () => comFeriado())
    mockHoje = '2026-11-26'
    await salvarRascunhoRelatorioAction(OBRA, 'mensal', '2026-11', entrada({ marcados: [] }))
    expect(await validarEEnviarRelatorioAction(OBRA, 'mensal', '2026-11')).toEqual({ ok: false, erro: expect.stringContaining('a partir de 27/11/2026') })
    mockHoje = '2026-11-27'
    expect(await validarEEnviarRelatorioAction(OBRA, 'mensal', '2026-11')).toEqual({ ok: true, enviados: 2 })
    expect(db.obras_relatorio[0]).toMatchObject({ estado: 'enviado', periodo_inicio: '2026-11-01', periodo_fim: '2026-11-27' })
  })

  it('mensal no último dia útil: período do mês inteiro, só destinatário do tipo mensal', async () => {
    mockHoje = '2026-11-30'
    await salvarRascunhoRelatorioAction(OBRA, 'mensal', '2026-11', entrada({ marcados: [] }))
    expect(db.obras_relatorio[0]).toMatchObject({ periodo_inicio: '2026-11-01', periodo_fim: '2026-11-30' })
    expect(await validarEEnviarRelatorioAction(OBRA, 'mensal', '2026-11')).toEqual({ ok: true, enviados: 2 })
    expect(db.obras_relatorio[0].conteudo.cliente.avanco.ate).toBe('30/11/2026')
    expect(enviarEmailMock.mock.calls[0][0].para).toEqual(['cli-mensal@cliente.com'])
    expect(enviarEmailMock.mock.calls[0][0].assunto).toBe('Relatório mensal · DP Macaé 3 · novembro de 2026')
  })

  it('sem destinatário do cliente do tipo: não valida', async () => {
    await salvarRascunhoRelatorioAction(OBRA, 'mensal', '2026-11', entrada())
    db.obras_destinatario = db.obras_destinatario.filter((d) => !(d.lado === 'cliente' && d.tipos.includes('mensal')))
    expect(await validarEEnviarRelatorioAction(OBRA, 'mensal', '2026-11')).toEqual({ ok: false, erro: expect.stringMatching(/tipo Mensal/) })
    expect(db.obras_relatorio[0].estado).toBe('rascunho')
  })

  it('reenvio a quem falta sai do congelado; congelado adulterado é ignorado', async () => {
    db.obras_destinatario = db.obras_destinatario.filter((d) => d.lado === 'cliente')
    await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada())
    await validarEEnviarRelatorioAction(OBRA, 'fase', '10')
    db.obras_relatorio[0].observacoes = 'Mexido depois.'
    db.obras_destinatario.push({ obra_id: OBRA, email: 'int@manfac.com.br', lado: 'interno', tipos: ['mensal'], ativo: true })
    enviarEmailMock.mockClear()
    expect(await validarEEnviarRelatorioAction(OBRA, 'fase', '10')).toEqual({ ok: true, enviados: 1 })
    const int = enviarEmailMock.mock.calls[0][0]
    expect(int.texto).toContain('Fase entregue antes.')
    expect(int.texto).not.toContain('Mexido depois.')

    // Congelado com HTML no título: fora do esquema? Não — texto é escapado; sinal adulterado é rejeitado.
    db.obras_relatorio[0].conteudo.interno.sinal = { ...db.obras_relatorio[0].conteudo.interno.sinal, fundo: 'red;background:url(x)' }
    db.obras_destinatario.push({ obra_id: OBRA, email: 'int2@manfac.com.br', lado: 'interno', tipos: ['semanal'], ativo: true })
    enviarEmailMock.mockClear()
    await validarEEnviarRelatorioAction(OBRA, 'fase', '10')
    expect(enviarEmailMock.mock.calls[0][0].html).not.toContain('url(x)')
  })
})

describe('sugerirObservacoesRelatorioIaAction', () => {
  it('manda só o resumo do cliente com as instruções do período e não grava nada', async () => {
    await salvarRascunhoRelatorioAction(OBRA, 'fase', '10', entrada({ observacoes: 'Observação antiga' }))
    createMock.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Rascunho da IA.' }] })
    expect(await sugerirObservacoesRelatorioIaAction(OBRA, 'fase', '10')).toEqual({ ok: true, texto: 'Rascunho da IA.' })
    const args = createMock.mock.calls[0][0]
    expect(args.system).toMatch(/relatório de fase/)
    expect(args.model).toBe('claude-opus-5-5')
    const conteudo = args.messages[0].content as string
    expect(conteudo).toMatch(/^Dados do período:/)
    expect(conteudo).not.toMatch(/R\$|98765|123456|Pedreiro faltou|Observação antiga|antecipada:/)
    expect(conteudo).toContain('Aprovar layout')
    expect(db.obras_relatorio[0].observacoes).toBe('Observação antiga')
  })

  it('refusal: mensagem amigável', async () => {
    createMock.mockResolvedValue({ stop_reason: 'refusal', content: [] })
    expect(await sugerirObservacoesRelatorioIaAction(OBRA, 'fase', '10')).toEqual({ ok: false, erro: expect.stringMatching(/à mão/) })
  })
})
