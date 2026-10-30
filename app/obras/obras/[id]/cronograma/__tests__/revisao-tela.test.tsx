/**
 * Bug da reunião de 31/10 (itens 3 e 4): "ao fazer uma revisão, não deu pra
 * alterar as datas". Nos logs do Supabase (30/10, 14:10–14:12) a tela estava
 * em `?v=1`; depois de "Nova revisão" ela seguiu lendo a v1 (salva, só
 * leitura) e o "Salvar revisão" — visível mesmo fora do rascunho — gravou a
 * v4 sem nenhuma alteração. Estes testes travam o comportamento corrigido.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import TelaCronograma from '../_tela'
import type { DadosCronograma, LinhaAtividade, LinhaEtapa } from '../_tipos'

const refresh = jest.fn()
const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
const criarRevisaoAction = jest.fn()
const definirInicioAction = jest.fn()
const salvarVersaoAction = jest.fn()
jest.mock('../_actions', () => ({
  criarRevisaoAction: (...a: unknown[]) => criarRevisaoAction(...a),
  definirFimAction: jest.fn(),
  definirInicioAction: (...a: unknown[]) => definirInicioAction(...a),
  salvarLinhaRascunhoAction: jest.fn(),
  salvarVersaoAction: (...a: unknown[]) => salvarVersaoAction(...a),
}))

const ativ: LinhaAtividade = {
  numero: 1, etapa: 'Demolição', descricao: 'Demolições', pred1: null, pred2: null, duracao: 2,
  bloqueiaPorTrava: false, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
  inicioPrevisto: '2026-10-29', fimPrevisto: '2026-10-30', inicioProjetado: '2026-10-29', fimProjetado: '2026-10-30',
  percentualPrevisto: 0, situacao: 'no_prazo', travada: false, inicioFixo: null, diasRestantes: null,
  alertaInicioFixo: null, inicioFixoAjustado: false, inicioBase: '2026-10-29', fimBase: '2026-10-30', delta: 0,
}
const etapa: LinhaEtapa = {
  chave: 'Demolição', nome: 'Demolição', cor: '#00345e', inicio: '2026-10-29', fim: '2026-10-30', diasUteis: 2,
  percentual: 0, inicioProjetado: '2026-10-29', fimProjetado: '2026-10-30', inicioBase: '2026-10-29',
  fimBase: '2026-10-30', delta: 0, situacao: 'no_prazo', status: 'nao_iniciado', numeros: [1],
}

const dados = (over: Partial<DadosCronograma>): DadosCronograma => ({
  obraId: 'o1',
  versao: { id: 'v1', numero: 1, salva: true },
  versoes: [{ numero: 1, rotulo: 'Base v1 · vigente' }],
  podeEditar: true,
  editavel: false,
  rascunho: null,
  temVigente: true,
  temBase: true,
  etapas: [etapa],
  atividades: [ativ],
  feriados: [],
  hoje: '2026-10-29',
  termino: { base: '2026-10-30', previsto: '2026-10-30', projetado: '2026-10-30' },
  statusAtividades: [],
  atividadeTrava: null,
  ...over,
})

/** v1 salva (vigente) e v2 em rascunho, como a OBRA TESTE logo após "Nova revisão". */
const comRascunho = (versao: DadosCronograma['versao']) =>
  dados({
    versao,
    versoes: [{ numero: 1, rotulo: 'Base v1 · vigente' }, { numero: 2, rotulo: 'v2 · rascunho' }],
    rascunho: { id: 'v2', numero: 2 },
    editavel: !versao.salva,
  })

beforeEach(() => {
  jest.clearAllMocks()
  window.localStorage.clear()
})

describe('revisão do cronograma: a tela vai para o rascunho e as datas gravam nele', () => {
  it('"Nova revisão" leva a tela para o rascunho criado (não fica na versão de ?v=)', async () => {
    criarRevisaoAction.mockResolvedValue({ ok: true, versaoId: 'v2', numero: 2 })
    render(<TelaCronograma dados={dados({})} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Nova revisão' }))
    })
    expect(criarRevisaoAction).toHaveBeenCalledWith('o1')
    expect(push).toHaveBeenCalledWith('?v=2')
  })

  it('vendo uma versão salva com rascunho aberto: sem "Salvar revisão", com atalho para o rascunho', () => {
    render(<TelaCronograma dados={comRascunho({ id: 'v1', numero: 1, salva: true })} />)
    expect(screen.queryByRole('button', { name: 'Salvar revisão' })).toBeNull()
    expect(screen.queryByLabelText('Motivo da revisão')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Editar / })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ir para o rascunho v2' }))
    expect(push).toHaveBeenCalledWith('?v=2')
  })

  it('no rascunho da revisão: aviso "Editando v2 (rascunho)" e a data grava na v2', () => {
    definirInicioAction.mockResolvedValue({ ok: true })
    render(<TelaCronograma dados={comRascunho({ id: 'v2', numero: 2, salva: false })} />)
    expect(screen.getByText(/Editando v2 \(rascunho\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar revisão' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar início da atividade 1' }))
    const campo = screen.getByLabelText('Editar início da atividade 1')
    fireEvent.change(campo, { target: { value: '2026-11-04' } })
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(definirInicioAction).toHaveBeenCalledWith('o1', 'v2', 1, '2026-11-04')
  })

  it('versão salva sem rascunho: diz que é só leitura e que datas mudam numa nova revisão', () => {
    render(<TelaCronograma dados={dados({})} />)
    expect(screen.getByText(/v1 é uma versão salva — só leitura/)).toBeInTheDocument()
    expect(screen.getByText(/Nova revisão/, { selector: 'p, p *' })).toBeInTheDocument()
  })
})
