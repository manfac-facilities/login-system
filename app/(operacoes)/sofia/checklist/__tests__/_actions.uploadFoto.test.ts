// Minimal, file-scoped mock of the server Supabase client factory so we can
// simulate an insert failure (e.g. RLS denial, FK violation) without hitting
// a real database. Only the methods uploadFotoAction actually calls are
// implemented.
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

import { uploadFotoAction } from '../_actions'

describe('uploadFotoAction', () => {
  beforeEach(() => {
    insertMock.mockReset()
  })

  it('returns success: true when the insert succeeds', async () => {
    insertMock.mockResolvedValue({ error: null })

    const result = await uploadFotoAction('checklist-1', 'path/foto.jpg', 'Frente', null, null)

    expect(result).toEqual({ success: true })
  })

  it('surfaces an error instead of silently swallowing a failed insert (regression for bug #2)', async () => {
    insertMock.mockResolvedValue({ error: { message: 'RLS denied' } })

    const result = await uploadFotoAction('checklist-1', 'path/foto.jpg', 'Frente', null, null)

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    }
  })
})
