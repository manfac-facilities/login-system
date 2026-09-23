/**
 * "corrigir data" do passo Fechar OS concluído (ajuste 2 de 23/09,
 * spec-ajustes-ficha-2026-09-23.md §5.7).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CorrigirFechamento from '../_corrigir-fechamento'

const REF = { relatorio: '2026-09-15', aprovacao: '2026-09-16' }
const montar = (corrigir = jest.fn().mockResolvedValue({ success: true })) => {
  render(
    <CorrigirFechamento
      obraId="o1"
      data="2026-09-19"
      hoje="2026-09-22"
      referencia={REF}
      corrigir={corrigir}
    />
  )
  return corrigir
}

test('mostra a data e o link "corrigir data"', () => {
  montar()
  expect(screen.getByText(/Fechada no sistema do cliente em/)).toHaveTextContent('19/09/2026')
  expect(screen.getByRole('button', { name: 'corrigir data' })).toBeInTheDocument()
})

test('abre inline com a data atual, avisa do histórico e cancela sem gravar', async () => {
  const u = userEvent.setup()
  const corrigir = montar()
  await u.click(screen.getByRole('button', { name: 'corrigir data' }))
  expect(screen.getByLabelText('Data de fechamento da OS')).toHaveValue('2026-09-19')
  expect(screen.getByText(/entra no Histórico de alterações/)).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(corrigir).not.toHaveBeenCalled()
})

test('data futura: erro inline e Salvar desabilitado', async () => {
  const u = userEvent.setup()
  montar()
  await u.click(screen.getByRole('button', { name: 'corrigir data' }))
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d)
  await u.type(d, '2026-09-23')
  expect(screen.getByText('A data não pode ser posterior a hoje.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Salvar correção' })).toBeDisabled()
}, 20000)

test('salva, mostra "Corrigido: de → para"', async () => {
  const u = userEvent.setup()
  const corrigir = montar()
  await u.click(screen.getByRole('button', { name: 'corrigir data' }))
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d)
  await u.type(d, '2026-09-17')
  await u.click(screen.getByRole('button', { name: 'Salvar correção' }))
  expect(corrigir).toHaveBeenCalledWith('o1', '2026-09-17')
  expect(
    await screen.findByText(/Corrigido: de 19\/09\/2026 para 17\/09\/2026/)
  ).toBeInTheDocument()
}, 20000)

test('erro do servidor aparece e a edição continua aberta', async () => {
  const u = userEvent.setup()
  montar(jest.fn().mockResolvedValue({ error: 'Erro ao corrigir a data de fechamento da OS' }))
  await u.click(screen.getByRole('button', { name: 'corrigir data' }))
  const d = screen.getByLabelText('Data de fechamento da OS')
  await u.clear(d)
  await u.type(d, '2026-09-17')
  await u.click(screen.getByRole('button', { name: 'Salvar correção' }))
  expect(await screen.findByText('Erro ao corrigir a data de fechamento da OS')).toBeInTheDocument()
  expect(screen.getByLabelText('Data de fechamento da OS')).toBeInTheDocument()
}, 20000)
