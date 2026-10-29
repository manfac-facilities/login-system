/** @jest-environment node */
/**
 * validarEEnviarAction (Task 9b). `lerObraGrande` mockado; Supabase = banco em
 * memória mínimo que imita a máquina de estados do RDO (validado_por/em pelo
 * trigger); nodemailer mockado (sendMail por destinatário); storage do admin
 * mockado (download das fotos).
 */

type Linha = Record<string, unknown>
let db: Record<string, Linha[]>
let seq = 0
const USUARIO = { email: 'eng@manfac.com.br' }

function construtor(tabela: string) {
  const filtros: ((l: Linha) => boolean)[] = []
  let op: 'select' | 'update' | 'insert' | 'upsert' = 'select'
  let payload: Linha | Linha[] | null = null
  let unico: 'maybe' | 'single' | null = null

  const executar = () => {
    const linhas = (db[tabela] ??= [])
    const alvo = () => linhas.filter((l) => filtros.every((f) => f(l)))
    let data: Linha[]
    if (op === 'select') data = alvo()
    else if (op === 'update') {
      data = alvo()
      for (const l of data) {
        const p = payload as Linha
        if (tabela === 'obras_rdo' && l.estado === 'rascunho' && p.estado === 'validado') {
          Object.assign(l, p, { validado_por: USUARIO.email, validado_em: '2026-10-29T21:40:00Z' })
        } else Object.assign(l, p)
      }
    } else if (op === 'insert') {
      data = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({ id: `id${++seq}`, ...p }))
      linhas.push(...data)
    } else {
      data = (Array.isArray(payload) ? payload : [payload!]).map((p) => {
        const e = linhas.find((l) => l.obra_id === p.obra_id && l.numero === p.numero)
        if (e) return Object.assign(e, p)
        linhas.push({ ...p })
        return p
      })
    }
    if (unico === 'single') return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'not single' } }
    if (unico === 'maybe') return { data: data[0] ?? null, error: null }
    return { data, error: null }
  }

  const q: Record<string, unknown> = {
    select: () => q,
    eq: (c: string, v: unknown) => (filtros.push((l) => l[c] === v), q),
    contains: (c: string, v: unknown[]) => (filtros.push((l) => v.every((x) => (l[c] as unknown[]).includes(x))), q),
    order: () => q,
    update: (p: Linha) => ((op = 'update'), (payload = p), q),
    insert: (p: Linha | Linha[]) => ((op = 'insert'), (payload = p), q),
    upsert: (p: Linha | Linha[]) => ((op = 'upsert'), (payload = p), q),
    maybeSingle: async () => ((unico = 'maybe'), executar()),
    single: async () => ((unico = 'single'), executar()),
    then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(executar()).then(ok, falha),
  }
  return q
}

const getUserMock = jest.fn()
const lerObraGrandeMock = jest.fn()
const sendMail = jest.fn()
const download = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: (t: string) => construtor(t) })),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ storage: { from: () => ({ download }) } }),
}))
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../../_lib/leitura', () => ({
  ...jest.requireActual('../../../_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => lerObraGrandeMock(...a),
}))

import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { validarEEnviarAction } from '../_actions'

const OBRA = 'o1'
const DIA = '2026-10-29'

function dadosObra() {
  const plano = Array.from({ length: 12 }, (_, i) => ({
    numero: i + 1, etapa: 'E', descricao: `Atividade ${i + 1}`, pred1: null, pred2: null,
    duracao: 2, bloqueiaPorTrava: i + 1 >= 11, pesoValor: 100,
  }))
  return {
    ok: true,
    dados: {
      obra: { id: OBRA, loja: 'DP Macaé 3', modalidade: 'obra', atividade_trava: 6, data_base: '2026-10-26', engenheiro_email: 'Eng@manfac.com.br' },
      versaoBase: { id: 'v1', numero: 1, salvaEm: '2026-10-26T12:00:00Z', motivo: null },
      versaoVigente: { id: 'v1', numero: 1, salvaEm: '2026-10-26T12:00:00Z', motivo: null },
      rascunho: null,
      plano,
      exec: plano.map((p) => ({
        numero: p.numero, status: p.numero === 6 ? 'em_andamento' : 'nao_iniciado',
        percentual: p.numero === 6 ? 0.5 : 0, inicioReal: p.numero === 6 ? '2026-10-27' : null, fimReal: null,
      })),
      impedimentos: [
        {
          id: 'x', obraId: OBRA, categoria: 'impedimento', tipo: 'Equipe', responsavel: 'manfac', atividadeNumero: null,
          descricao: 'Pedreiro faltou', pessoaCliente: null, fotoPath: null, travaAtividade: false, impactoDias: 0.5,
          exibirAoCliente: false, abertoEm: DIA, encerradoEm: null, rdoId: null, orientacaoId: null, criadoPor: null, criadoEm: DIA,
        },
      ],
      feriados: new Set<string>(),
      calc: { atividades: [], previsto: 0.1, realizado: 0.08, desvioPP: -2, terminoPrevisto: '2027-02-12', terminoProjetado: '2027-02-12' },
      terminoBase: '2027-02-12',
      sinal: 'amarelo',
      atraso: { total: 0, cliente: 0, manfac: 0, terceiro: 0, clima: 0 },
    },
  }
}

const dest = (email: string, lado: string, tipos = ['diario'], ativo = true) => ({ id: email, obra_id: OBRA, email, lado, tipos, ativo })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  seq = 0
  process.env.SMTP_HOST = 'smtp'
  process.env.SMTP_USUARIO = 'u'
  process.env.SMTP_SENHA = 's'
  process.env.SMTP_REMETENTE = 'manfac@manfac.com.br'
  db = {
    obras_rdo: [{
      id: 'r1', obra_id: OBRA, data: DIA, estado: 'rascunho', sem_execucao: false, motivo_sem_execucao: null,
      programacao_amanha: 'Seguir', validado_por: null, validado_em: null,
    }],
    obras_rdo_avanco: [
      { rdo_id: 'r1', numero: 6, de: 0.5, para: 1, concluida: true, causa: null },
      { rdo_id: 'r1', numero: 7, de: 0, para: 0.3, concluida: false, causa: null },
    ],
    obras_rdo_foto: [
      { id: 'f1', rdo_id: 'r1', path: 'o1/rdo/2026-10-29/a.jpg', legenda: 'fachada', ordem: 1 },
      { id: 'f2', rdo_id: 'r1', path: 'o1/rdo/2026-10-29/b.jpg', legenda: null, ordem: 2 },
    ],
    obras_atividade_exec: [],
    obras_destinatario: [
      dest('ana@dpsp.com.br', 'cliente'),
      dest('bia@dpsp.com.br', 'cliente'),
      dest('fora@dpsp.com.br', 'cliente', ['semanal']),
      dest('inativo@dpsp.com.br', 'cliente', ['diario'], false),
      dest('interno@manfac.com.br', 'interno'),
    ],
    obras_envio: [],
  }
  getUserMock.mockResolvedValue({ data: { user: USUARIO } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  lerObraGrandeMock.mockImplementation(async () => dadosObra())
  sendMail.mockResolvedValue({})
  download.mockImplementation(async (path: string) => ({
    data: new Blob([path.endsWith('b.jpg') ? new Uint8Array(2_000_000) : new Uint8Array(1000)]),
    error: null,
  }))
})

describe('validarEEnviarAction', () => {
  it('usuário comum (não é o engenheiro nem admin) → erro, nada muda', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'supervisor@manfac.com.br' } } })
    const r = await validarEEnviarAction(OBRA, DIA)
    expect(r).toEqual({ ok: false, erro: 'Só o engenheiro responsável da obra ou um administrador valida o diário' })
    expect(db.obras_rdo[0].estado).toBe('rascunho')
    expect(db.obras_atividade_exec).toHaveLength(0)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('sem acesso ao sistema → erro', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect(await validarEEnviarAction(OBRA, DIA)).toEqual({ ok: false, erro: 'Sem acesso ao Gestão de Obras' })
  })

  it('rascunho inexistente → erro', async () => {
    db.obras_rdo = []
    expect(await validarEEnviarAction(OBRA, DIA)).toEqual({ ok: false, erro: 'Diário não encontrado' })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('diário já enviado → erro', async () => {
    db.obras_rdo[0].estado = 'enviado'
    expect(await validarEEnviarAction(OBRA, DIA)).toEqual({ ok: false, erro: 'Diário já enviado' })
  })

  it('sucesso: aplica o avanço, valida, um e-mail por destinatário, 2 obras_envio, marca enviado', async () => {
    const r = await validarEEnviarAction(OBRA, DIA)
    expect(r).toEqual({ ok: true, enviados: 3 })

    expect(db.obras_atividade_exec).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ obra_id: OBRA, numero: 6, percentual: 1, status: 'concluido', inicio_real: '2026-10-27', fim_real: DIA }),
        expect.objectContaining({ obra_id: OBRA, numero: 7, percentual: 0.3, status: 'em_andamento', inicio_real: DIA, fim_real: null }),
      ]),
    )
    expect(db.obras_rdo[0]).toMatchObject({ estado: 'enviado', validado_por: USUARIO.email })

    expect(sendMail).toHaveBeenCalledTimes(3)
    const para = sendMail.mock.calls.map((c) => c[0].to).sort()
    expect(para).toEqual(['ana@dpsp.com.br', 'bia@dpsp.com.br', 'interno@manfac.com.br'])
    const doCliente = sendMail.mock.calls.find((c) => c[0].to === 'ana@dpsp.com.br')![0]
    const doInterno = sendMail.mock.calls.find((c) => c[0].to === 'interno@manfac.com.br')![0]
    expect(doCliente.subject).toBe('Diário de obra · DP Macaé 3 · dia 4 · 29/10/2026')
    expect(doCliente.html).not.toContain('Pedreiro faltou')
    expect(doInterno.html).toContain('Pedreiro faltou')
    // foto b.jpg tem 2 MB: omitida; a.jpg vai por CID
    expect(doCliente.attachments).toHaveLength(1)
    expect(doCliente.html).toContain(`cid:${doCliente.attachments[0].cid}`)
    expect(doCliente.html).toContain('1 foto omitida')

    expect(db.obras_envio).toHaveLength(2)
    expect(db.obras_envio).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lado: 'cliente', tipo: 'diario', referencia: DIA, rdo_id: 'r1', resultado: 'ok', destinatarios: ['ana@dpsp.com.br', 'bia@dpsp.com.br'] }),
        expect.objectContaining({ lado: 'interno', resultado: 'ok', destinatarios: ['interno@manfac.com.br'] }),
      ]),
    )
  })

  it('admin que não é o engenheiro também valida', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'admin@manfac.com.br' } } })
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    expect((await validarEEnviarAction(OBRA, DIA)).ok).toBe(true)
  })

  it('falha de SMTP grava resultado falha e mantém o RDO validado', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('x'), { code: 'ECONNECTION' }))
    const r = await validarEEnviarAction(OBRA, DIA)
    expect(r.ok).toBe(false)
    expect(db.obras_rdo[0].estado).toBe('validado')
    expect(db.obras_envio).toHaveLength(2)
    expect(db.obras_envio.every((e) => e.resultado === 'falha')).toBe(true)
    expect(String(db.obras_envio[0].detalhe)).toContain('ECONNECTION')
  })

  it('RDO validado com envio que falhou pode ser reenviado (sem reaplicar o avanço)', async () => {
    db.obras_rdo[0].estado = 'validado'
    db.obras_rdo[0].validado_por = 'eng@manfac.com.br'
    db.obras_rdo[0].validado_em = '2026-10-29T21:40:00Z'
    const r = await validarEEnviarAction(OBRA, DIA)
    expect(r).toEqual({ ok: true, enviados: 3 })
    expect(db.obras_atividade_exec).toHaveLength(0)
    expect(db.obras_rdo[0].estado).toBe('enviado')
  })

  it('sem destinatário cliente: valida, não envia e pede o cadastro', async () => {
    db.obras_destinatario = [dest('interno@manfac.com.br', 'interno')]
    const r = await validarEEnviarAction(OBRA, DIA)
    expect(r).toEqual({ ok: false, erro: 'Cadastre os destinatários na aba Comunicação' })
    expect(db.obras_rdo[0].estado).toBe('validado')
    expect(sendMail).not.toHaveBeenCalled()
    expect(db.obras_envio).toHaveLength(0)
  })

  it('SMTP sem configuração: não tenta enviar e registra falha', async () => {
    delete process.env.SMTP_HOST
    const r = await validarEEnviarAction(OBRA, DIA)
    expect(r.ok).toBe(false)
    expect(sendMail).not.toHaveBeenCalled()
    expect(db.obras_envio.every((e) => e.resultado === 'falha' && String(e.detalhe).includes('SMTP_HOST'))).toBe(true)
  })

  it('atividade travada no diário → recusa sem validar', async () => {
    db.obras_rdo_avanco = [{ rdo_id: 'r1', numero: 11, de: 0, para: 0.2, concluida: false, causa: null }]
    const r = await validarEEnviarAction(OBRA, DIA)
    expect(r).toEqual({ ok: false, erro: 'Atividade 11: travada até a atividade 6 ser concluída' })
    expect(db.obras_rdo[0].estado).toBe('rascunho')
  })
})
