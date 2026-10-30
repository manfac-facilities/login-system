import { fireEvent, render, screen } from '@testing-library/react'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: jest.fn() }) }))

import SeletorDataDiario from '../_seletor-data'

describe('SeletorDataDiario (item 8)', () => {
  beforeEach(() => push.mockClear())

  it('escolher a data no calendário navega sozinho, sem botão "ir"', () => {
    render(<SeletorDataDiario base="/obras/obras/o1/diario" data="2026-10-30" />)
    expect(screen.queryByRole('button', { name: /ir/i })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Data do diário'), { target: { value: '2026-11-04' } })
    expect(push).toHaveBeenCalledWith('/obras/obras/o1/diario?data=2026-11-04')
  })

  it('digitando: não navega a cada tecla; navega com Enter ou ao sair do campo', () => {
    render(<SeletorDataDiario base="/b" data="2026-10-30" />)
    const campo = screen.getByLabelText('Data do diário')
    // "15": depois do "1" o campo já vale 01/10 — não pode navegar ainda.
    fireEvent.keyDown(campo, { key: '1' })
    fireEvent.change(campo, { target: { value: '2026-10-01' } })
    fireEvent.keyDown(campo, { key: '5' })
    fireEvent.change(campo, { target: { value: '2026-10-15' } })
    expect(push).not.toHaveBeenCalled()
    fireEvent.blur(campo)
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/b?data=2026-10-15')

    push.mockClear()
    fireEvent.keyDown(campo, { key: '2' })
    fireEvent.change(campo, { target: { value: '2026-10-12' } })
    expect(push).not.toHaveBeenCalled()
    fireEvent.keyDown(campo, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/b?data=2026-10-12')
  })

  it('escolha pelo calendário depois de digitar navega na hora', () => {
    render(<SeletorDataDiario base="/b" data="2026-10-30" />)
    const campo = screen.getByLabelText('Data do diário')
    fireEvent.keyDown(campo, { key: '1' })
    fireEvent.pointerDown(campo)
    fireEvent.change(campo, { target: { value: '2026-10-20' } })
    expect(push).toHaveBeenCalledWith('/b?data=2026-10-20')
  })

  it('valor vazio, incompleto ou igual ao atual não navega', () => {
    render(<SeletorDataDiario base="/b" data="2026-10-30" />)
    const campo = screen.getByLabelText('Data do diário')
    fireEvent.change(campo, { target: { value: '' } })
    fireEvent.change(campo, { target: { value: '0002-10-30' } })
    expect(push).not.toHaveBeenCalled()
  })
})
