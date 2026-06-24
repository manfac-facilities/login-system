const updateMock = jest.fn()
const eqMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      update: updateMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { atualizarTratativaSinistroAction } from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    id: 'sinistro-1',
    status: 'em_tratativa',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('atualizarTratativaSinistroAction', () => {
  beforeEach(() => {
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
    updateMock.mockReset()
    updateMock.mockReturnValue({ eq: eqMock })
  })

  it('updates only the case status, not the desconto fields', async () => {
    const result = await atualizarTratativaSinistroAction({}, buildFormData())

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ status: 'em_tratativa' })
  })
})
