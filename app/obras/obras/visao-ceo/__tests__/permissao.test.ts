import type { SupabaseClient } from '@supabase/supabase-js'

const isAdminMock = jest.fn()
jest.mock('@/lib/auth/roles', () => ({ isAdmin: (...a: unknown[]) => isAdminMock(...a) }))

import { podeVerVisaoCeo } from '../_permissao'

const cliente = (getUser: () => unknown) => ({ auth: { getUser } }) as unknown as SupabaseClient

beforeEach(() => isAdminMock.mockReset())

describe('podeVerVisaoCeo (falha fechada)', () => {
  it('admin → true', async () => {
    isAdminMock.mockResolvedValue(true)
    const sb = cliente(async () => ({ data: { user: { email: 'ceo@manfac.com.br' } }, error: null }))
    expect(await podeVerVisaoCeo(sb)).toBe(true)
    expect(isAdminMock).toHaveBeenCalledWith(sb, 'ceo@manfac.com.br')
  })

  it('não admin → false', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await podeVerVisaoCeo(cliente(async () => ({ data: { user: { email: 'eng@manfac.com.br' } }, error: null })))).toBe(false)
  })

  it('getUser sem usuário → false, sem perguntar isAdmin', async () => {
    expect(await podeVerVisaoCeo(cliente(async () => ({ data: { user: null }, error: null })))).toBe(false)
    expect(isAdminMock).not.toHaveBeenCalled()
  })

  it('getUser com erro → false', async () => {
    isAdminMock.mockResolvedValue(true)
    expect(await podeVerVisaoCeo(cliente(async () => ({ data: { user: { email: 'a@b.c' } }, error: { message: 'x' } })))).toBe(false)
  })

  it('getUser lança → false', async () => {
    expect(await podeVerVisaoCeo(cliente(async () => { throw new Error('rede') }))).toBe(false)
  })

  it('isAdmin lança → false', async () => {
    isAdminMock.mockRejectedValue(new Error('banco'))
    expect(await podeVerVisaoCeo(cliente(async () => ({ data: { user: { email: 'ceo@manfac.com.br' } }, error: null })))).toBe(false)
  })
})
