import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DialogoAgendar from '../_dialogo-agendar'
import { ERRO_AGENDAR } from '../../_lib/agendamento'

const OBRA = { id: 'o1', os: '1234', tipo: 'Reforma', loja: 'DP Moema', descricao: 'Troca de piso' }
const HOJE = '2026-10-15'

function montar(over: Partial<React.ComponentProps<typeof DialogoAgendar>> = {}) {
  const props = {
    obra: OBRA,
    hoje: HOJE,
    admin: false,
    agendar: jest.fn().mockResolvedValue({ success: true }),
    aoFechar: jest.fn(),
    aoAgendar: jest.fn(),
    ...over,
  }
  render(<DialogoAgendar {...props} />)
  return props
}

const botaoOk = () => screen.getByRole('button', { name: /Agendar e tirar do diário|salvando…|Tentar de novo/ })
const data = (v: string) => fireEvent.change(screen.getByLabelText('Até quando'), { target: { value: v } })

test('abre com "Levantamento de material" e as sugestões trocam o texto', async () => {
  const user = userEvent.setup()
  montar()
  const campo = screen.getByLabelText('O que vai acontecer') as HTMLInputElement
  expect(campo.value).toBe('Levantamento de material')
  await user.click(screen.getByRole('button', { name: 'Visita técnica' }))
  expect(campo.value).toBe('Visita técnica')
})

test('botão desabilitado, com a dica certa a cada passo', async () => {
  const user = userEvent.setup()
  montar()
  expect(botaoOk()).toBeDisabled()
  expect(screen.getByText('Escolha o motivo da parada.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Aguardando material' }))
  expect(screen.getByText('Escolha uma data entre amanhã e 30 dias.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Outro' }))
  expect(screen.getByPlaceholderText('Escreva o motivo em uma linha')).toBeInTheDocument()
  expect(screen.getByText('Escreva o motivo.')).toBeInTheDocument()
})

test('input de data com min = amanhã, max = hoje + 30 e a nota', () => {
  montar()
  const d = screen.getByLabelText('Até quando')
  expect(d).toHaveAttribute('min', '2026-10-16')
  expect(d).toHaveAttribute('max', '2026-11-14')
  expect(screen.getByText('Entre 16/10 e 14/11 (máximo de 30 dias).')).toBeInTheDocument()
})

test('caixa de consequências: __/__ sem data, 22/10 com data; admin como dono', () => {
  montar({ admin: true })
  expect(screen.getAllByText('__/__').length).toBeGreaterThan(0)
  data('2026-10-22')
  expect(screen.queryByText('__/__')).not.toBeInTheDocument()
  expect(screen.getAllByText('22/10').length).toBeGreaterThan(0)
  expect(screen.getByText('você (admin)')).toBeInTheDocument()
})

test('confirmar chama agendar com a entrada e mostra "salvando…"', async () => {
  const user = userEvent.setup()
  let resolver: (v: { success: boolean }) => void = () => {}
  const agendar = jest.fn(() => new Promise<{ success: boolean }>((r) => (resolver = r)))
  const p = montar({ agendar })
  await user.click(screen.getByRole('button', { name: 'Aguardando material' }))
  data('2026-10-22')
  await user.click(botaoOk())
  expect(agendar).toHaveBeenCalledWith({
    obraId: 'o1',
    oque: 'Levantamento de material',
    motivo: 'Aguardando material',
    outro: '',
    ate: '2026-10-22',
  })
  expect(screen.getByRole('button', { name: 'salvando…' })).toBeDisabled()
  resolver({ success: true })
  await waitFor(() => expect(p.aoAgendar).toHaveBeenCalledWith('2026-10-22'))
})

test('erro genérico mostra o bloco do mockup e "Tentar de novo"; erro de validação vai no lugar da dica', async () => {
  const user = userEvent.setup()
  const agendar = jest
    .fn()
    .mockResolvedValueOnce({ error: ERRO_AGENDAR })
    .mockResolvedValueOnce({ error: 'Só o responsável pela obra ou o administrador pode agendar.' })
  const p = montar({ agendar })
  await user.click(screen.getByRole('button', { name: 'Aguardando material' }))
  data('2026-10-22')
  await user.click(botaoOk())
  expect(await screen.findByText('Não deu para agendar')).toBeInTheDocument()
  expect(screen.getByText(/A conexão falhou na hora de salvar/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
  expect(await screen.findByText('Só o responsável pela obra ou o administrador pode agendar.')).toBeInTheDocument()
  expect(screen.queryByText('Não deu para agendar')).not.toBeInTheDocument()
  expect(p.aoAgendar).not.toHaveBeenCalled()
})

test('Cancelar e Esc fecham', async () => {
  const user = userEvent.setup()
  const p = montar()
  await user.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(p.aoFechar).toHaveBeenCalledTimes(1)
  await user.keyboard('{Escape}')
  expect(p.aoFechar).toHaveBeenCalledTimes(2)
})
