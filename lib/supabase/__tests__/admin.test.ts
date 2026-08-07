jest.mock('@supabase/supabase-js')

import { createAdminClient } from '../admin'
import * as supabaseJs from '@supabase/supabase-js'

const createClientMock = supabaseJs.createClient as jest.Mock

const ORIGINAL = process.env

describe('createAdminClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL }
    createClientMock.mockReturnValue({ marker: 'admin-client' })
  })
  afterAll(() => {
    process.env = ORIGINAL
  })

  it('throws a clear error when the service role key is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => createAdminClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY')
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('throws a clear error when the url is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave'
    expect(() => createAdminClient()).toThrow('SUPABASE_URL')
  })

  it('builds the client with session persistence disabled', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave'
    createAdminClient()
    expect(createClientMock).toHaveBeenCalledWith('https://x.supabase.co', 'chave', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  })
})
