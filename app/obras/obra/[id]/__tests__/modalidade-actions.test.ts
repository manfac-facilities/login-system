/**
 * `alterarModalidadeAction` — só administrador reclassifica SPOT <-> OBRA.
 * Supabase, `next/cache`, `systemAccess` e `roles` mockados; `historico.ts`
 * roda de verdade (a trava de `gravarComHistorico` prova que campo e linha batem).
 */

const getUserMock = jest.fn()
const rpcMock = jest.fn()

let obraAtual: Record<string, unknown> | null = null

const fromMock = jest.fn((tabela: string) => {
  if (tabela === 'obras_obra') {
    const alvo: Record<string, unknown> = {}
    alvo.select = jest.fn(() => alvo)
    alvo.eq = jest.fn(() => alvo)
    alvo.maybeSingle = jest.fn(async () => ({ data: obraAtual, error: null }))
    return alvo
  }
  throw new Error(`tabela inesperada no mock: ${tabela}`)
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import { revalidatePath } from 'next/cache'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { alterarModalidadeAction } from '../_actions'

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { email: 'jose@manfac.com.br' } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  ;(isAdmin as jest.Mock).mockResolvedValue(true)
  obraAtual = { id: 'o1', modalidade: 'spot' }
  rpcMock.mockResolvedValue({ data: { id: 'o1', modalidade: 'obra' }, error: null })
})

describe('alterarModalidadeAction', () => {
  it('não-admin: recusa sem tocar no banco', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    const r = await alterarModalidadeAction('o1', 'obra')
    expect(r).toEqual({ ok: false, erro: 'Só administrador reclassifica' })
    expect(fromMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('admin: grava modalidade e uma linha de histórico Classificação', async () => {
    const r = await alterarModalidadeAction('o1', 'obra')
    expect(r).toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [nome, args] = rpcMock.mock.calls[0]
    expect(nome).toBe('obras_aplicar_alteracao')
    expect(args.p_campos).toEqual({ modalidade: 'obra' })
    expect(args.p_linhas).toEqual([
      expect.objectContaining({ bloco: 'Classificação', campo: 'modalidade', de: 'spot', para: 'obra' }),
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/obras/base')
    expect(revalidatePath).toHaveBeenCalledWith('/obras/obras')
    expect(revalidatePath).toHaveBeenCalledWith('/obras/obra/o1')
  })

  it('valor fora de spot|obra: erro, sem banco', async () => {
    // @ts-expect-error valor inválido de propósito
    const r = await alterarModalidadeAction('o1', 'xyz')
    expect(r.ok).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('já está na modalidade pedida: ok sem gravar', async () => {
    obraAtual = { id: 'o1', modalidade: 'obra' }
    const r = await alterarModalidadeAction('o1', 'obra')
    expect(r).toEqual({ ok: true })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('sem sessão: falha fechada', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const r = await alterarModalidadeAction('o1', 'obra')
    expect(r.ok).toBe(false)
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
