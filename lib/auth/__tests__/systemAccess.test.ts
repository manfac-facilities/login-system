import { hasSystemAccess } from '../systemAccess'

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
  it('returns true for an admin without querying the table', async () => {
    const supabase = fakeSupabase(null)
    const result = await hasSystemAccess(supabase, 'jvictorco28@gmail.com', 'conversor-os')
    expect(result).toBe(true)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns true for a non-admin with has_access = true', async () => {
    const supabase = fakeSupabase({ has_access: true })
    const result = await hasSystemAccess(supabase, 'usuario@manfac.com.br', 'conversor-os')
    expect(result).toBe(true)
  })

  it('returns false for a non-admin with has_access = false', async () => {
    const supabase = fakeSupabase({ has_access: false })
    const result = await hasSystemAccess(supabase, 'usuario@manfac.com.br', 'conversor-os')
    expect(result).toBe(false)
  })

  it('returns false for a non-admin with no row at all', async () => {
    const supabase = fakeSupabase(null)
    const result = await hasSystemAccess(supabase, 'usuario@manfac.com.br', 'conversor-os')
    expect(result).toBe(false)
  })
})
