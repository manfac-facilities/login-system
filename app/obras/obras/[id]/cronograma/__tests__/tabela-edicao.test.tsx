/**
 * Visão Tabela (Leva 1b, itens 1, 2 e 15): padrão no rascunho, edição célula
 * a célula com Enter descendo, predecessora escolhida pelo código "1.2 –
 * descrição" e gravada pelo `numero`, estrutura (+ Etapa, renomear, ↑/↓,
 * + Atividade, excluir) chamando as actions da versão exibida.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import TelaCronograma from '../_tela'
import type { DadosCronograma, LinhaAtividade, LinhaEtapa } from '../_tipos'

const refresh = jest.fn()
const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
const m = {
  salvarLinhaRascunhoAction: jest.fn(),
  definirInicioAction: jest.fn(),
  definirFimAction: jest.fn(),
  adicionarEtapaAction: jest.fn(),
  renomearEtapaAction: jest.fn(),
  moverEtapaAction: jest.fn(),
  adicionarAtividadeAction: jest.fn(),
  moverAtividadeAction: jest.fn(),
  excluirAtividadeAction: jest.fn(),
}
jest.mock('../_actions', () => ({
  criarRevisaoAction: jest.fn(),
  salvarVersaoAction: jest.fn(),
  salvarLinhaRascunhoAction: (...a: unknown[]) => m.salvarLinhaRascunhoAction(...a),
  definirInicioAction: (...a: unknown[]) => m.definirInicioAction(...a),
  definirFimAction: (...a: unknown[]) => m.definirFimAction(...a),
  adicionarEtapaAction: (...a: unknown[]) => m.adicionarEtapaAction(...a),
  renomearEtapaAction: (...a: unknown[]) => m.renomearEtapaAction(...a),
  moverEtapaAction: (...a: unknown[]) => m.moverEtapaAction(...a),
  adicionarAtividadeAction: (...a: unknown[]) => m.adicionarAtividadeAction(...a),
  moverAtividadeAction: (...a: unknown[]) => m.moverAtividadeAction(...a),
  excluirAtividadeAction: (...a: unknown[]) => m.excluirAtividadeAction(...a),
}))

const ativ = (over: Partial<LinhaAtividade>): LinhaAtividade => ({
  numero: 1, etapa: 'Mobilização', descricao: 'Isolar área', pred1: null, pred2: null, duracao: 2,
  bloqueiaPorTrava: false, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
  inicioPrevisto: '2026-11-03', fimPrevisto: '2026-11-04', inicioProjetado: '2026-11-03', fimProjetado: '2026-11-04',
  percentualPrevisto: 0, situacao: 'no_prazo', travada: false, inicioFixo: null, diasRestantes: null,
  alertaInicioFixo: null, inicioFixoAjustado: false, inicioBase: null, fimBase: null, delta: null, ...over,
})
const etapa = (over: Partial<LinhaEtapa>): LinhaEtapa => ({
  chave: 'Mobilização', nome: 'Mobilização', cor: '#00345e', inicio: '2026-11-03', fim: '2026-11-04', diasUteis: 2,
  percentual: 0, inicioProjetado: '2026-11-03', fimProjetado: '2026-11-04', inicioBase: null, fimBase: null,
  delta: null, situacao: 'no_prazo', status: 'nao_iniciado', numeros: [1], ...over,
})

// Etapa "Estrutura" exibida antes de "Mobilização"; numeros fora de ordem (7 é a 1ª da Estrutura).
const dados = (over: Partial<DadosCronograma> = {}): DadosCronograma => ({
  obraId: 'o1',
  versao: { id: 'v1', numero: 1, salva: false },
  versoes: [{ numero: 1, rotulo: 'Base v1 · rascunho' }],
  podeEditar: true,
  editavel: true,
  rascunho: { id: 'v1', numero: 1 },
  temVigente: false,
  temBase: false,
  etapas: [
    etapa({ chave: 'Estrutura', nome: 'Estrutura', numeros: [7, 2] }),
    etapa({ numeros: [1] }),
  ],
  atividades: [
    ativ({ numero: 1, descricao: 'Isolar área' }),
    ativ({ numero: 2, etapa: 'Estrutura', descricao: 'Pilares', pred1: 7 }),
    ativ({ numero: 7, etapa: 'Estrutura', descricao: 'Pontos de acompanhamento', inicioFixo: '2026-11-05', inicioPrevisto: '2026-11-05' }),
  ],
  feriados: [],
  hoje: '2026-11-02',
  termino: { base: null, previsto: '2026-11-04', projetado: '2026-11-04' },
  statusAtividades: [],
  atividadeTrava: null,
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
  for (const f of Object.values(m)) f.mockResolvedValue({ ok: true })
})

const editar = async (rotulo: string, valor: string, tecla: 'Enter' | 'blur' = 'Enter') => {
  const campo = screen.getByLabelText(rotulo)
  fireEvent.change(campo, { target: { value: valor } })
  await act(async () => {
    if (tecla === 'Enter') fireEvent.keyDown(campo, { key: 'Enter' })
    else fireEvent.blur(campo)
  })
  return campo
}

describe('visão Tabela', () => {
  it('é o padrão no rascunho; numa versão salva o padrão é o Gantt', () => {
    const { unmount } = render(<TelaCronograma dados={dados()} />)
    expect(screen.getByRole('button', { name: 'Tabela' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Atividade 1.1')).toHaveValue('Pontos de acompanhamento')
    unmount()
    render(<TelaCronograma dados={dados({ versao: { id: 'v1', numero: 1, salva: true }, editavel: false, rascunho: null, temVigente: true })} />)
    expect(screen.getByRole('button', { name: 'Gantt' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))
    expect(screen.queryByLabelText('Atividade 1.1')).toBeNull()
    expect(screen.getByText('Pontos de acompanhamento')).toBeInTheDocument()
  })

  it('código etapa.posição segue a ordem exibida, não o numero', () => {
    render(<TelaCronograma dados={dados()} />)
    const linhas = screen.getAllByRole('row').map((r) => r.textContent)
    expect(linhas.findIndex((t) => t?.startsWith('1.2'))).toBeGreaterThan(linhas.findIndex((t) => t?.startsWith('1.1')))
    expect(screen.getByLabelText('Atividade 1.2')).toHaveValue('Pilares')
    expect(screen.getByLabelText('Atividade 2.1')).toHaveValue('Isolar área')
  })

  it('editar a descrição grava só ela, pelo numero, na versão exibida; Enter desce para a próxima linha', async () => {
    render(<TelaCronograma dados={dados()} />)
    await editar('Atividade 1.1', 'Marcar pontos')
    expect(m.salvarLinhaRascunhoAction).toHaveBeenCalledWith('o1', 'v1', { numero: 7, descricao: 'Marcar pontos' })
    expect(screen.getByLabelText('Atividade 1.2')).toHaveFocus()
    expect(refresh).toHaveBeenCalled()
  })

  it('sair do campo (Tab) também grava; sem mudança não chama nada', async () => {
    render(<TelaCronograma dados={dados()} />)
    await editar('Dias úteis da atividade 2.1', '5', 'blur')
    expect(m.salvarLinhaRascunhoAction).toHaveBeenCalledWith('o1', 'v1', { numero: 1, duracao: 5 })
    m.salvarLinhaRascunhoAction.mockClear()
    await act(async () => {
      fireEvent.blur(screen.getByLabelText('Atividade 2.1'))
    })
    expect(m.salvarLinhaRascunhoAction).not.toHaveBeenCalled()
  })

  it('erro do servidor aparece e a célula volta ao valor anterior', async () => {
    m.salvarLinhaRascunhoAction.mockResolvedValue({ ok: false, erro: 'Ciclo nas predecessoras: 7 → 2 → 7' })
    render(<TelaCronograma dados={dados()} />)
    const campo = await editar('Atividade 1.2', 'Outro nome')
    expect(screen.getByRole('alert')).toHaveTextContent('Ciclo nas predecessoras')
    expect(campo).toHaveValue('Pilares')
  })

  it('início, fim e "fixo ×" usam as actions de data', async () => {
    render(<TelaCronograma dados={dados()} />)
    await editar('Início da atividade 2.1', '2026-11-10')
    expect(m.definirInicioAction).toHaveBeenCalledWith('o1', 'v1', 1, '2026-11-10')
    await editar('Fim da atividade 2.1', '2026-11-12')
    expect(m.definirFimAction).toHaveBeenCalledWith('o1', 'v1', 1, '2026-11-12')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Atividade 1\.1: seguir predecessoras/ }))
    })
    expect(m.definirInicioAction).toHaveBeenCalledWith('o1', 'v1', 7, null)
  })

  it('predecessora: lista "código – descrição", grava o numero; sem a própria atividade', async () => {
    render(<TelaCronograma dados={dados()} />)
    const lista = screen.getByLabelText('Predecessora 1 da atividade 2.1')
    const opcoes = within(lista).getAllByRole('option').map((o) => o.textContent)
    expect(opcoes).toEqual(['—', '1.1 – Pontos de acompanhamento', '1.2 – Pilares'])
    expect(screen.getByLabelText('Predecessora 1 da atividade 1.2')).toHaveValue('7')
    await act(async () => {
      fireEvent.change(lista, { target: { value: '2' } })
    })
    expect(m.salvarLinhaRascunhoAction).toHaveBeenCalledWith('o1', 'v1', { numero: 1, pred1: 2 })
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Predecessora 1 da atividade 1.2'), { target: { value: '' } })
    })
    expect(m.salvarLinhaRascunhoAction).toHaveBeenCalledWith('o1', 'v1', { numero: 2, pred1: null })
  })

  it('mudar a etapa da atividade pela lista de etapas existentes', async () => {
    render(<TelaCronograma dados={dados()} />)
    const lista = screen.getByLabelText('Etapa da atividade 2.1')
    expect(within(lista).getAllByRole('option').map((o) => o.textContent)).toEqual(['Estrutura', 'Mobilização'])
    await act(async () => {
      fireEvent.change(lista, { target: { value: 'Estrutura' } })
    })
    expect(m.salvarLinhaRascunhoAction).toHaveBeenCalledWith('o1', 'v1', { numero: 1, etapa: 'Estrutura' })
  })

  it('estrutura: renomear, mover etapa, + Atividade (depois da última da etapa), ↑/↓ e excluir', async () => {
    render(<TelaCronograma dados={dados()} />)
    await editar('Nome da etapa 1', 'Estrutura metálica')
    expect(m.renomearEtapaAction).toHaveBeenCalledWith('o1', 'v1', 'Estrutura', 'Estrutura metálica')

    expect(screen.getByRole('button', { name: 'Subir etapa Estrutura' })).toBeDisabled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Descer etapa Estrutura' }))
    })
    expect(m.moverEtapaAction).toHaveBeenCalledWith('o1', 'v1', 'Estrutura', 'baixo')

    m.adicionarAtividadeAction.mockResolvedValue({ ok: true, numero: 8 })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar atividade na etapa Estrutura' }))
    })
    expect(m.adicionarAtividadeAction).toHaveBeenCalledWith('o1', 'v1', 'Estrutura', {
      descricao: 'Nova atividade', duracao: 1, pred1: 2, pred2: null,
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Subir atividade 1.2' }))
    })
    expect(m.moverAtividadeAction).toHaveBeenCalledWith('o1', 'v1', 2, 'cima')

    const confirmar = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Excluir atividade 1.2' }))
    expect(m.excluirAtividadeAction).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Excluir atividade 1.2' }))
    })
    expect(m.excluirAtividadeAction).toHaveBeenCalledWith('o1', 'v1', 2)
    confirmar.mockRestore()
  })

  it('cronograma vazio: "+ Etapa" cria a primeira etapa', async () => {
    m.adicionarEtapaAction.mockResolvedValue({ ok: true, numero: 1 })
    render(<TelaCronograma dados={dados({ etapas: [], atividades: [] })} />)
    expect(screen.getByText(/Cronograma vazio/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nome da nova etapa'), { target: { value: 'Mobilização' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+ Etapa' }))
    })
    expect(m.adicionarEtapaAction).toHaveBeenCalledWith('o1', 'v1', 'Mobilização')
    expect(screen.getByLabelText('Nome da nova etapa')).toHaveValue('')
  })
})
