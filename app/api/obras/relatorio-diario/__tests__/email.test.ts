/** @jest-environment node */
import {
  CID_IMAGEM,
  LINK_PAINEL,
  assuntoDoDia,
  escapar,
  formatarLidoEm,
  htmlDoEmail,
  montarDestinatarios,
  remetenteDe,
  textoAlternativo,
  textoDoEmail,
} from '../_email'

const painel = {
  hoje: '2026-10-08',
  kpis: {
    carteira: { valor: 1234567 },
    faturamentoMes: { valor: 0 },
    faturadoAno: { valor: 987654 },
    pendente: { valor: 4321 },
  },
}

describe('montarDestinatarios', () => {
  it('normaliza para minúsculas e trim, ignora vazios e deduplica', () => {
    const r = montarDestinatarios(
      [
        { user_email: '  Ana@Manfac.com.br ', has_access: true },
        { user_email: 'ana@manfac.com.br', has_access: true },
        { user_email: '', has_access: true },
        { user_email: '   ', has_access: true },
        { user_email: null, has_access: true },
      ],
      [{ user_email: 'BETO@manfac.com.br' }]
    )
    expect(r).toEqual(['ana@manfac.com.br', 'beto@manfac.com.br'])
  })

  it('só considera has_access === true estrito', () => {
    const r = montarDestinatarios(
      [
        { user_email: 'a@x.com', has_access: false },
        { user_email: 'b@x.com', has_access: null },
        { user_email: 'c@x.com', has_access: undefined },
        { user_email: 'd@x.com', has_access: 'true' as unknown as boolean },
        { user_email: 'e@x.com', has_access: 1 as unknown as boolean },
        { user_email: 'ok@x.com', has_access: true },
      ],
      []
    )
    expect(r).toEqual(['ok@x.com'])
  })

  it('admin que também tem o slug aparece uma vez, em ordem estável', () => {
    const r = montarDestinatarios(
      [
        { user_email: 'z@x.com', has_access: true },
        { user_email: 'adm@x.com', has_access: true },
      ],
      [{ user_email: 'ADM@x.com' }, { user_email: 'a@x.com' }]
    )
    expect(r).toEqual(['a@x.com', 'adm@x.com', 'z@x.com'])
  })

  it('entradas vazias dão lista vazia', () => {
    expect(montarDestinatarios([], [])).toEqual([])
  })
})

describe('remetenteDe', () => {
  it('usa o valor como está quando já traz nome', () => {
    expect(remetenteDe('"Manfac" <manfac@manfac.com.br>')).toBe('"Manfac" <manfac@manfac.com.br>')
  })
  it('acrescenta o nome Manfac quando só vem o endereço', () => {
    expect(remetenteDe(' manfac@manfac.com.br ')).toBe('"Manfac" <manfac@manfac.com.br>')
  })
})

describe('assunto e alt', () => {
  it('assunto com DD/MM/AAAA e travessão', () => {
    expect(assuntoDoDia('2026-10-08')).toBe('Gestão de Obras — Painel gerencial de 08/10/2026')
  })
  it('alt traz os 4 números formatados', () => {
    expect(textoAlternativo(painel)).toBe(
      'Painel gerencial de 08/10/2026 — Carteira R$ 1.234.567 · Faturamento do mês R$ 0 · Faturado no ano R$ 987.654 · Pendente faturamento R$ 4.321'
    )
  })
})

describe('formatarLidoEm', () => {
  it('converte para horário de Brasília', () => {
    expect(formatarLidoEm(new Date('2026-10-08T11:00:00Z'))).toBe('08/10/2026 às 08:00')
  })
})

describe('htmlDoEmail', () => {
  const alt = textoAlternativo(painel)
  const html = htmlDoEmail({ painel, lidoEm: '08/10/2026 às 08:01', alt })

  it('referencia a imagem por cid, com alt, e o link do painel', () => {
    expect(html).toContain(`src="cid:${CID_IMAGEM}"`)
    expect(html).toContain(`alt="${escapar(alt)}"`)
    expect(html).toContain(`href="${LINK_PAINEL}"`)
    expect(html).toContain('Abrir o Painel no hub')
    expect(html).toContain('Bom dia! Segue o Painel gerencial de hoje.')
  })
  it('traz os dois parágrafos do rodapé', () => {
    expect(html).toContain('Você recebe este e-mail porque tem acesso ao Gestão de Obras no hub Manfac.')
    expect(html).toContain('Dados lidos em 08/10/2026 às 08:01 (horário de Brasília).')
  })
  it('escapa texto dinâmico', () => {
    const h = htmlDoEmail({ painel, lidoEm: '<b>"x"</b>', alt: 'a "b" <c> & d' })
    expect(h).not.toContain('<b>"x"</b>')
    expect(h).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;')
    expect(h).toContain('alt="a &quot;b&quot; &lt;c&gt; &amp; d"')
  })
})

describe('escapar', () => {
  it('escapa & < > " e aspa simples', () => {
    expect(escapar(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('textoDoEmail', () => {
  it('traz os 4 números, o link e o rodapé', () => {
    const t = textoDoEmail({ painel, lidoEm: '08/10/2026 às 08:01' })
    expect(t).toBe(
      [
        'Bom dia! Segue o Painel gerencial de hoje.',
        '',
        'Carteira: R$ 1.234.567',
        'Faturamento do mês: R$ 0',
        'Faturado no ano: R$ 987.654',
        'Pendente faturamento: R$ 4.321',
        '',
        `Abrir o Painel no hub: ${LINK_PAINEL}`,
        '',
        'Você recebe este e-mail porque tem acesso ao Gestão de Obras no hub Manfac.',
        'Dados lidos em 08/10/2026 às 08:01 (horário de Brasília).',
      ].join('\n')
    )
  })
})
