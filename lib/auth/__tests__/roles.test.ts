import { getNivel, isAdmin } from '../roles'

function fakeSupabase(row: { nivel: string } | null) {
  const eq = jest.fn().mockReturnThis()
  const client = {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq,
      maybeSingle: jest.fn().mockResolvedValue({ data: row }),
    })),
    _eq: eq,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return client
}

describe('getNivel', () => {
  it('returns administrador when the row says so', async () => {
    const result = await getNivel(fakeSupabase({ nivel: 'administrador' }), 'a@manfac.com.br')
    expect(result).toBe('administrador')
  })

  it('returns analista when the row says so', async () => {
    const result = await getNivel(fakeSupabase({ nivel: 'analista' }), 'a@manfac.com.br')
    expect(result).toBe('analista')
  })

  it('returns null when there is no row', async () => {
    const result = await getNivel(fakeSupabase(null), 'ninguem@manfac.com.br')
    expect(result).toBeNull()
  })

  it('returns null for an empty email without querying', async () => {
    const supabase = fakeSupabase({ nivel: 'administrador' })
    const result = await getNivel(supabase, '')
    expect(result).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('normalizes case and surrounding whitespace', async () => {
    const supabase = fakeSupabase({ nivel: 'administrador' })
    await getNivel(supabase, '  JOSE.GUILHERME@MANFAC.COM.BR  ')
    expect(supabase._eq).toHaveBeenCalledWith('user_email', 'jose.guilherme@manfac.com.br')
  })

  it('returns null for an unknown nivel value in the database', async () => {
    const result = await getNivel(fakeSupabase({ nivel: 'superusuario' }), 'a@manfac.com.br')
    expect(result).toBeNull()
  })
})

describe('isAdmin', () => {
  it('is true only for administrador', async () => {
    expect(await isAdmin(fakeSupabase({ nivel: 'administrador' }), 'a@manfac.com.br')).toBe(true)
    expect(await isAdmin(fakeSupabase({ nivel: 'analista' }), 'a@manfac.com.br')).toBe(false)
    expect(await isAdmin(fakeSupabase(null), 'a@manfac.com.br')).toBe(false)
  })
})
