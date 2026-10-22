/**
 * Botão "Enviar para faturamento" da ficha. O Dialogo roda pelo caminho de
 * reserva (jsdom não tem showModal), como em _cancelar-obra.test.tsx.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EnviarParaFaturamento from '../_enviar-faturamento'
import type { Obra } from '../../../_lib/tipos'

function obra(extra: Partial<Obra> = {}): Obra {
  return { id: 'o1', etapa: 'fecharOS', cliente: 'PROFARMA', cancelado_em: null, ...extra } as Obra
}

test('obra PROFARMA não enviada mostra o botão', () => {
  render(<EnviarParaFaturamento obra={obra()} enviar={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Enviar para faturamento' })).toBeInTheDocument()
})

test('a janela traz título, texto, campo e botões; Enviar chama a action com a observação', async () => {
  const u = userEvent.setup()
  const enviar = jest.fn().mockResolvedValue({ success: true })
  render(<EnviarParaFaturamento obra={obra()} enviar={enviar} />)
  await u.click(screen.getByRole('button', { name: 'Enviar para faturamento' }))
  const j = within(screen.getByRole('dialog'))
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Enviar para faturamento')
  expect(
    j.getByText('A obra vai para Pendente faturamento e o financeiro é avisado na fila dele.')
  ).toBeInTheDocument()
  expect(j.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  await u.type(j.getByLabelText('Observação (opcional)'), 'liberou por telefone')
  await u.click(j.getByRole('button', { name: 'Enviar' }))
  expect(enviar).toHaveBeenCalledWith('o1', 'liberou por telefone')
})

test('sem observação manda null', async () => {
  const u = userEvent.setup()
  const enviar = jest.fn().mockResolvedValue({ success: true })
  render(<EnviarParaFaturamento obra={obra()} enviar={enviar} />)
  await u.click(screen.getByRole('button', { name: 'Enviar para faturamento' }))
  await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enviar' }))
  expect(enviar).toHaveBeenCalledWith('o1', null)
})

test('erro devolvido aparece na tela', async () => {
  const u = userEvent.setup()
  const enviar = jest.fn().mockResolvedValue({ error: 'Não deu para enviar.' })
  render(<EnviarParaFaturamento obra={obra()} enviar={enviar} />)
  await u.click(screen.getByRole('button', { name: 'Enviar para faturamento' }))
  await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enviar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para enviar.')
})

test('obra enviada: sem botão, com a linha de quando e quem (horário de Brasília)', () => {
  render(
    <EnviarParaFaturamento
      obra={obra({ fat_enviado_em: '2026-10-22T01:30:00Z', fat_enviado_por: 'fulano@manfac.com.br' })}
      enviar={jest.fn()}
    />
  )
  expect(screen.queryByRole('button')).toBeNull()
  expect(
    screen.getByText('Enviada para faturamento em 21/10/2026 por fulano@manfac.com.br')
  ).toBeInTheDocument()
})

test('obra DPSP não renderiza nada', () => {
  const { container } = render(<EnviarParaFaturamento obra={obra({ cliente: 'DPSP' })} enviar={jest.fn()} />)
  expect(container).toBeEmptyDOMElement()
})
