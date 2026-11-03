import { htmlLinkObra, linkDoLado, linkPortalObra, textoLinkObra } from '../link-portal'

describe('link da página do cliente', () => {
  it('monta a partir da base pública, sem barra dupla; sem base = sem link', () => {
    expect(linkPortalObra('https://hub.manfac.com.br/')).toBe('https://hub.manfac.com.br/portal-obra')
    expect(linkPortalObra('https://hub.manfac.com.br')).toBe('https://hub.manfac.com.br/portal-obra')
    expect(linkPortalObra(undefined)).toBe(linkPortalObra(process.env.NEXT_PUBLIC_SITE_URL))
    expect(linkPortalObra('')).toBeNull()
    expect(linkPortalObra('javascript:alert(1)')).toBeNull()
  })
  it('só o lado cliente recebe', () => {
    expect(linkDoLado('cliente', 'https://x.test/portal-obra')).toBe('https://x.test/portal-obra')
    expect(linkDoLado('interno', 'https://x.test/portal-obra')).toBeNull()
    expect(linkDoLado('cliente', null)).toBeNull()
  })
  it('sem link nada é acrescentado ao e-mail', () => {
    expect(htmlLinkObra(null)).toBe('')
    expect(textoLinkObra(undefined)).toEqual([])
    expect(htmlLinkObra('https://x.test/portal-obra')).toContain('Ver a obra completa')
    expect(htmlLinkObra('https://x.test/a"b')).not.toContain('a"b')
  })
})
