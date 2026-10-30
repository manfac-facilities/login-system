/**
 * @jest-environment node
 *
 * Envio de extrato e cadastros (ligação cartão/tag -> equipe, vigência de
 * centro de custo). Território de dinheiro: toda negação falha FECHADA e
 * nada é gravado sem gestor/admin confirmado pelo banco.
 */
import fs from 'node:fs'
import path from 'node:path'

const getUserMock = jest.fn()
const podeGerirMock = jest.fn()
const registrarMock = jest.fn()
const insertMock = jest.fn()
const gravadasMock = jest.fn()
const inMock = jest.fn((_col: string, codigos: string[]) => gravadasMock(codigos))
const ligacoesMock = jest.fn()
const fromMock = jest.fn((tabela: string) => ({
  tabela,
  insert: insertMock,
  select: (cols: string) =>
    cols.startsWith('codigo_transacao')
      ? { eq: () => ({ in: inMock }) }
      : { eq: () => ({ eq: () => ligacoesMock() }) },
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string, args?: unknown) => {
      if (fn === 'sofia_pode_gerir') return podeGerirMock()
      if (fn === 'sofia_registrar_extrato') return registrarMock(args)
      return Promise.reject(new Error(`rpc inesperada: ${fn}`))
    }),
    from: fromMock,
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  enviarExtratoAction,
  criarLigacaoAction,
  encerrarLigacaoAction,
  novaVigenciaCentroCustoAction,
} from '../_actions'

const FIX = path.join(process.cwd(), 'lib', 'sofia', 'extratos', '__tests__', 'fixtures')
const XLSX = fs.readFileSync(path.join(FIX, 'ticketlog-anonimizado.xlsx'))
const CSV = fs.readFileSync(path.join(FIX, 'veloe-anonimizado.csv'))
const MSG_PERM = 'Apenas administradores ou gestores de frotas podem executar esta ação'
const EQUIPE = '11111111-1111-4111-8111-111111111111'

function fdEnvio(over: Record<string, string | File | null> = {}) {
  const fd = new FormData()
  const base: Record<string, string | File | null> = {
    plataforma: 'ticketlog',
    saldo: '1.234,56',
    arquivo: new File([XLSX], 'RFCV_262780_20261027.xlsx'),
    ...over,
  }
  for (const [k, v] of Object.entries(base)) if (v !== null) fd.set(k, v)
  return fd
}

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { email: 'gestor@manfac.com.br' } } })
  podeGerirMock.mockResolvedValue({ data: true, error: null })
  registrarMock.mockResolvedValue({
    data: { envio_id: 'e', linhas: 5, novas: 3, existentes: 2, sem_centro_custo: 1, periodo_inicio: '2026-10-01', periodo_fim: '2026-10-01' },
    error: null,
  })
  insertMock.mockResolvedValue({ error: null })
  gravadasMock.mockResolvedValue({ data: [], error: null })
  ligacoesMock.mockResolvedValue({ data: [], error: null })
})

describe('enviarExtratoAction — permissão (falha fechada)', () => {
  it.each([
    ['sem sessão', () => getUserMock.mockResolvedValue({ data: { user: null } })],
    ['não pode gerir', () => podeGerirMock.mockResolvedValue({ data: false, error: null })],
    ['RPC de permissão dá erro', () => podeGerirMock.mockResolvedValue({ data: true, error: { message: 'x' } })],
    ['RPC de permissão devolve null', () => podeGerirMock.mockResolvedValue({ data: null, error: null })],
  ])('%s: nega e não grava', async (_n, prepara) => {
    prepara()
    expect(await enviarExtratoAction({}, fdEnvio())).toEqual({ error: MSG_PERM })
    expect(registrarMock).not.toHaveBeenCalled()
  })
})

describe('enviarExtratoAction — divergência no reenvio (D4)', () => {
  it('lista o código já gravado com valor diferente e ainda manda o envio (a RPC ignora a linha)', async () => {
    let primeiro = ''
    registrarMock.mockImplementation((args: { p_linhas: { codigo_transacao: string }[] }) => {
      primeiro = args.p_linhas[0].codigo_transacao
      return Promise.resolve({
        data: { envio_id: 'e', linhas: 5, novas: 0, existentes: 5, sem_centro_custo: 0, periodo_inicio: '2026-10-01', periodo_fim: '2026-10-01' },
        error: null,
      })
    })
    gravadasMock.mockImplementation(async (codigos: string[]) => ({
      data: [{ codigo_transacao: codigos[0], valor: 0.01 }], error: null,
    }))
    const r = await enviarExtratoAction({}, fdEnvio())
    expect(r.resultado?.divergentes).toHaveLength(1)
    expect(r.resultado?.divergentes[0]).toMatchObject({ codigo: primeiro, valorGravado: '0.01' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('falha ao conferir os já gravados: nada é enviado', async () => {
    gravadasMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await enviarExtratoAction({}, fdEnvio())).toEqual({ error: 'Não deu para conferir os códigos já gravados. Nada foi gravado.' })
    expect(registrarMock).not.toHaveBeenCalled()
  })
})

describe('enviarExtratoAction — envio', () => {
  it('Ticketlog: lê o .xlsx e manda as linhas, o saldo e o nome do arquivo numa chamada só', async () => {
    const r = await enviarExtratoAction({}, fdEnvio())
    expect(r).toEqual({
      resultado: { linhas: 5, novas: 3, existentes: 2, semCentroCusto: 1, periodo: { inicio: '2026-10-01', fim: '2026-10-01' }, saldo: '1234.56', divergentes: [] },
    })
    expect(registrarMock).toHaveBeenCalledTimes(1)
    const args = registrarMock.mock.calls[0][0]
    expect(args.p_plataforma).toBe('ticketlog')
    expect(args.p_arquivo).toBe('RFCV_262780_20261027.xlsx')
    expect(args.p_saldo).toBe('1234.56')
    expect(args.p_linhas).toHaveLength(5)
    expect(args.p_linhas[0]).toMatchObject({ codigo_transacao: '900000001', valor: '69.99', data_uso: '2026-10-01' })
    expect(JSON.stringify(args)).not.toMatch(/MOTORISTA/)
  })

  it('Veloe: lê o .csv', async () => {
    await enviarExtratoAction({}, fdEnvio({ plataforma: 'veloe', arquivo: new File([CSV], 'Extrato_veloe.csv') }))
    const args = registrarMock.mock.calls[0][0]
    expect(args.p_plataforma).toBe('veloe')
    expect(args.p_linhas).toHaveLength(6)
  })

  it.each([
    ['1234,56', '1234.56'],
    ['R$ 1.234,56', '1234.56'],
    ['0', '0.00'],
    ['1234.5', '1234.50'],
  ])('saldo "%s" -> %s', async (entrada, esperado) => {
    await enviarExtratoAction({}, fdEnvio({ saldo: entrada }))
    expect(registrarMock.mock.calls[0][0].p_saldo).toBe(esperado)
  })

  it.each(['', 'abc', '-10', '10,555', '1.234'])('saldo inválido "%s": não grava', async (saldo) => {
    const r = await enviarExtratoAction({}, fdEnvio({ saldo }))
    expect(r.error).toMatch(/saldo/i)
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('plataforma inválida', async () => {
    expect((await enviarExtratoAction({}, fdEnvio({ plataforma: 'outra' }))).error).toMatch(/plataforma/i)
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('sem arquivo / arquivo vazio', async () => {
    expect((await enviarExtratoAction({}, fdEnvio({ arquivo: null }))).error).toMatch(/arquivo/i)
    expect((await enviarExtratoAction({}, fdEnvio({ arquivo: new File([], 'a.xlsx') }))).error).toMatch(/arquivo/i)
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('arquivo da plataforma errada: mensagem da leitura, nada gravado', async () => {
    const r = await enviarExtratoAction({}, fdEnvio({ plataforma: 'veloe', arquivo: new File([XLSX], 'RFCV.xlsx') }))
    expect(r.error).toMatch(/Veloe/)
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('erro SOF01 do banco é mostrado; outro erro vira mensagem genérica', async () => {
    registrarMock.mockResolvedValueOnce({ data: null, error: { code: 'SOF01', message: 'O arquivo repete código de transação.' } })
    expect(await enviarExtratoAction({}, fdEnvio())).toEqual({ error: 'O arquivo repete código de transação.' })
    registrarMock.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'new row violates row-level security' } })
    expect(await enviarExtratoAction({}, fdEnvio())).toEqual({ error: 'Erro ao gravar o extrato. Nada foi gravado.' })
  })

  it('resposta do banco fora do formato esperado não vira sucesso', async () => {
    registrarMock.mockResolvedValueOnce({ data: null, error: null })
    expect((await enviarExtratoAction({}, fdEnvio())).error).toBeDefined()
  })
})

describe('criarLigacaoAction', () => {
  function fd(over: Record<string, string> = {}) {
    const f = new FormData()
    for (const [k, v] of Object.entries({ plataforma: 'ticketlog', identificador: ' 6000000000000001 ', equipe_id: EQUIPE, vigente_desde: '2026-08-01', ...over }))
      f.set(k, v)
    return f
  }

  it('grava a ligação (identificador aparado; autor vem do banco, não do formulário)', async () => {
    expect(await criarLigacaoAction({}, fd({ criado_por: 'forjado@x.com' }))).toEqual({ success: true })
    expect(fromMock).toHaveBeenCalledWith('sofia_extrato_ligacoes')
    expect(insertMock).toHaveBeenCalledWith({
      plataforma: 'ticketlog',
      identificador: '6000000000000001',
      equipe_id: EQUIPE,
      vigente_desde: '2026-08-01',
    })
  })

  it('quem não pode gerir: nega e não grava', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await criarLigacaoAction({}, fd())).toEqual({ error: MSG_PERM })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it.each([
    [{ plataforma: 'x' }, /plataforma/i],
    [{ identificador: '' }, /cartão|tag/i],
    [{ identificador: '6,03E+15' }, /cartão|tag/i],
    [{ equipe_id: 'abc' }, /equipe/i],
    [{ vigente_desde: '2026-02-30' }, /data/i],
    [{ vigente_desde: '' }, /data/i],
  ])('validação %p', async (over, msg) => {
    expect((await criarLigacaoAction({}, fd(over as Record<string, string>))).error).toMatch(msg)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('equipe inexistente (FK) e erro genérico', async () => {
    insertMock.mockResolvedValueOnce({ error: { code: '23503', message: 'fk' } })
    expect((await criarLigacaoAction({}, fd())).error).toMatch(/Equipe não encontrada/)
    insertMock.mockResolvedValueOnce({ error: { code: '42501', message: 'rls' } })
    expect((await criarLigacaoAction({}, fd())).error).toBe('Erro ao salvar a ligação')
  })
})

describe('encerrarLigacaoAction (D3)', () => {
  function fd(over: Record<string, string> = {}) {
    const f = new FormData()
    for (const [k, v] of Object.entries({ plataforma: 'ticketlog', identificador: ' 6000000000000001 ', encerrada_em: '2026-10-15', ...over }))
      f.set(k, v)
    return f
  }
  const lig = (equipe_id: string | null, vigente_desde: string, criado_em = '2026-08-01T10:00:00Z') => ({
    plataforma: 'ticketlog', identificador: '6000000000000001', equipe_id, vigente_desde, criado_em,
  })

  it('insere linha nova com equipe nula na data (nunca update)', async () => {
    ligacoesMock.mockResolvedValue({ data: [lig(EQUIPE, '2026-08-01')], error: null })
    expect(await encerrarLigacaoAction({}, fd())).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith({
      plataforma: 'ticketlog', identificador: '6000000000000001', equipe_id: null, vigente_desde: '2026-10-15',
    })
  })

  it.each([
    ['sem sessão', () => getUserMock.mockResolvedValue({ data: { user: null } })],
    ['não pode gerir', () => podeGerirMock.mockResolvedValue({ data: false, error: null })],
    ['permissão devolve null', () => podeGerirMock.mockResolvedValue({ data: null, error: null })],
  ])('%s: nega e não grava', async (_n, prepara) => {
    prepara()
    ligacoesMock.mockResolvedValue({ data: [lig(EQUIPE, '2026-08-01')], error: null })
    expect(await encerrarLigacaoAction({}, fd())).toEqual({ error: MSG_PERM })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it.each([
    ['plataforma inválida', { plataforma: 'x' }],
    ['sem identificador', { identificador: ' ' }],
    ['sem data', { encerrada_em: '' }],
    ['data inexistente', { encerrada_em: '2026-02-30' }],
  ])('%s: recusa e não grava', async (_n, over) => {
    ligacoesMock.mockResolvedValue({ data: [lig(EQUIPE, '2026-08-01')], error: null })
    expect((await encerrarLigacaoAction({}, fd(over))).error).toBeDefined()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('sem ligação vigente na data (nenhuma, ou só futura): recusa', async () => {
    expect((await encerrarLigacaoAction({}, fd())).error).toMatch(/Não há ligação vigente/)
    ligacoesMock.mockResolvedValue({ data: [lig(EQUIPE, '2026-11-01')], error: null })
    expect((await encerrarLigacaoAction({}, fd())).error).toMatch(/Não há ligação vigente/)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('já encerrada na data: recusa; religada depois, encerra de novo', async () => {
    ligacoesMock.mockResolvedValue({ data: [lig(EQUIPE, '2026-08-01'), lig(null, '2026-10-01')], error: null })
    expect((await encerrarLigacaoAction({}, fd())).error).toMatch(/já está encerrada/)
    expect(insertMock).not.toHaveBeenCalled()
    ligacoesMock.mockResolvedValue({
      data: [lig(EQUIPE, '2026-08-01'), lig(null, '2026-10-01'), lig(EQUIPE, '2026-10-10')],
      error: null,
    })
    expect(await encerrarLigacaoAction({}, fd())).toEqual({ success: true })
  })

  it('falha ao ler o histórico: não grava', async () => {
    ligacoesMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect((await encerrarLigacaoAction({}, fd())).error).toBeDefined()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('erro do banco no insert vira mensagem genérica', async () => {
    ligacoesMock.mockResolvedValue({ data: [lig(EQUIPE, '2026-08-01')], error: null })
    insertMock.mockResolvedValue({ error: { code: '42501', message: 'rls' } })
    expect(await encerrarLigacaoAction({}, fd())).toEqual({ error: 'Erro ao encerrar a ligação' })
  })
})

describe('novaVigenciaCentroCustoAction', () => {
  function fd(over: Record<string, string> = {}) {
    const f = new FormData()
    for (const [k, v] of Object.entries({ equipe_id: EQUIPE, codigo: ' 2.01.003 ', nome: ' Obra Teste ', vigente_desde: '2026-08-01', ...over }))
      f.set(k, v)
    return f
  }

  it('grava linha nova (histórico, nunca update)', async () => {
    expect(await novaVigenciaCentroCustoAction({}, fd())).toEqual({ success: true })
    expect(fromMock).toHaveBeenCalledWith('sofia_equipe_centro_custo')
    expect(insertMock).toHaveBeenCalledWith({ equipe_id: EQUIPE, codigo: '2.01.003', nome: 'Obra Teste', vigente_desde: '2026-08-01' })
  })

  it('quem não pode gerir: nega e não grava', async () => {
    podeGerirMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await novaVigenciaCentroCustoAction({}, fd())).toEqual({ error: MSG_PERM })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it.each([
    [{ codigo: '  ' }, /código/i],
    [{ nome: '' }, /nome/i],
    [{ vigente_desde: '28/10/2026' }, /data/i],
    [{ equipe_id: '' }, /equipe/i],
  ])('validação %p', async (over, msg) => {
    expect((await novaVigenciaCentroCustoAction({}, fd(over as Record<string, string>))).error).toMatch(msg)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
