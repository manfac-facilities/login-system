/**
 * Testes da faixa "Novidade" (`_ui/faixa-comunicados.tsx`). As Server Actions
 * são mockadas — o que se testa aqui é o comportamento da tela.
 */

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const listarMock = jest.fn()
const marcarMock = jest.fn()

jest.mock('../../_comunicados-actions', () => ({
  listarComunicadosNaoLidos: (...a: unknown[]) => listarMock(...a),
  marcarComunicadoLido: (...a: unknown[]) => marcarMock(...a),
}))

import FaixaComunicados from '../faixa-comunicados'

const C1 = {
  id: 'c1',
  titulo: 'Equipe/prestador agora aceita texto livre',
  corpo: 'Já dá para digitar quem vai executar a obra.\nVale para o campo Equipe / prestador.\nExemplo: DP ITABORAI.',
  publicado_em: '2026-09-22T12:00:00Z',
}
const C2 = {
  id: 'c2',
  titulo: 'Data de fechamento da OS pode ser corrigida',
  corpo: 'Informe o dia real do fechamento.\nA correção fica no histórico.',
  publicado_em: '2026-09-21T12:00:00Z',
}

beforeEach(() => {
  listarMock.mockReset()
  marcarMock.mockReset()
})

it('sem comunicado não renderiza nada', async () => {
  listarMock.mockResolvedValue([])
  const { container } = render(<FaixaComunicados />)
  await act(async () => {})
  expect(listarMock).toHaveBeenCalled()
  expect(container).toBeEmptyDOMElement()
})

it('1 comunicado: mostra título e texto curto, e expande o detalhe', async () => {
  listarMock.mockResolvedValue([C1])
  render(<FaixaComunicados />)

  expect(await screen.findByText(C1.titulo)).toBeInTheDocument()
  expect(screen.getByText('novidade')).toBeInTheDocument()
  expect(screen.getByText('Já dá para digitar quem vai executar a obra.')).toBeInTheDocument()
  expect(screen.queryByText('Exemplo: DP ITABORAI.')).not.toBeInTheDocument()
  expect(screen.queryByText(/novidades?$/, { selector: 'button' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'ver o que mudou' }))
  expect(screen.getByText('Vale para o campo Equipe / prestador.')).toBeInTheDocument()
  expect(screen.getByText('Exemplo: DP ITABORAI.')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'ocultar o que mudou' }))
  expect(screen.queryByText('Exemplo: DP ITABORAI.')).not.toBeInTheDocument()
})

it('2 comunicados: chip "+1 novidade" abre o segundo', async () => {
  listarMock.mockResolvedValue([C1, C2])
  render(<FaixaComunicados />)

  await screen.findByText(C1.titulo)
  expect(screen.queryByText(C2.titulo)).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: '+1 novidade' }))
  expect(screen.getByText(C2.titulo)).toBeInTheDocument()
  expect(screen.getByText('Informe o dia real do fechamento.')).toBeInTheDocument()
})

it('3 comunicados: chip no plural', async () => {
  listarMock.mockResolvedValue([C1, C2, { ...C2, id: 'c3', titulo: 'Terceiro' }])
  render(<FaixaComunicados />)
  expect(await screen.findByRole('button', { name: '+2 novidades' })).toBeInTheDocument()
})

it('"Entendi" com sucesso marca todos e esconde a faixa', async () => {
  listarMock.mockResolvedValue([C1, C2])
  marcarMock.mockResolvedValue({ ok: true })
  const { container } = render(<FaixaComunicados />)

  await screen.findByText(C1.titulo)
  await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))

  expect(marcarMock).toHaveBeenCalledWith('c1')
  expect(marcarMock).toHaveBeenCalledWith('c2')
  expect(container).toBeEmptyDOMElement()
})

it('"Entendi" com falha mantém a faixa e mostra o aviso', async () => {
  listarMock.mockResolvedValue([C1, C2])
  marcarMock.mockImplementation(async (id: string) => ({ ok: id !== 'c2' }))
  render(<FaixaComunicados />)

  await screen.findByText(C1.titulo)
  await userEvent.click(screen.getByRole('button', { name: 'Entendi' }))

  expect(screen.getByText(C1.titulo)).toBeInTheDocument()
  expect(screen.getByText(/Não deu para salvar sua confirmação agora/)).toBeInTheDocument()
})

it('corpo com <b> aparece como texto literal', async () => {
  listarMock.mockResolvedValue([{ ...C1, corpo: 'Linha com <b>negrito</b>\nDetalhe <b>x</b>' }])
  const { container } = render(<FaixaComunicados />)

  expect(await screen.findByText('Linha com <b>negrito</b>')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'ver o que mudou' }))
  expect(screen.getByText('Detalhe <b>x</b>')).toBeInTheDocument()
  expect(container.querySelector('b')).toBeNull()
})
