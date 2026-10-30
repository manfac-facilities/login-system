import { fireEvent, render, screen, within } from '@testing-library/react'
import TelaCronograma from '../_tela'
import type { DadosCronograma, LinhaAtividade, LinhaEtapa } from '../_tipos'

const refresh = jest.fn()
const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
const definirInicioAction = jest.fn()
const definirFimAction = jest.fn()
jest.mock('../_actions', () => ({
  criarRevisaoAction: jest.fn(),
  definirFimAction: (...a: unknown[]) => definirFimAction(...a),
  definirInicioAction: (...a: unknown[]) => definirInicioAction(...a),
  salvarLinhaRascunhoAction: jest.fn(),
  salvarVersaoAction: jest.fn(),
}))

const ativ = (over: Partial<LinhaAtividade>): LinhaAtividade => ({
  numero: 1, etapa: 'Demolição', descricao: 'Demolições', pred1: null, pred2: null, duracao: 2,
  bloqueiaPorTrava: false, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
  inicioPrevisto: '2026-10-29', fimPrevisto: '2026-10-30', inicioProjetado: '2026-10-29', fimProjetado: '2026-10-30',
  percentualPrevisto: 0, situacao: 'no_prazo', travada: false, inicioFixo: null, diasRestantes: null,
  alertaInicioFixo: null, inicioFixoAjustado: false, inicioBase: '2026-10-29', fimBase: '2026-10-30', delta: 0, ...over,
})

const etapa = (over: Partial<LinhaEtapa>): LinhaEtapa => ({
  chave: 'Demolição', nome: 'Demolição', cor: '#00345e', inicio: '2026-10-29', fim: '2026-10-30', diasUteis: 2,
  percentual: 0, inicioProjetado: '2026-10-29', fimProjetado: '2026-10-30', inicioBase: '2026-10-29',
  fimBase: '2026-10-30', delta: 0, situacao: 'no_prazo', status: 'nao_iniciado', numeros: [1], ...over,
})

const dados = (over: Partial<DadosCronograma> = {}): DadosCronograma => ({
  obraId: 'o1',
  versao: { id: 'v1', numero: 1, salva: false },
  versoes: [{ numero: 1, rotulo: 'Base v1 · rascunho' }],
  podeEditar: true,
  editavel: true,
  rascunho: { id: 'v1', numero: 1 },
  temVigente: false,
  temBase: true,
  etapas: [
    etapa({ numeros: [1, 2] }),
    etapa({ chave: 'Pintura', nome: 'Pintura', cor: '#f85e0b', numeros: [3], delta: 5, fimProjetado: '2026-11-09' }),
  ],
  atividades: [
    ativ({ numero: 1, descricao: 'Demolições' }),
    ativ({ numero: 2, descricao: 'Retirada de entulho' }),
    ativ({ numero: 3, etapa: 'Pintura', descricao: 'Pintura geral', delta: 5, fimProjetado: '2026-11-09', situacao: 'atrasada' }),
  ],
  feriados: ['2026-11-02'],
  hoje: '2026-10-29',
  termino: { base: '2026-11-02', previsto: '2026-11-02', projetado: '2026-11-09' },
  statusAtividades: [],
  atividadeTrava: null,
  valores: null,
  ...over,
})

/** No rascunho a tela abre na Tabela; a árvore é a da visão Gantt. */
const abrirGantt = () => fireEvent.click(screen.getByRole('button', { name: 'Gantt' }))

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
})

describe('árvore do cronograma', () => {
  it('recolher a etapa esconde as atividades dela (e lembra no localStorage)', () => {
    render(<TelaCronograma dados={dados()} />)
    abrirGantt()
    const arvore = screen.getByRole('table')
    expect(within(arvore).getByText('Retirada de entulho')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Recolher etapa Demolição' }))
    expect(within(arvore).queryByText('Demolições')).toBeNull()
    expect(within(arvore).queryByText('Retirada de entulho')).toBeNull()
    expect(within(arvore).getByText('Pintura geral')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expandir etapa Demolição' })).toHaveAttribute('aria-expanded', 'false')
    expect(JSON.parse(window.localStorage.getItem('obras:crono:aberto:o1')!)).toEqual(['Demolição'])

    fireEvent.click(screen.getByRole('button', { name: 'Expandir tudo' }))
    expect(within(arvore).getByText('Demolições')).toBeInTheDocument()
  })

  it('Recolher tudo deixa só as linhas de etapa; estado salvo é lido ao abrir', () => {
    window.localStorage.setItem('obras:crono:aberto:o1', JSON.stringify(['Pintura']))
    render(<TelaCronograma dados={dados()} />)
    abrirGantt()
    const arvore = screen.getByRole('table')
    expect(within(arvore).queryByText('Pintura geral')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Recolher tudo' }))
    expect(within(arvore).queryByText('Demolições')).toBeNull()
  })

  it('Δ "+5" aparece com a classe de atraso', () => {
    render(<TelaCronograma dados={dados()} />)
    abrirGantt()
    const linha = within(screen.getByRole('table')).getByText('Pintura geral').closest('tr')!
    const delta = within(linha).getByText('+5')
    expect(delta).toHaveClass('delta-atraso')
  })

  it('em rascunho a célula Início edita e grava o início fixo', () => {
    definirInicioAction.mockResolvedValue({ ok: true })
    render(<TelaCronograma dados={dados()} />)
    abrirGantt()
    fireEvent.click(screen.getByRole('button', { name: 'Editar início da atividade 2' }))
    const campo = screen.getByLabelText('Editar início da atividade 2')
    fireEvent.change(campo, { target: { value: '2026-11-04' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(definirInicioAction).toHaveBeenCalledWith('o1', 'v1', 2, '2026-11-04')
  })

  it('sem base salva não há "Atualizar status"; mostra o aviso do diário', () => {
    render(<TelaCronograma dados={dados()} />)
    abrirGantt()
    expect(screen.queryByRole('button', { name: 'Atualizar status' })).toBeNull()
    expect(screen.getByText('Sem cronograma — o status começa quando a base for salva')).toBeTruthy()
  })

  it('com base salva o botão "Atualizar status" aparece', () => {
    render(<TelaCronograma dados={dados({ versao: { id: 'v1', numero: 1, salva: true }, editavel: false, rascunho: null, temVigente: true })} />)
    expect(screen.getByRole('button', { name: 'Atualizar status' })).toBeTruthy()
  })

  it('em versão salva a célula Início não é editável', () => {
    render(
      <TelaCronograma
        dados={dados({ versao: { id: 'v1', numero: 1, salva: true }, editavel: false, rascunho: null, temVigente: true })}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Editar início da atividade 1' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Editar / })).toBeNull()
    expect(within(screen.getByRole('table')).getAllByText('29/10').length).toBeGreaterThan(0)
  })
})
