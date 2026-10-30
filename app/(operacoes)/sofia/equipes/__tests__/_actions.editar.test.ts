let currentUserEmail: string | null = null
const rpcMock = jest.fn()
const podeGerirMock = jest.fn()
const fromMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: currentUserEmail ? { email: currentUserEmail } : null },
      })),
    },
    from: fromMock,
    rpc: jest.fn((fn: string, args?: unknown) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : rpcMock(fn, args)
    ),
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { revalidatePath } from 'next/cache'
import { editarEquipeAction } from '../_actions'

const MSG = 'Apenas administradores ou gestores de frotas podem executar esta ação'
function fd(fields: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}
const editarChamado = () => rpcMock.mock.calls.some(([fn]) => fn === 'editar_equipe_atomico')

beforeEach(() => {
  currentUserEmail = 'igor@manfac.com.br'
  rpcMock.mockReset()
  rpcMock.mockResolvedValue({ data: { codigo: 'MANFAC-05' }, error: null })
  podeGerirMock.mockReset()
  podeGerirMock.mockResolvedValue({ data: true, error: null })
  fromMock.mockClear()
  ;(revalidatePath as jest.Mock).mockClear()
})

describe('editarEquipeAction — permissão', () => {
  it('sem usuário: nega sem RPC', async () => {
    currentUserEmail = null
    expect(await editarEquipeAction({}, fd({ id: 'e1', codigo: 'X' }))).toEqual({ error: MSG })
    expect(editarChamado()).toBe(false)
  })
  it('sofia_pode_gerir false: nega sem RPC', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await editarEquipeAction({}, fd({ id: 'e1', codigo: 'X' }))).toEqual({ error: MSG })
    expect(editarChamado()).toBe(false)
  })
  it('sofia_pode_gerir com erro: nega', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: { message: 'x' } })
    expect(await editarEquipeAction({}, fd({ id: 'e1', codigo: 'X' }))).toEqual({ error: MSG })
    expect(editarChamado()).toBe(false)
  })
})

describe('editarEquipeAction — entrada e chamada', () => {
  it('código vazio: mensagem sem RPC', async () => {
    expect(await editarEquipeAction({}, fd({ id: 'e1', codigo: '   ' }))).toEqual({ error: 'Informe o código da equipe' })
    expect(editarChamado()).toBe(false)
  })
  it('código com espaços/minúsculas vai em maiúsculas; motorista vazio vira null', async () => {
    const r = await editarEquipeAction({}, fd({ id: 'e1', codigo: ' manfac-05 ', motorista_id: '' }))
    expect(rpcMock).toHaveBeenCalledWith('editar_equipe_atomico', {
      p_equipe_id: 'e1', p_codigo: 'MANFAC-05', p_motorista_id: null,
    })
    expect(r).toEqual({ success: true, codigo: 'MANFAC-05' })
    for (const p of ['/sofia/equipes', '/sofia/motoristas', '/sofia/disponibilidade', '/sofia/audit'])
      expect(revalidatePath).toHaveBeenCalledWith(p)
    expect(fromMock).not.toHaveBeenCalled() // nenhuma escrita direta em tabela
  })
  it('motorista repassado', async () => {
    await editarEquipeAction({}, fd({ id: 'e1', codigo: 'A', motorista_id: 'm2' }))
    expect(rpcMock).toHaveBeenCalledWith('editar_equipe_atomico', expect.objectContaining({ p_motorista_id: 'm2' }))
  })
  it('SOF01 repassado', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'SOF01', message: 'Já existe uma equipe com o código MANFAC-03.' } })
    expect(await editarEquipeAction({}, fd({ id: 'e1', codigo: 'manfac-03' }))).toEqual({
      error: 'Já existe uma equipe com o código MANFAC-03.',
    })
  })
  it('outro erro: genérico', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '40P01', message: 'deadlock detected' } })
    expect(await editarEquipeAction({}, fd({ id: 'e1', codigo: 'A' }))).toEqual({ error: 'Erro ao salvar a equipe' })
  })
})
