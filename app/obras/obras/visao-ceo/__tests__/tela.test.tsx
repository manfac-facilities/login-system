import { fireEvent, render, screen, within } from '@testing-library/react'
import type { DinheiroCarteira, ObraCarteira, SinalCliente } from '../../_lib/carteira'
import TelaVisaoCeo from '../_tela'

const dinheiroOk = (o: Partial<Extract<DinheiroCarteira, { ok: true }>> = {}): DinheiroCarteira =>
  ({ ok: true, valor: 100_000_00, faturado: 40_000_00, faturadoTotal: 40_000_00, faturadoPct: 40, aFaturar: 60_000_00, acimaDoValor: false, osSemValor: 0, notas: 2,custoRealizado: 10_000_00, custoComprometido: 5_000_00, margemPct: 12.5, ...o })

const sinaisOk: SinalCliente[] = [
  { chave: 'entrega', tom: 'ok', texto: 'entrega mantida em 14/11', curto: null },
  { chave: 'pendencias', tom: 'ok', texto: 'nenhuma pendência com o cliente', curto: null },
  { chave: 'mensagens', tom: 'ok', texto: 'mensagens respondidas', curto: null },
  { chave: 'semanal', tom: 'ok', texto: 'nenhum relatório semanal enviado ainda', curto: null },
]

const obra = (o: Partial<ObraCarteira>): ObraCarteira => ({
  id: 'x', os: null, loja: 'L', engenheiro: null, sinal: 'verde', estado: { tipo: 'andando', comAtraso: false },
  realizado: 0.5, previsto: 0.5, terminoBase: '2026-11-14', terminoProjetado: '2026-11-14', desvioDiasUteis: 0,
  travas: [], travaPrincipal: null, sinais: sinaisOk, etapas: [], semana: null, diarios: [], dinheiro: dinheiroOk(), ...o,
})

const travaCliente = {
  origem: 'restricao' as const, descricao: 'Aprovação do projeto luminotécnico', tipo: 'projeto', quem: 'cliente' as const,
  desde: '2026-10-20', prazo: '2026-10-29', vencida: true,
}

const verde = obra({ id: 'g', os: '4701', loja: 'Barra', engenheiro: 'ana@manfac.com.br' })
const vermelha = obra({
  id: 'r', os: '4812', loja: 'Macaé 3', engenheiro: 'carlos@manfac.com.br', sinal: 'vermelho',
  estado: { tipo: 'parada', diasUteis: 6 }, realizado: 0.46, previsto: 0.61, terminoProjetado: '2026-12-09', terminoBase: '2026-11-28', desvioDiasUteis: 7,
  travas: [travaCliente], travaPrincipal: travaCliente,
  etapas: [{ nome: 'Forro e iluminação', realizado: 0.1, previsto: 0.45, situacao: 'aguardando_cliente' }],
  semana: { corrente: true, planejadas: 9, cumpridas: 5, ppc: 0.52, causas: '3 por cliente', naoCumpridas: 3 },
  diarios: [{ data: '2026-11-03', texto: 'Equipe de 8. Elétrica do salão.' }],
})

const tela = (obras: ObraCarteira[]) =>
  render(<TelaVisaoCeo obras={obras} hoje="2026-11-04" lidoEm="2026-11-04T10:40:00.000Z" />)

const lista = () => screen.getByRole('region', { name: /Obras/ })

describe('Visão do CEO: tela', () => {
  it('a vermelha vem primeiro, mesmo recebida depois', () => {
    tela([verde, vermelha])
    const nomes = within(lista()).getAllByRole('button', { expanded: false }).map((b) => b.textContent)
    expect(nomes[0]).toMatch(/Macaé 3/)
    expect(nomes[1]).toMatch(/Barra/)
  })

  it('"Esperando o cliente" deixa só a obra com trava do cliente, com contagem', () => {
    tela([verde, vermelha])
    const filtro = screen.getByRole('button', { name: /Esperando o cliente/ })
    expect(filtro).toHaveTextContent('1')
    fireEvent.click(filtro)
    expect(filtro).toHaveAttribute('aria-pressed', 'true')
    expect(within(lista()).queryByText('Barra')).toBeNull()
    expect(within(lista()).getByText('Macaé 3')).toBeInTheDocument()
  })

  it('clicar no quadro "Quem está segurando" aplica o filtro', () => {
    tela([verde, vermelha])
    const quadro = screen.getByRole('region', { name: 'Quem está segurando as obras' })
    fireEvent.click(within(quadro).getByRole('button', { name: /Cliente/ }))
    expect(screen.getByRole('button', { name: /Esperando o cliente/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(lista()).queryByText('Barra')).toBeNull()
  })

  it('clicar na linha abre o detalhe com etapas, aviso de orçado e link da obra', () => {
    tela([verde, vermelha])
    const linha = within(lista()).getAllByRole('button', { expanded: false })[0]
    fireEvent.click(linha)
    expect(linha).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Andamento por etapa')).toBeInTheDocument()
    expect(screen.getByText('Forro e iluminação')).toBeInTheDocument()
    expect(screen.getByText('Orçado × realizado: ainda sem orçado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir a obra →' })).toHaveAttribute('href', '/obras/obras/r')
    expect(screen.getByText(/Plano com 9 atividades, 5 concluídas/)).toBeInTheDocument()
  })

  it('clicar numa exceção abre a obra e volta o filtro para "Todas"', () => {
    tela([verde, vermelha])
    fireEvent.click(screen.getByRole('button', { name: /^No prazo/ }))
    const atencao = screen.getByRole('region', { name: 'Precisa da sua atenção hoje' })
    fireEvent.click(within(atencao).getAllByRole('button')[0])
    expect(screen.getByRole('button', { name: /^Todas/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Andamento por etapa')).toBeInTheDocument()
  })

  it('sem permissão de valores: aviso, nunca "R$ 0"', () => {
    const semPerm: DinheiroCarteira = { ok: false, motivo: 'sem_permissao' }
    const { container } = tela([{ ...verde, dinheiro: semPerm }, { ...vermelha, dinheiro: semPerm }])
    expect(screen.getAllByText('Sem permissão para ver valores').length).toBeGreaterThan(0)
    fireEvent.click(within(lista()).getAllByRole('button', { expanded: false })[0])
    expect(container.textContent).not.toMatch(/R\$\s?0/)
    expect(screen.getAllByText(/2 obras fora das somas/).length).toBeGreaterThan(0)
  })

  it('leitura de valores falhou: "Não foi possível ler os valores"', () => {
    tela([{ ...verde, dinheiro: { ok: false, motivo: 'leitura' } }])
    expect(screen.getByText('Não foi possível ler os valores')).toBeInTheDocument()
  })

  it('sem exceções: "Nada pedindo sua atenção hoje."', () => {
    tela([verde])
    expect(screen.getByText('Nada pedindo sua atenção hoje.')).toBeInTheDocument()
  })

  it('obra faturando: pílula Concluída e quanto falta faturar', () => {
    tela([obra({ id: 'f', loja: 'Campos', estado: { tipo: 'faturando' }, dinheiro: dinheiroOk({ aFaturar: 25_000_00 }) })])
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText(/Execução concluída · faltam R\$\s25\.000,00 a faturar/)).toBeInTheDocument()
  })

  it('desvio: 0 → "mantida"; 7 → "+7 dias úteis"; 1 → "+1 dia útil"', () => {
    tela([verde, vermelha, obra({ id: 'u', loja: 'Niterói', sinal: 'amarelo', desvioDiasUteis: 1, terminoProjetado: '2026-11-17' })])
    expect(screen.getByText('mantida')).toBeInTheDocument()
    expect(screen.getByText('+7 dias úteis')).toBeInTheDocument()
    expect(screen.getByText('+1 dia útil')).toBeInTheDocument()
  })

  it('quadro do gasto: N de M obras ainda sem orçado', () => {
    tela([verde, vermelha])
    expect(screen.getByText('2 de 2 obras ainda sem orçado. A comparação aparece quando o orçado da obra existir.')).toBeInTheDocument()
  })

  it('faturamento: obra sem valor informado vira aviso e a barra não passa de 100%', () => {
    const { container } = tela([
      verde,
      { ...vermelha, dinheiro: dinheiroOk({ valor: null, aFaturar: null, faturado: 500_000_00 }) },
    ])
    const quadro = screen.getByRole('region', { name: 'Faturamento da carteira' })
    expect(within(quadro).getByText('1 obra sem valor informado')).toBeInTheDocument()
    expect(within(quadro).getByText('R$ 40.000,00')).toBeInTheDocument()
    const larguras = [...container.querySelectorAll<HTMLElement>('[style*="width"]')].map((e) => parseFloat(e.style.width))
    expect(Math.max(...larguras)).toBeLessThanOrEqual(100)
  })

  it('aria-controls só com a linha aberta (aponta para o detalhe existente)', () => {
    tela([verde])
    const linha = within(lista()).getByRole('button', { expanded: false })
    expect(linha).not.toHaveAttribute('aria-controls')
    fireEvent.click(linha)
    const id = linha.getAttribute('aria-controls')
    expect(id).toBe('obra-g')
    expect(document.getElementById(id!)).not.toBeNull()
  })

  it('semana: "Não cumprida" no singular; plano da semana anterior vira "Semana passada"', () => {
    tela([{ ...vermelha, semana: { corrente: false, planejadas: 2, cumpridas: 1, ppc: 0.5, causas: '1 por clima', naoCumpridas: 1 } }])
    fireEvent.click(within(lista()).getByRole('button', { expanded: false }))
    expect(screen.getByText('Semana passada')).toBeInTheDocument()
    expect(screen.queryByText('Esta semana')).toBeNull()
    expect(screen.getByText(/Não cumprida: 1 por clima\./)).toBeInTheDocument()
  })

  it('semana: "Não cumpridas" no plural', () => {
    tela([vermelha])
    fireEvent.click(within(lista()).getByRole('button', { expanded: false }))
    expect(screen.getByText('Esta semana')).toBeInTheDocument()
    expect(screen.getByText(/Não cumpridas: 3 por cliente\./)).toBeInTheDocument()
  })

  it('data base futura: "Começa em dd/mm"', () => {
    tela([obra({ id: 'n', estado: { tipo: 'comeca', em: '2026-11-10' } })])
    expect(screen.getByText('Começa em 10/11')).toBeInTheDocument()
  })

  it('valor incompleto: aviso na linha e no detalhe, % da aba, fora das somas', () => {
    tela([{ ...vermelha, dinheiro: dinheiroOk({ osSemValor: 1, faturadoPct: 40 }) }, obra({ id: 'b', loja: 'B', dinheiro: dinheiroOk({ osSemValor: 2 }) })])
    expect(screen.getByText('valor incompleto (1 OS sem valor)')).toBeInTheDocument()
    expect(screen.getByText('valor incompleto (2 OS sem valor)')).toBeInTheDocument()
    fireEvent.click(within(lista()).getAllByRole('button', { expanded: false })[0])
    expect(screen.getAllByText(/valor incompleto \(1 OS sem valor\)/)).toHaveLength(2)
    const quadro = screen.getByRole('region', { name: 'Faturamento da carteira' })
    expect(within(quadro).getByText('Nenhuma obra com valores disponíveis.')).toBeInTheDocument()
    expect(within(quadro).getByText('2 obras com valor incompleto')).toBeInTheDocument()
    expect(within(quadro).queryByText(/sem valor informado/)).toBeNull()
  })

  it('detalhe: R$ faturado é o total da aba (inclui OS sem valor)', () => {
    tela([{ ...vermelha, dinheiro: dinheiroOk({ osSemValor: 1, faturado: 40_000_00, faturadoTotal: 75_000_00 }) }])
    fireEvent.click(within(lista()).getAllByRole('button', { expanded: false })[0])
    expect(screen.getByText('R$ 75.000,00')).toBeInTheDocument()
  })

  it('faturamento: 2 obras sem valor → plural', () => {
    const sv = dinheiroOk({ valor: null, aFaturar: null })
    tela([{ ...verde, dinheiro: sv }, { ...vermelha, dinheiro: sv }])
    expect(within(screen.getByRole('region', { name: 'Faturamento da carteira' })).getByText('2 obras sem valor informado')).toBeInTheDocument()
  })
})
