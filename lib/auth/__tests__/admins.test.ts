import { isAdminEmail } from '../admins'

describe('isAdminEmail', () => {
  it('accepts an email in the admin list', () => {
    expect(isAdminEmail('ewerton.silva@manfac.com.br')).toBe(true)
  })

  it('accepts the owner exception email', () => {
    expect(isAdminEmail('jvictorco28@gmail.com')).toBe(true)
  })

  it('rejects an email not in the admin list', () => {
    expect(isAdminEmail('outro.usuario@manfac.com.br')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isAdminEmail('EWERTON.SILVA@MANFAC.COM.BR')).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    expect(isAdminEmail('  jose.guilherme@manfac.com.br  ')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isAdminEmail('')).toBe(false)
  })
})
