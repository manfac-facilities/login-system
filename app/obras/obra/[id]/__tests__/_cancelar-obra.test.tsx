/**
 * A faixa e a janela de cancelar obra (spec-cancelamento-obra-2026-09-23 §6.1).
 * O `<dialog>` roda pelo caminho de reserva de `_ui/dialogo.tsx` (o jsdom não
 * implementa `showModal`): testa-se o comportamento, não a API nativa.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FaixaCancelar from '../_cancelar-obra'

const props = {
  obraId: 'o1',
  loja: 'DP ITABORAI',
  os: '0926-011480',
  etapaNome: 'Em andamento',
  responsavel: 'YURI',
}

function abrir(u: ReturnType<typeof userEvent.setup>) {
  return u.click(screen.getByRole('button', { name: 'Cancelar obra' }))
}

const janela = () => within(screen.getByRole('dialog'))

test('variante ficha: título "Encerrar sem executar" e o botão', () => {
  render(<FaixaCancelar {...props} variante="ficha" cancelar={jest.fn()} />)
  expect(screen.getByText('Encerrar sem executar')).toBeInTheDocument()
  expect(screen.getByText(/Nada é apagado e dá para desfazer/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancelar obra' })).toBeInTheDocument()
})

test('variante triagem: título "Esta OS não vai virar obra?"', () => {
  render(<FaixaCancelar {...props} etapaNome="Aguardando definição" variante="triagem" cancelar={jest.fn()} />)
  expect(screen.getByText('Esta OS não vai virar obra?')).toBeInTheDocument()
  expect(screen.getByText(/Cancele em vez de deixar parada em "Aguardando definição"/)).toBeInTheDocument()
})

test('a janela: título, subtítulo e as duas opções', async () => {
  const u = userEvent.setup()
  render(<FaixaCancelar {...props} variante="ficha" cancelar={jest.fn()} />)
  await abrir(u)
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Cancelar a obra DP ITABORAI')
  expect(janela().getByText('OS 0926-011480 · hoje em "Em andamento"')).toBeInTheDocument()
  expect(janela().getByRole('radio', { name: /Cancelado pelo Cliente/ })).toBeInTheDocument()
  expect(janela().getByRole('radio', { name: /Cancelado pela Manfac/ })).toBeInTheDocument()
  expect(janela().getByLabelText(/O que aconteceu/)).toBeInTheDocument()
})

test('confirmar fica desabilitado até escolher quem cancelou, com a dica', async () => {
  const u = userEvent.setup()
  render(<FaixaCancelar {...props} variante="ficha" cancelar={jest.fn()} />)
  await abrir(u)
  expect(janela().getByRole('button', { name: 'Cancelar obra' })).toBeDisabled()
  expect(janela().getByText('Escolha quem cancelou para continuar.')).toBeInTheDocument()
  await u.click(janela().getByRole('radio', { name: /Cancelado pela Manfac/ }))
  expect(janela().getByRole('button', { name: 'Cancelar obra' })).toBeEnabled()
  expect(janela().queryByText('Escolha quem cancelou para continuar.')).not.toBeInTheDocument()
})

test('o aviso diz para onde a obra volta', async () => {
  const u = userEvent.setup()
  render(<FaixaCancelar {...props} variante="ficha" cancelar={jest.fn()} />)
  await abrir(u)
  expect(janela().getByText('Dá para desfazer na própria ficha, e ela volta para "Em andamento".')).toBeInTheDocument()
  expect(janela().getByText('A obra sai do diário do dia e das cobranças na hora.')).toBeInTheDocument()
})

test('envia por e observação; mostra "Cancelando…" enquanto espera', async () => {
  const u = userEvent.setup()
  let resolver: (v: { success: boolean }) => void = () => {}
  const cancelar = jest.fn(() => new Promise<{ success: boolean }>((r) => (resolver = r)))
  render(<FaixaCancelar {...props} variante="ficha" cancelar={cancelar} />)
  await abrir(u)
  await u.click(janela().getByRole('radio', { name: /Cancelado pela Manfac/ }))
  await u.type(janela().getByLabelText(/O que aconteceu/), 'duplicada')
  await u.click(janela().getByRole('button', { name: 'Cancelar obra' }))
  expect(cancelar).toHaveBeenCalledWith('o1', { por: 'manfac', obs: 'duplicada' })
  const faixa = await screen.findByRole('button', { name: 'Cancelando…' })
  expect(faixa).toBeDisabled()
  resolver({ success: true })
  expect(await screen.findByRole('button', { name: 'Cancelar obra' })).toBeEnabled()
}, 20000)

test('erro: mensagem do servidor + "Tentar de novo" reenvia a mesma escolha', async () => {
  const u = userEvent.setup()
  const cancelar = jest
    .fn()
    .mockResolvedValueOnce({ error: 'Não deu para cancelar a obra. Nada mudou — tente de novo.' })
    .mockResolvedValueOnce({ success: true })
  render(<FaixaCancelar {...props} variante="ficha" cancelar={cancelar} />)
  await abrir(u)
  await u.click(janela().getByRole('radio', { name: /Cancelado pelo Cliente/ }))
  await u.type(janela().getByLabelText(/O que aconteceu/), 'loja suspensa')
  await u.click(janela().getByRole('button', { name: 'Cancelar obra' }))
  expect(await screen.findByText('Não deu para cancelar a obra. Nada mudou — tente de novo.')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(cancelar).toHaveBeenCalledTimes(2)
  expect(cancelar.mock.calls[1]).toEqual(cancelar.mock.calls[0])
  expect(cancelar.mock.calls[1]).toEqual(['o1', { por: 'cliente', obs: 'loja suspensa' }])
}, 20000)

test('"Voltar sem cancelar" fecha sem chamar a action', async () => {
  const u = userEvent.setup()
  const cancelar = jest.fn()
  render(<FaixaCancelar {...props} variante="ficha" cancelar={cancelar} />)
  await abrir(u)
  await u.click(janela().getByRole('radio', { name: /Cancelado pelo Cliente/ }))
  await u.click(janela().getByRole('button', { name: 'Voltar sem cancelar' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(cancelar).not.toHaveBeenCalled()
})
