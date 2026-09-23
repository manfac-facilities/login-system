/**
 * Testes das funções puras de `scripts/enviar-comunicado.mjs`. Nada aqui fala
 * com a Management API nem com a Resend.
 */

import { montarDestinatarios, renderizarHtml, renderizarTexto, montarEmail } from '../enviar-comunicado.mjs'

const COMUNICADO = {
  titulo: 'Equipe <nova> & "texto" livre',
  corpo: 'Primeira linha com <b>tag</b>\n\nSegunda & última\r\n',
}

describe('montarDestinatarios', () => {
  it('deixa em minúsculas, tira espaços, vazios e repetidos', () => {
    expect(
      montarDestinatarios([
        { user_email: 'Rafael.Souza@Manfac.com.br ' },
        { user_email: 'rafael.souza@manfac.com.br' },
        { user_email: 'admin@manfac.com.br' },
        { user_email: null },
        { user_email: '  ' },
      ]),
    ).toEqual(['rafael.souza@manfac.com.br', 'admin@manfac.com.br'])
  })
})

describe('renderizarHtml', () => {
  const html = renderizarHtml(COMUNICADO)

  it('escapa todo texto vindo do banco', () => {
    expect(html).toContain('<li>Primeira linha com &lt;b&gt;tag&lt;/b&gt;</li>')
    expect(html).toContain('<li>Segunda &amp; última</li>')
    expect(html).toContain('Equipe &lt;nova&gt; &amp; &quot;texto&quot; livre')
    expect(html).not.toContain('<b>tag</b>')
    expect(html).not.toContain('<nova>')
  })

  it('tem o botão para o Controle de Obras e uma linha por item', () => {
    expect(html).toContain('href="https://hub.manfac.com.br/obras"')
    expect(html).toContain('Abrir o Controle de Obras')
    expect(html.match(/<li>/g)).toHaveLength(2)
  })
})

describe('renderizarTexto', () => {
  it('lista as linhas e o link, sem HTML', () => {
    const texto = renderizarTexto(COMUNICADO)
    expect(texto).toContain('- Primeira linha com <b>tag</b>')
    expect(texto).toContain('- Segunda & última')
    expect(texto).toContain('https://hub.manfac.com.br/obras')
  })
})

describe('montarEmail', () => {
  it('um destinatário por e-mail, remetente e assunto fixos pela spec', () => {
    const email = montarEmail(COMUNICADO, 'a@manfac.com.br')
    expect(email).toEqual({
      from: 'Controle de Obras <avisos@manfac.com.br>',
      to: ['a@manfac.com.br'],
      subject: COMUNICADO.titulo,
      html: renderizarHtml(COMUNICADO),
      text: renderizarTexto(COMUNICADO),
    })
  })
})
