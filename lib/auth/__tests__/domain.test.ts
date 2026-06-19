import { isManfacEmail, getFirstName } from '../domain'

describe('isManfacEmail', () => {
  it('accepts valid manfac email', () => {
    expect(isManfacEmail('joao@manfac.com.br')).toBe(true)
  })

  it('rejects non-manfac domain', () => {
    expect(isManfacEmail('joao@gmail.com')).toBe(false)
  })

  it('rejects subdomain that contains manfac.com.br', () => {
    expect(isManfacEmail('joao@sub.manfac.com.br')).toBe(false)
  })

  it('trims surrounding whitespace', () => {
    expect(isManfacEmail('  joao@manfac.com.br  ')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isManfacEmail('JOAO@MANFAC.COM.BR')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isManfacEmail('')).toBe(false)
  })

  it('rejects double-at email bypass', () => {
    expect(isManfacEmail('atacante@evil.com@manfac.com.br')).toBe(false)
  })

  it('allows the explicit owner exception email', () => {
    expect(isManfacEmail('jvictorco28@gmail.com')).toBe(true)
  })
})

describe('getFirstName', () => {
  it('extracts first word from full name', () => {
    expect(getFirstName('João Victor Costa')).toBe('João')
  })

  it('handles single-word name', () => {
    expect(getFirstName('João')).toBe('João')
  })

  it('trims leading and trailing whitespace', () => {
    expect(getFirstName('  João Victor  ')).toBe('João')
  })
})
