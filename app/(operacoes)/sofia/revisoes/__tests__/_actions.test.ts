const insertMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => ({ insert: insertMock })),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import { criarRevisaoAction } from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    veiculo_id: 'veiculo-1',
    tipo: 'preventiva',
    fornecedor: '',
    observacoes: '',
    pecas_trocadas: '',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('criarRevisaoAction: peças trocadas', () => {
  beforeEach(() => {
    insertMock.mockReset()
    insertMock.mockResolvedValue({ error: null })
  })

  it('grava o texto das peças, sem espaços nas pontas', async () => {
    const result = await criarRevisaoAction({}, buildFormData({ pecas_trocadas: '  Óleo 5W30\nFiltro de óleo  ' }))

    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ pecas_trocadas: 'Óleo 5W30\nFiltro de óleo' }))
  })

  it('campo vazio ou só espaços grava null', async () => {
    await criarRevisaoAction({}, buildFormData({ pecas_trocadas: '   ' }))

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ pecas_trocadas: null }))
  })
})
