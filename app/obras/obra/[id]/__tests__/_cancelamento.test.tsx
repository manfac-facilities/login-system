/**
 * O selo da obra cancelada e o "Desfazer cancelamento"
 * (spec-cancelamento-obra-2026-09-23 §6.3).
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SeloCancelada from '../_cancelamento'

const base = {
  obraId: 'o1',
  loja: 'DP ITABORAI',
  os: '0926-011480',
  por: 'cliente' as const,
  obs: 'Loja informou que a reforma foi suspensa pela regional.',
  em: '2026-09-23T13:42:00Z',
  quem: 'rafael.souza@manfac.com.br',
  etapaAnterior: 'andamento' as const,
  responsavel: 'YURI',
}

const janela = () => within(screen.getByRole('dialog'))

test('selo: quem, quando (fuso de SP), por quem, onde estava e a observação', () => {
  const { container } = render(<SeloCancelada {...base} desfazer={jest.fn()} />)
  expect(screen.getByText('Cancelado pelo Cliente')).toBeInTheDocument()
  expect(container).toHaveTextContent(
    'em 23/09/2026 às 10:42 por rafael.souza@manfac.com.br · estava em Em andamento'
  )
  expect(screen.getByText('"Loja informou que a reforma foi suspensa pela regional."')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Desfazer cancelamento' })).toBeInTheDocument()
})

test('sem observação, não desenha aspas vazias', () => {
  const { container } = render(<SeloCancelada {...base} por="manfac" obs={null} desfazer={jest.fn()} />)
  expect(screen.getByText('Cancelado pela Manfac')).toBeInTheDocument()
  expect(container).not.toHaveTextContent('""')
})

test('desfazer pede confirmação com o texto da etapa de campo', async () => {
  const u = userEvent.setup()
  render(<SeloCancelada {...base} desfazer={jest.fn()} />)
  await u.click(screen.getByRole('button', { name: 'Desfazer cancelamento' }))
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Desfazer o cancelamento?')
  const d = screen.getByRole('dialog')
  expect(d).toHaveTextContent('DP ITABORAI · OS 0926-011480')
  expect(d).toHaveTextContent(
    'A obra volta para Em andamento, entra de novo no diário de YURI e as tarefas abertas dela voltam a cobrar.'
  )
  expect(d).toHaveTextContent('O cancelamento pelo Cliente de 23/09/2026 continua no histórico, junto com este desfazer.')
})

test('sem responsável, o texto diz "diário do responsável"', async () => {
  const u = userEvent.setup()
  render(<SeloCancelada {...base} responsavel={null} desfazer={jest.fn()} />)
  await u.click(screen.getByRole('button', { name: 'Desfazer cancelamento' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('entra de novo no diário do responsável')
})

test('vinda da triagem: o texto diz que abre de novo na Triagem', async () => {
  const u = userEvent.setup()
  render(<SeloCancelada {...base} por="manfac" etapaAnterior="definir" desfazer={jest.fn()} />)
  await u.click(screen.getByRole('button', { name: 'Desfazer cancelamento' }))
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'A obra volta para Aguardando definição e abre de novo na Triagem.'
  )
  expect(screen.getByRole('dialog')).toHaveTextContent('O cancelamento pela Manfac de 23/09/2026')
})

test('"Manter cancelada" fecha sem chamar a action', async () => {
  const u = userEvent.setup()
  const desfazer = jest.fn()
  render(<SeloCancelada {...base} desfazer={desfazer} />)
  await u.click(screen.getByRole('button', { name: 'Desfazer cancelamento' }))
  await u.click(janela().getByRole('button', { name: 'Manter cancelada' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(desfazer).not.toHaveBeenCalled()
})

test('confirmar chama desfazer("o1"), mostra "Desfazendo…" e, no erro, a mensagem', async () => {
  const u = userEvent.setup()
  let resolver: (v: { error?: string }) => void = () => {}
  const desfazer = jest.fn(() => new Promise<{ error?: string }>((r) => (resolver = r)))
  render(<SeloCancelada {...base} desfazer={desfazer} />)
  await u.click(screen.getByRole('button', { name: 'Desfazer cancelamento' }))
  await u.click(janela().getByRole('button', { name: 'Desfazer cancelamento' }))
  expect(desfazer).toHaveBeenCalledWith('o1')
  expect(await screen.findByRole('button', { name: 'Desfazendo…' })).toBeDisabled()
  resolver({ error: 'Não deu para desfazer o cancelamento. Nada mudou — tente de novo.' })
  expect(
    await screen.findByText('Não deu para desfazer o cancelamento. Nada mudou — tente de novo.')
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Desfazer cancelamento' })).toBeEnabled()
}, 20000)
