import { render, screen } from '@testing-library/react'

const podeVerMock = jest.fn()
const lerCarteiraMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => ({})) }))
jest.mock('../_permissao', () => ({ podeVerVisaoCeo: (...a: unknown[]) => podeVerMock(...a) }))
jest.mock('../../_lib/carteira-leitura', () => ({ lerCarteira: (...a: unknown[]) => lerCarteiraMock(...a) }))

import VisaoCeoPage from '../page'

beforeEach(() => {
  podeVerMock.mockReset()
  lerCarteiraMock.mockReset()
})

describe('página Visão do CEO', () => {
  it('sem permissão: aviso da administração e a carteira nem é lida', async () => {
    podeVerMock.mockResolvedValue(false)
    render(await VisaoCeoPage())
    expect(screen.getByText('Esta tela é da administração')).toBeInTheDocument()
    expect(lerCarteiraMock).not.toHaveBeenCalled()
  })

  it('com permissão e leitura falhou: aviso de recarregar', async () => {
    podeVerMock.mockResolvedValue(true)
    lerCarteiraMock.mockResolvedValue({ ok: false })
    render(await VisaoCeoPage())
    expect(screen.getByText('Não deu para ler as obras agora. Recarregue em instantes.')).toBeInTheDocument()
    expect(lerCarteiraMock).toHaveBeenCalledTimes(1)
  })

  it('com permissão e carteira vazia: mostra a tela', async () => {
    podeVerMock.mockResolvedValue(true)
    lerCarteiraMock.mockResolvedValue({ ok: true, obras: [] })
    render(await VisaoCeoPage())
    expect(screen.getByRole('heading', { name: 'Visão do CEO' })).toBeInTheDocument()
  })
})
