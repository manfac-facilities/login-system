import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ObraGrande } from '../_lib/leitura'

let caminho = '/obras/obras/o1'
jest.mock('next/navigation', () => ({ usePathname: () => caminho }))

import PilulaSituacao from '../_ui/pilula-situacao'
import ShellObra from '../_ui/shell'
import Kpi from '../_ui/kpi'
import AnelProgresso from '../_ui/anel-progresso'

const obra = {
  id: 'o1', os: '0526-1', loja: 'Macaé 3', cliente: 'DPSP', descricao: null, modalidade: 'obra',
} as unknown as ObraGrande['obra']
const versao = { id: 'v2', numero: 2, salvaEm: '2026-10-31T13:00:00Z', motivo: 'chuva' }

describe('PilulaSituacao', () => {
  it.each([
    ['concluida', undefined, 'Concluída'],
    ['no_prazo', 'em_andamento', 'Em andamento'],
    ['no_prazo', 'nao_iniciado', 'Não iniciada'],
    ['atrasada', undefined, 'Atrasada'],
    ['inicio_atrasado', undefined, 'Início atrasado'],
    ['aguardando_cliente', undefined, 'Aguardando cliente'],
    ['bloqueada', undefined, 'Travada'],
  ] as const)('%s/%s mostra o rótulo "%s" em texto', (situacao, status, rotulo) => {
    render(<PilulaSituacao situacao={situacao} status={status} />)
    expect(screen.getByText(rotulo)).toBeInTheDocument()
  })

  it('trava ativa vira "Travada", menos quando concluída', () => {
    const { rerender } = render(<PilulaSituacao situacao="no_prazo" status="nao_iniciado" travada />)
    expect(screen.getByText('Travada')).toBeInTheDocument()
    rerender(<PilulaSituacao situacao="concluida" travada />)
    expect(screen.getByText('Concluída')).toBeInTheDocument()
  })
})

describe('ShellObra', () => {
  beforeEach(() => {
    caminho = '/obras/obras/o1'
  })

  const montar = (estreito?: boolean) =>
    render(
      <ShellObra obra={obra} sinal="vermelho" dadosAte="2026-10-30" versao={versao} estreito={estreito}>
        <p>conteúdo da página</p>
      </ShellObra>,
    )

  it('renderiza "← Gestão de Obras" para /obras/base e os 5 itens de navegação', () => {
    montar()
    const voltar = screen.getAllByRole('link', { name: /Gestão de Obras/ })[0]
    expect(voltar).toHaveAttribute('href', '/obras/base')
    const lateral = screen.getByRole('navigation', { name: 'Seções da obra' })
    for (const item of ['Painel', 'Cronograma', 'Diário', 'Impedimentos', 'Comunicação']) {
      expect(within(lateral).getByRole('link', { name: item })).toBeInTheDocument()
    }
    expect(within(lateral).getByRole('link', { name: 'Painel' })).toHaveAttribute('href', '/obras/obras/o1')
    expect(screen.getByText('conteúdo da página')).toBeInTheDocument()
  })

  it('marca o item atual com aria-current e mostra os desabilitados "em breve"', () => {
    caminho = '/obras/obras/o1/cronograma'
    montar()
    const lateral = screen.getByRole('navigation', { name: 'Seções da obra' })
    expect(within(lateral).getByRole('link', { name: 'Cronograma' })).toHaveAttribute('aria-current', 'page')
    expect(within(lateral).getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current')
    expect(within(lateral).getByRole('link', { name: /Lookahead/ })).toBeTruthy()
    expect(within(lateral).queryByRole('link', { name: /Documentos/ })).toBeNull()
    expect(within(lateral).getAllByText('em breve')).toHaveLength(1)
  })

  it('cabeçalho: nome, OS · cliente, sinal em texto, dados até e versão vigente', () => {
    montar()
    expect(screen.getByRole('heading', { level: 1, name: 'Macaé 3' })).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('OS 0526-1 · DPSP')).toBeInTheDocument()
    expect(screen.getByText('Atrasado')).toBeInTheDocument()
    expect(screen.getByText('Dados até 30/10')).toBeInTheDocument()
    expect(screen.getByText('v2 · reprogramada em 31/10')).toBeInTheDocument()
  })

  it('estreito: sem sidebar, com o menu inferior e o "Mais" abrindo o resto', async () => {
    const { container } = montar(true)
    expect(container.querySelector('.menu-inferior')).not.toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Seções da obra' })).toBeNull()
    const inferior = screen.getByRole('navigation', { name: 'Seções da obra (menu inferior)' })
    for (const item of ['Painel', 'Cronograma', 'Diário', 'Impedimentos']) {
      expect(within(inferior).getByRole('link', { name: item })).toBeInTheDocument()
    }
    const mais = within(inferior).getByRole('button', { name: 'Mais' })
    expect(mais).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(mais)
    expect(mais).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Comunicação' })).toBeInTheDocument()
  })

  it('item Configurações só aparece para admin', () => {
    montar()
    const lateral = screen.getByRole('navigation', { name: 'Seções da obra' })
    expect(within(lateral).queryByRole('link', { name: 'Configurações' })).toBeNull()
  })

  it('admin vê Configurações apontando para /configuracoes', () => {
    render(
      <ShellObra obra={obra} sinal={null} dadosAte={null} versao={null} admin>
        <p>x</p>
      </ShellObra>,
    )
    const lateral = screen.getByRole('navigation', { name: 'Seções da obra' })
    expect(within(lateral).getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/obras/obras/o1/configuracoes')
  })

  it('sem versão salva e sem dados: textos neutros', () => {
    render(
      <ShellObra obra={obra} sinal={null} dadosAte={null} versao={null}>
        x
      </ShellObra>,
    )
    expect(screen.getByText('Sem cronograma')).toBeInTheDocument()
    expect(screen.getByText('Sem dados de campo ainda')).toBeInTheDocument()
    expect(screen.getByText('Base ainda não salva')).toBeInTheDocument()
  })
})

describe('Kpi e AnelProgresso', () => {
  it('Kpi mostra rótulo, valor e sub', () => {
    render(<Kpi rotulo="Avanço realizado" valor="42%" sub="previsto 50%" tom="negativo" />)
    expect(screen.getByText('Avanço realizado')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText('previsto 50%')).toBeInTheDocument()
  })

  it('AnelProgresso tem rótulo acessível com o % e limita 0–100', () => {
    const { rerender } = render(<AnelProgresso valor={0.426} />)
    expect(screen.getByRole('img', { name: '43% concluído' })).toBeInTheDocument()
    rerender(<AnelProgresso valor={1.4} />)
    expect(screen.getByRole('img', { name: '100% concluído' })).toBeInTheDocument()
  })
})
