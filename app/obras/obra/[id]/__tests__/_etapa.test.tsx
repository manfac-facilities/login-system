/**
 * Seletor de etapa com o campo "Data de fechamento da OS" (ajuste 2 de 23/09,
 * spec-ajustes-ficha-2026-09-23.md §5.1 e §5.5).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('../_actions', () => ({ mudarEtapaAction: jest.fn() }))

import { mudarEtapaAction } from '../_actions'
import SeletorEtapa from '../_etapa'

const REF = { relatorio: '2026-09-18', aprovacao: '2026-09-20' }
const montar = (etapa = 'fecharOS') =>
  render(
    <SeletorEtapa obraId="o1" etapa={etapa as never} hoje="2026-09-22" referenciaFechamento={REF} />
  )
const acao = mudarEtapaAction as jest.Mock
beforeEach(() => acao.mockReset())

test('Fechar OS → Pendente faturamento mostra a data, preenchida com hoje', async () => {
  const u = userEvent.setup()
  montar()
  expect(screen.queryByLabelText('Data de fechamento da OS')).not.toBeInTheDocument()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
  expect(screen.getByLabelText('Data de fechamento da OS')).toHaveValue('2026-09-22')
})

test('outras transições não mostram a data', async () => {
  const u = userEvent.setup()
  montar()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'faturado')
  expect(screen.queryByLabelText('Data de fechamento da OS')).not.toBeInTheDocument()
})

test('data futura e anterior à aprovação: erro inline e botão desabilitado', async () => {
  const u = userEvent.setup()
  montar()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d)
  await u.type(d, '2026-09-23')
  expect(screen.getByText('A data não pode ser posterior a hoje.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirmar mudança' })).toBeDisabled()
  await u.clear(d)
  await u.type(d, '2026-09-19')
  expect(
    screen.getByText('A data não pode ser anterior à aprovação da OS (20/09/2026).')
  ).toBeInTheDocument()
}, 20000)

test('confirma com a data escolhida e mostra o salvo com a data', async () => {
  acao.mockResolvedValue({ success: true })
  const u = userEvent.setup()
  montar()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d)
  await u.type(d, '2026-09-21')
  await u.click(screen.getByRole('button', { name: 'Confirmar mudança' }))
  expect(acao).toHaveBeenCalledWith('o1', 'pendFat', '2026-09-21')
  expect(await screen.findByText(/fechamento da OS gravado em/)).toHaveTextContent('21/09/2026')
}, 20000)

test('troca sem data chama a action só com dois argumentos', async () => {
  acao.mockResolvedValue({ success: true })
  const u = userEvent.setup()
  montar('andamento')
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'paralisado')
  await u.click(screen.getByRole('button', { name: 'Confirmar mudança' }))
  expect(acao.mock.calls[0]).toEqual(['o1', 'paralisado'])
})

test('erro com data: título do mockup, mensagem do servidor e "Tentar de novo" reenviando o mesmo', async () => {
  acao.mockResolvedValue({ error: 'A etapa mudou, mas houve erro ao atualizar os marcos da esteira' })
  const u = userEvent.setup()
  montar()
  await u.selectOptions(screen.getByLabelText('Mudar a etapa desta obra'), 'pendFat')
  await u.click(screen.getByRole('button', { name: 'Confirmar mudança' }))
  expect(await screen.findByText('Não concluiu "Fechar OS"')).toBeInTheDocument()
  expect(screen.getByText(/houve erro ao atualizar os marcos/)).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(acao).toHaveBeenLastCalledWith('o1', 'pendFat', '2026-09-22')
}, 20000)
