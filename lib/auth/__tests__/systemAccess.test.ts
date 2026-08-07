jest.mock('../roles', () => ({ isAdmin: jest.fn() }))

import { hasSystemAccess } from '../systemAccess'
import { isAdmin } from '../roles'

function fakeSupabase(row: { has_access: boolean } | null) {
  return {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: row }),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('hasSystemAccess', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true for an admin without querying the table', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    const supabase = fakeSupabase(null)
    expect(await hasSystemAccess(supabase, 'chefe@manfac.com.br', 'sofia')).toBe(true)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns true for a non-admin with has_access = true', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    expect(await hasSystemAccess(fakeSupabase({ has_access: true }), 'a@manfac.com.br', 'sofia')).toBe(true)
  })

  it('returns false for a non-admin with has_access = false', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    expect(await hasSystemAccess(fakeSupabase({ has_access: false }), 'a@manfac.com.br', 'sofia')).toBe(false)
  })

  it('returns false for a non-admin with no row at all', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    expect(await hasSystemAccess(fakeSupabase(null), 'a@manfac.com.br', 'sofia')).toBe(false)
  })
})
