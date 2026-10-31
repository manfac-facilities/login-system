/**
 * Formulário do semanal: sem IA o botão some; a sugestão só preenche o campo
 * (não salva) e o "Validar e enviar" fica bloqueado até salvar.
 */
const salvarMock = jest.fn()
const sugerirMock = jest.fn()
const validarMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('../_actions', () => ({
  salvarObservacoesSemanalAction: (...a: unknown[]) => salvarMock(...a),
  sugerirObservacoesIaAction: (...a: unknown[]) => sugerirMock(...a),
  validarEEnviarSemanalAction: (...a: unknown[]) => validarMock(...a),
}))
jest.mock('../../_actions', () => ({}))

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import FormSemanal from '../_form'

const props = { obraId: 'o1', segunda: '2026-10-26', estado: 'rascunho' as const, observacoes: 'Salvo.', podeEnviar: true, temClienteSemanal: true }

beforeEach(() => jest.clearAllMocks())

describe('FormSemanal', () => {
  it('sem IA configurada: botão não aparece', () => {
    render(<FormSemanal {...props} ia={false} />)
    expect(screen.queryByRole('button', { name: 'Sugerir texto com IA' })).toBeNull()
  })

  it('IA preenche o campo sem salvar; validar bloqueado até salvar', async () => {
    sugerirMock.mockResolvedValue({ ok: true, texto: 'Texto da IA.' })
    render(<FormSemanal {...props} ia />)
    expect(screen.getByRole('button', { name: 'Validar e enviar' })).toBeEnabled()
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir texto com IA' }))
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Texto da IA.'))
    expect(salvarMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Validar e enviar' })).toBeDisabled()
  })

  it('validado: campo só leitura, sem salvar nem IA', () => {
    render(<FormSemanal {...props} estado="validado" ia />)
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sugerir texto com IA' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Enviar a quem falta' })).toBeInTheDocument()
  })

  it('quem não é engenheiro/admin não vê ações', () => {
    render(<FormSemanal {...props} podeEnviar={false} ia />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
