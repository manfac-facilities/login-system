import {
  buildDirectWhatsAppUrl,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  WHATSAPP_COMERCIAL,
  type ContactFormData,
} from '../whatsapp'

const base: ContactFormData = {
  path: 'Obra ou reforma',
  nome: 'Maria Silva',
  empresa: 'Rede XYZ',
  email: 'maria@xyz.com.br',
  telefone: '(21) 99999-0000',
  localidade: 'RJ capital',
}

describe('buildWhatsAppMessage', () => {
  it('monta a mensagem com os campos obrigatórios na ordem', () => {
    expect(buildWhatsAppMessage(base)).toBe(
      [
        'Olá! Vim pelo site da Manfac.',
        'Tipo de demanda: Obra ou reforma',
        'Nome: Maria Silva',
        'Empresa: Rede XYZ',
        'E-mail: maria@xyz.com.br',
        'Telefone: (21) 99999-0000',
        'Localidade: RJ capital',
      ].join('\n')
    )
  })

  it('inclui cargo entre parênteses quando informado', () => {
    const msg = buildWhatsAppMessage({ ...base, cargo: 'Gerente de Facilities' })
    expect(msg).toContain('Nome: Maria Silva (Gerente de Facilities)')
  })

  it('inclui unidades apenas no caminho de manutenção recorrente', () => {
    const rec = buildWhatsAppMessage({ ...base, path: 'Manutenção recorrente', unidades: '51 a 200' })
    expect(rec).toContain('Unidades: 51 a 200')
    const spot = buildWhatsAppMessage({ ...base, unidades: '51 a 200' })
    expect(spot).not.toContain('Unidades:')
  })

  it('inclui resumo quando informado', () => {
    const msg = buildWhatsAppMessage({ ...base, resumo: 'rede com 30 lojas' })
    expect(msg).toContain('Resumo: rede com 30 lojas')
  })
})

describe('buildWhatsAppUrl', () => {
  it('gera URL wa.me com texto URL-encoded', () => {
    const url = buildWhatsAppUrl(base)
    expect(url.startsWith(`https://wa.me/${WHATSAPP_COMERCIAL}?text=`)).toBe(true)
    expect(url).toContain(encodeURIComponent('Olá! Vim pelo site da Manfac.'))
    expect(url).not.toContain('\n')
  })
})

describe('buildDirectWhatsAppUrl', () => {
  it('monta URL wa.me com o número comercial', () => {
    const url = buildDirectWhatsAppUrl('Home')
    expect(url.startsWith(`https://wa.me/${WHATSAPP_COMERCIAL}?text=`)).toBe(true)
  })

  it('cita a origem na mensagem', () => {
    const url = buildDirectWhatsAppUrl('Manutenção Predial')
    expect(decodeURIComponent(url)).toContain('Manutenção Predial')
  })

  it('URL-encoda a mensagem, sem espaço cru', () => {
    const url = buildDirectWhatsAppUrl('Obras e Reformas')
    expect(url).not.toContain(' ')
  })
})
