/**
 * Formulário do relatório de período: desmarcar destaque e escrever o livre
 * vão para o rascunho; validar fica bloqueado até salvar; validado mostra só
 * os textos congelados.
 */
const salvarMock = jest.fn()
const sugerirMock = jest.fn()
const validarMock = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('../_actions', () => ({
  salvarRascunhoRelatorioAction: (...a: unknown[]) => salvarMock(...a),
  sugerirObservacoesRelatorioIaAction: (...a: unknown[]) => sugerirMock(...a),
  validarEEnviarRelatorioAction: (...a: unknown[]) => validarMock(...a),
}))
jest.mock('../../../../_actions', () => ({}))

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import FormRelatorio from '../_form'

const destaques = [
  { id: 'etapa-antecipada:10', texto: 'Etapa 1 — Demolição concluída antes' },
  { id: 'ppc:2026-11-02', texto: 'Semana de 02/11: 90% do plano cumprido (PPC)' },
]
const props = {
  obraId: 'o1', tipo: 'fase', referencia: '10', estado: 'rascunho' as const, observacoes: 'Salvo.', destaques,
  marcados: destaques.map((h) => h.id), livre: '', congelados: [], podeEnviar: true, ia: false, temCliente: true,
  rotuloDestinatarios: 'Semanal ou Mensal',
}

beforeEach(() => jest.clearAllMocks())

describe('FormRelatorio', () => {
  it('desmarca um destaque e escreve o livre: salva só os marcados; validar bloqueado até salvar', async () => {
    salvarMock.mockResolvedValue({ ok: true })
    render(<FormRelatorio {...props} />)
    const validar = screen.getByRole('button', { name: 'Validar e enviar' })
    expect(validar).toBeEnabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /PPC/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /Destaque livre/ }), { target: { value: 'Elogio do cliente' } })
    expect(validar).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(salvarMock).toHaveBeenCalled())
    expect(salvarMock).toHaveBeenCalledWith('o1', 'fase', '10', { observacoes: 'Salvo.', marcados: ['etapa-antecipada:10'], livre: 'Elogio do cliente' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Validar e enviar' })).toBeEnabled())
  })

  it('mensal antes do último dia útil: validar bloqueado com a data', () => {
    render(<FormRelatorio {...props} tipo="mensal" referencia="2026-11" validarAPartirDe="30/11/2026" />)
    expect(screen.getByRole('button', { name: 'Validar e enviar' })).toBeDisabled()
    expect(screen.getByText(/a partir de 30\/11\/2026/)).toBeInTheDocument()
  })

  it('validado: só os textos congelados, sem caixas nem salvar', () => {
    render(<FormRelatorio {...props} estado="validado" destaques={[]} marcados={[]} congelados={['Só o que foi']} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull()
    expect(screen.getByText('Só o que foi')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Observações/ })).toHaveAttribute('readonly')
  })
})
