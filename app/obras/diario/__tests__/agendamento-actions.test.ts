/**
 * Server Actions do agendamento ("Agendar e tirar do diário").
 * Spec §6.1-6.2. `_lib/historico.ts` roda de verdade (a trava de
 * `gravarComHistorico` é parte do que se prova aqui).
 */

const getUserMock = jest.fn()
const rpcMock = jest.fn()
let obraAtual: Record<string, unknown> | null = null
let erroLeitura: unknown = null
const fromMock = jest.fn((tabela: string) => {
  if (tabela !== 'obras_obra') throw new Error(`tabela inesperada: ${tabela}`)
  const alvo: Record<string, unknown> = {}
  alvo.select = jest.fn(() => alvo)
  alvo.eq = jest.fn(() => alvo)
  alvo.maybeSingle = jest.fn(async () => ({ data: obraAtual, error: erroLeitura }))
  return alvo
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock }, from: fromMock, rpc: rpcMock })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../_pessoa', () => ({ resolverChave: jest.fn() }))

import { revalidatePath } from 'next/cache'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { resolverChave } from '../_pessoa'
import { agendarDiarioAction, encerrarAgendamentoAction } from '../_actions'

const EMAIL = 'yuri.moreira@manfac.com.br'
// 15/10/2026, 10:00 em Brasília
const AGORA = new Date('2026-10-15T13:00:00Z')

const entrada = {
  obraId: 'o1',
  oque: 'Levantamento de material',
  motivo: 'Aguardando material',
  outro: '',
  ate: '2026-10-22',
}

function obra(over: Record<string, unknown> = {}) {
  return { id: 'o1', etapa: 'levantamento', pcm: 'YURI', diario_agendado_ate: null, ...over }
}

function ultimaRpc() {
  const [nome, args] = rpcMock.mock.calls[rpcMock.mock.calls.length - 1]
  expect(nome).toBe('obras_aplicar_alteracao')
  return args as { p_obra_id: string; p_campos: Record<string, unknown>; p_linhas: Record<string, unknown>[] }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(AGORA)
  getUserMock.mockResolvedValue({ data: { user: { email: EMAIL } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(resolverChave as jest.Mock).mockResolvedValue('YURI')
  rpcMock.mockResolvedValue({ data: { id: 'o1' }, error: null })
  obraAtual = obra()
  erroLeitura = null
})

afterEach(() => jest.useRealTimers())

describe('agendarDiarioAction', () => {
  it('recusa sem usuário e sem acesso, sem chamar a RPC', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await agendarDiarioAction(entrada)).toEqual({ error: 'Não autenticado' })
    getUserMock.mockResolvedValue({ data: { user: { email: EMAIL } } })
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect(await agendarDiarioAction(entrada)).toEqual({ error: 'Sem acesso à Gestão de Obras' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('validação falha: devolve a mensagem sem ler a obra nem chamar a RPC', async () => {
    expect(await agendarDiarioAction({ ...entrada, motivo: '' })).toEqual({ error: 'Escolha o motivo da parada.' })
    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('não-admin que não é o PCM da obra é recusado; chave vazia também (falha fechada)', async () => {
    const msg = 'Só o responsável pela obra ou o administrador pode agendar.'
    ;(resolverChave as jest.Mock).mockResolvedValue('ROBERTA')
    expect(await agendarDiarioAction(entrada)).toEqual({ error: msg })
    ;(resolverChave as jest.Mock).mockResolvedValue('')
    obraAtual = obra({ pcm: null })
    expect(await agendarDiarioAction(entrada)).toEqual({ error: msg })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('PCM agenda: 5 colunas, linha de histórico e revalidação', async () => {
    expect(await agendarDiarioAction(entrada)).toEqual({ success: true })
    const { p_obra_id, p_campos, p_linhas } = ultimaRpc()
    expect(p_obra_id).toBe('o1')
    expect(Object.keys(p_campos).sort()).toEqual([
      'diario_agendado_ate',
      'diario_agendado_em',
      'diario_agendado_motivo',
      'diario_agendado_oque',
      'diario_agendado_por',
    ])
    expect(p_campos).toMatchObject({
      diario_agendado_ate: '2026-10-22',
      diario_agendado_oque: 'Levantamento de material',
      diario_agendado_motivo: 'Aguardando material',
      diario_agendado_por: EMAIL,
      diario_agendado_em: AGORA.toISOString(),
    })
    expect(p_linhas).toEqual([
      {
        bloco: 'Agendamento',
        campo: 'diario_agendado_ate',
        de: null,
        para: '22/10/2026',
        motivo: 'Levantamento de material — Aguardando material',
      },
    ])
    for (const p of ['/obras/diario', '/obras/tarefas', '/obras/painel', '/obras/obra/o1']) {
      expect(revalidatePath).toHaveBeenCalledWith(p)
    }
  })

  it('admin agenda obra de outro PCM', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    ;(resolverChave as jest.Mock).mockResolvedValue('')
    obraAtual = obra({ pcm: 'ROBERTA' })
    expect(await agendarDiarioAction(entrada)).toEqual({ success: true })
  })

  it('"Outro" grava "Outro: <texto>"', async () => {
    await agendarDiarioAction({ ...entrada, motivo: 'Outro', outro: 'loja fechada' })
    expect(ultimaRpc().p_campos.diario_agendado_motivo).toBe('Outro: loja fechada')
  })

  it('etapa fora do diário é recusada', async () => {
    obraAtual = obra({ etapa: 'relatorio' })
    expect(await agendarDiarioAction(entrada)).toEqual({ error: 'Só obra que está no diário pode ser agendada.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('já agendada e fora do diário é recusada; vencida pode ser sobrescrita', async () => {
    obraAtual = obra({ diario_agendado_ate: '2026-10-20' })
    expect(await agendarDiarioAction(entrada)).toEqual({
      error: 'Esta obra já está agendada até 20/10. Recarregue a página.',
    })
    expect(rpcMock).not.toHaveBeenCalled()

    obraAtual = obra({ diario_agendado_ate: '2026-10-15' })
    expect(await agendarDiarioAction(entrada)).toEqual({ success: true })
    expect(ultimaRpc().p_linhas[0]).toMatchObject({ de: '15/10/2026', para: '22/10/2026' })
  })

  it('erro da RPC devolve o texto do mockup e não revalida', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    const r = await agendarDiarioAction(entrada)
    expect(r.error).toMatch(/^A conexão falhou na hora de salvar\. Nada mudou/)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('o hoje da validação e o "em" gravado saem do mesmo instante (15/10 23:59:59 em Brasília)', async () => {
    jest.setSystemTime(new Date('2026-10-16T02:59:59Z'))
    expect(await agendarDiarioAction({ ...entrada, ate: '2026-11-14' })).toEqual({ success: true })
    const em = String(ultimaRpc().p_campos.diario_agendado_em)
    expect(new Date(em).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })).toBe('2026-10-15')
  })
})

describe('encerrarAgendamentoAction', () => {
  it('"volta" em obra agendada: limpa as 5 colunas e grava a linha', async () => {
    obraAtual = obra({ diario_agendado_ate: '2026-10-22' })
    expect(await encerrarAgendamentoAction('o1', 'volta')).toEqual({ success: true })
    const { p_campos, p_linhas } = ultimaRpc()
    expect(p_campos).toEqual({
      diario_agendado_ate: null,
      diario_agendado_oque: null,
      diario_agendado_motivo: null,
      diario_agendado_por: null,
      diario_agendado_em: null,
    })
    expect(p_linhas).toEqual([
      {
        bloco: 'Agendamento',
        campo: 'diario_agendado_ate',
        de: '22/10/2026',
        para: null,
        motivo: 'Trazido de volta ao diário',
      },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/obras/obra/o1')
  })

  it('"feito" no próprio dia', async () => {
    obraAtual = obra({ diario_agendado_ate: '2026-10-15' })
    expect(await encerrarAgendamentoAction('o1', 'feito')).toEqual({ success: true })
    expect(ultimaRpc().p_linhas[0]).toMatchObject({ de: '15/10/2026', para: null, motivo: 'Marcado como feito' })
  })

  it('estados incompatíveis são recusados', async () => {
    obraAtual = obra({ diario_agendado_ate: '2026-10-22' })
    expect(await encerrarAgendamentoAction('o1', 'feito')).toEqual({
      error: 'O agendamento ainda não chegou na data. Use "Trazer de volta agora" no diário.',
    })
    obraAtual = obra({ diario_agendado_ate: '2026-10-14' })
    expect(await encerrarAgendamentoAction('o1', 'volta')).toEqual({
      error: 'Esta obra já voltou ao diário. Recarregue a página.',
    })
    obraAtual = obra()
    expect(await encerrarAgendamentoAction('o1', 'volta')).toEqual({
      error: 'Esta obra não está agendada. Recarregue a página.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('mesma regra de permissão', async () => {
    obraAtual = obra({ diario_agendado_ate: '2026-10-22' })
    ;(resolverChave as jest.Mock).mockResolvedValue('ROBERTA')
    expect((await encerrarAgendamentoAction('o1', 'volta')).error).toMatch(/^Só o responsável/)
    ;(resolverChave as jest.Mock).mockResolvedValue('')
    obraAtual = obra({ pcm: null, diario_agendado_ate: '2026-10-22' })
    expect((await encerrarAgendamentoAction('o1', 'volta')).error).toMatch(/^Só o responsável/)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('erro da RPC', async () => {
    obraAtual = obra({ diario_agendado_ate: '2026-10-22' })
    rpcMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await encerrarAgendamentoAction('o1', 'volta')).toEqual({
      error: 'Não deu para salvar. Nada mudou — tente de novo.',
    })
  })
})
