const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
jest.mock('../../diario/_actions', () => ({ encerrarAgendamentoAction: jest.fn() }))

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Agendadas from '../_agendadas'
import { encerrarAgendamentoAction } from '../../diario/_actions'

const HOJE = '2026-10-15'
const PESSOAS = [{ email: 'yuri.moreira@manfac.com.br', nome: 'Yuri Moreira' }]

const obra = (id: string, ate: string, loja = 'DP Moema') => ({
  id,
  os: `OS${id}`,
  loja,
  pcm: 'YURI',
  etapa: 'andamento' as const,
  diario_agendado_ate: ate,
  diario_agendado_oque: 'Levantamento de material',
  diario_agendado_motivo: 'Aguardando material',
  diario_agendado_por: 'yuri.moreira@manfac.com.br',
})

const montar = (obras: ReturnType<typeof obra>[]) =>
  render(<Agendadas obras={obras} pessoasPorEmail={PESSOAS} hoje={HOJE} />)

beforeEach(() => jest.clearAllMocks())

test('título, selo, contagem e ordem por data de volta', () => {
  montar([obra('2', '2026-10-25', 'Loja Tardia'), obra('1', '2026-10-22', 'Loja Cedo')])
  expect(screen.getByRole('heading', { name: /Agendadas/ })).toBeInTheDocument()
  expect(screen.getByText('novo')).toBeInTheDocument()
  expect(screen.getByText('2 obras fora do diário')).toBeInTheDocument()
  expect(
    screen.getByText('Obras que saíram do diário até a data do levantamento. No dia marcado elas voltam sozinhas.')
  ).toBeInTheDocument()
  const itens = screen.getAllByRole('listitem')
  expect(itens[0]).toHaveTextContent('Loja Cedo')
  expect(itens[1]).toHaveTextContent('Loja Tardia')
})

test('linha ainda fora do diário: o que, data, detalhes e nenhum botão', () => {
  montar([obra('1', '2026-10-22')])
  expect(screen.getByText('Levantamento de material')).toBeInTheDocument()
  expect(screen.getByText('22/10')).toBeInTheDocument()
  expect(screen.getByText('DP Moema · OS OS1 · dono Yuri · motivo: Aguardando material')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('data = hoje: "Hoje: ... na loja", já voltou e "Marcar como feito"', async () => {
  const user = userEvent.setup()
  ;(encerrarAgendamentoAction as jest.Mock).mockResolvedValue({ success: true })
  montar([obra('1', HOJE)])
  expect(screen.getByText('Hoje: levantamento de material na DP Moema')).toBeInTheDocument()
  expect(screen.getByText('OS OS1 · dono Yuri · motivo: Aguardando material')).toBeInTheDocument()
  expect(screen.getByText('A obra já voltou ao diário.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Marcar como feito' }))
  expect(encerrarAgendamentoAction).toHaveBeenCalledWith('1', 'feito')
  expect(refresh).toHaveBeenCalled()
})

test('data passada: "desde DD/MM"', () => {
  montar([obra('1', '2026-10-14')])
  expect(screen.getByText('A obra já voltou ao diário desde 14/10.')).toBeInTheDocument()
})

test('vazio', () => {
  montar([])
  expect(
    screen.getByText(
      'Nenhuma obra agendada. Quando alguém tirar uma obra do diário por causa de um levantamento, ela aparece aqui.'
    )
  ).toBeInTheDocument()
})
