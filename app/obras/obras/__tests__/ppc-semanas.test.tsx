import { renderToStaticMarkup } from 'react-dom/server'
import PpcSemanas from '../_ui/ppc-semanas'

describe('PpcSemanas', () => {
  it('sem semanas avaliadas mostra "—" e nenhum gráfico', () => {
    const html = renderToStaticMarkup(<PpcSemanas pontos={[]} />)
    expect(html).toContain('—')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('com semanas: barras, rótulos e texto acessível', () => {
    const html = renderToStaticMarkup(
      <PpcSemanas pontos={[{ semana: '2026-11-02', ppc: 0.5, avaliados: 4 }, { semana: '2026-11-09', ppc: 1, avaliados: 3 }]} />,
    )
    expect(html).toContain('PPC por semana. semana de 02/11: 50%; semana de 09/11: 100%')
    expect(html).toContain('<table')
  })
})
