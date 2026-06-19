const insertMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      insert: insertMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { criarMultaAction } from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    veiculo_id: '',
    motorista_id: '',
    data: '2026-06-01',
    descricao: 'Excesso de velocidade',
    valor: '195.23',
    observacoes: '',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('criarMultaAction', () => {
  beforeEach(() => {
    insertMock.mockReset()
    insertMock.mockResolvedValue({ error: null })
  })

  it('accepts a multa with valor 0 instead of rejecting it as missing (falsy-zero regression)', async () => {
    const result = await criarMultaAction({}, buildFormData({ valor: '0' }))

    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ valor: 0 }))
  })

  it('still rejects when valor is left blank', async () => {
    const result = await criarMultaAction({}, buildFormData({ valor: '' }))

    expect(result.error).toBeTruthy()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('registers a normal multa with a non-zero valor', async () => {
    const result = await criarMultaAction({}, buildFormData())

    expect(result).toEqual({ success: true })
  })
})
