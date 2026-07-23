const updateEqMock = jest.fn()
const getUserMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({
      update: jest.fn(() => ({ eq: updateEqMock })),
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { toggleEquipeAction } from '../_actions'

describe('toggleEquipeAction', () => {
  beforeEach(() => {
    updateEqMock.mockReset()
    updateEqMock.mockResolvedValue({ error: null })
    getUserMock.mockReset()
  })

  it('não atualiza quando o usuário não é admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'operador@manfac.com.br' } } })

    await toggleEquipeAction('equipe-1', true)

    expect(updateEqMock).not.toHaveBeenCalled()
  })
})
