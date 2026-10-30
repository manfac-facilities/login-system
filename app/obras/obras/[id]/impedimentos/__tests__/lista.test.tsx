import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const encerrarMock = jest.fn(async (id: string, data: string) => ({ ok: true, id, data }))
jest.mock('../_actions', () => ({ encerrarImpedimentoAction: (id: string, data: string) => encerrarMock(id, data) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

import ListaImpedimentos from '../_lista'
import type { ImpedimentoRow } from '../../../_lib/leitura'

const imp = (over: Partial<ImpedimentoRow> = {}): ImpedimentoRow =>
  ({
    id: 'i1', obraId: 'o1', categoria: 'impedimento', tipo: 'Área não liberada', responsavel: 'cliente',
    atividadeNumero: null, descricao: 'Loja fechada', pessoaCliente: null, fotoPath: null, travaAtividade: false,
    impactoDias: null, exibirAoCliente: true, abertoEm: '2026-11-04', encerradoEm: null, rdoId: null,
    orientacaoId: null, criadoEm: null, ...over,
  }) as ImpedimentoRow

describe('ListaImpedimentos — encerrar (item 9)', () => {
  beforeEach(() => encerrarMock.mockClear())

  it('no diário de 04/11 aberto em 31/10, encerra na data do diário (não em hoje)', async () => {
    render(<ListaImpedimentos itens={[imp()]} hoje="2026-10-31" dataReferencia="2026-11-04" feriados={new Set()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar em 04/11' }))
    await waitFor(() => expect(encerrarMock).toHaveBeenCalledWith('i1', '2026-11-04'))
  })

  it('sem data de referência, encerra hoje', async () => {
    render(<ListaImpedimentos itens={[imp({ abertoEm: '2026-10-20' })]} hoje="2026-10-31" feriados={new Set()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar hoje' }))
    await waitFor(() => expect(encerrarMock).toHaveBeenCalledWith('i1', '2026-10-31'))
  })

  it('aberto depois da referência: encerra na data de abertura', async () => {
    render(<ListaImpedimentos itens={[imp({ abertoEm: '2026-11-04' })]} hoje="2026-10-31" feriados={new Set()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar em 04/11' }))
    await waitFor(() => expect(encerrarMock).toHaveBeenCalledWith('i1', '2026-11-04'))
  })
})
