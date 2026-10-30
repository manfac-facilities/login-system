import { fireEvent, render, screen } from '@testing-library/react'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: jest.fn() }) }))

import SeletorDataDiario from '../_seletor-data'

describe('SeletorDataDiario (item 8)', () => {
  beforeEach(() => push.mockClear())

  it('trocar a data navega sozinho, sem botão "ir"', () => {
    render(<SeletorDataDiario base="/obras/obras/o1/diario" data="2026-10-30" />)
    expect(screen.queryByRole('button', { name: /ir/i })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Data do diário'), { target: { value: '2026-11-04' } })
    expect(push).toHaveBeenCalledWith('/obras/obras/o1/diario?data=2026-11-04')
  })

  it('valor vazio, incompleto ou igual ao atual não navega', () => {
    render(<SeletorDataDiario base="/b" data="2026-10-30" />)
    const campo = screen.getByLabelText('Data do diário')
    fireEvent.change(campo, { target: { value: '' } })
    fireEvent.change(campo, { target: { value: '0002-10-30' } })
    expect(push).not.toHaveBeenCalled()
  })
})
