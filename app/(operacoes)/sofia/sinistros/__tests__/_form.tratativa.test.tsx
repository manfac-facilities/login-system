import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Sinistro } from '@/lib/sofia/types'

const actionMock = jest.fn()
jest.mock('../_actions', () => ({
  atualizarTratativaSinistroAction: (...args: unknown[]) => actionMock(...args),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))

import TratativaForm from '../[id]/_form'

const sinistro = { id: 's1', status: 'aberto' } as Sinistro

describe('TratativaForm', () => {
  beforeEach(() => actionMock.mockReset())

  it('mantem o status escolhido e confirma o salvamento', async () => {
    actionMock.mockResolvedValue({ success: true })
    render(<TratativaForm sinistro={sinistro} />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'encerrado')
    await userEvent.click(screen.getByRole('button', { name: /salvar tratativa/i }))

    expect(await screen.findByText('Alterações salvas')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('encerrado'))
  })

  it('nao mostra confirmacao quando a action falha', async () => {
    actionMock.mockResolvedValue({ error: 'Erro ao atualizar tratativa' })
    render(<TratativaForm sinistro={sinistro} />)

    await userEvent.click(screen.getByRole('button', { name: /salvar tratativa/i }))

    expect(await screen.findByText('Erro ao atualizar tratativa')).toBeInTheDocument()
    expect(screen.queryByText('Alterações salvas')).not.toBeInTheDocument()
  })
})
