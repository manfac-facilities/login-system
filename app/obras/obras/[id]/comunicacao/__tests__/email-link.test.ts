import { montarEmailAta, montarEmailImediata } from '../_email'

const LINK = 'https://hub.exemplo.test/portal-obra'
const imediata = { loja: 'DP Macaé 3', data: '2026-10-30', assunto: 'Falta de energia', texto: 'Sem energia', nivel: 'urgente' as const, vinculo: [], enviadoPor: 'eng@manfac.com.br' }
const ata = {
  loja: 'DP Macaé 3', data: '2026-10-29', participantes: null, texto: null,
  ata: { pauta: 'Andamento', decisoes: [], pendencias: [] }, enviadoPor: 'eng@manfac.com.br',
}

describe('"Ver a obra completa" nos e-mails da comunicação', () => {
  it('imediata: só na versão cliente', () => {
    const c = montarEmailImediata({ ...imediata, lado: 'cliente', linkObra: LINK })
    expect(c.html).toContain(`href="${LINK}"`)
    expect(c.html).toContain('Ver a obra completa')
    expect(c.texto).toContain(`Ver a obra completa: ${LINK}`)
    const i = montarEmailImediata({ ...imediata, lado: 'interno', linkObra: LINK })
    expect(i.html + i.texto).not.toContain('portal-obra')
    expect(i.html + i.texto).not.toContain('Ver a obra completa')
  })
  it('ata: com link quando passado; sem link a saída é idêntica à de antes', () => {
    const com = montarEmailAta({ ...ata, linkObra: LINK })
    expect(com.html).toContain(`href="${LINK}"`)
    expect(com.texto).toContain(LINK)
    const sem = montarEmailAta(ata)
    expect(sem.html).not.toContain('portal-obra')
    expect(montarEmailAta({ ...ata, linkObra: null })).toEqual(sem)
  })
})
