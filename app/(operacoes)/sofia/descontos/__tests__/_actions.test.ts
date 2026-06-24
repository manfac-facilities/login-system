const updateMock = jest.fn()
const eqMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      update: updateMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import {
  atualizarStatusMultaAction,
  registrarDescontoMultaAction,
  desfazerDescontoMultaAction,
  atualizarStatusDescontoSinistroAction,
  registrarDescontoSinistroAction,
  desfazerDescontoSinistroAction,
} from '../_actions'

function buildDescontoFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    id: 'registro-1',
    valor_descontado: '100.00',
    tipo_desconto: 'parcial',
    autorizacao_assinada: 'true',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('descontos actions', () => {
  beforeEach(() => {
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
    updateMock.mockReset()
    updateMock.mockReturnValue({ eq: eqMock })
  })

  it('atualizarStatusMultaAction updates the multa status', async () => {
    await atualizarStatusMultaAction('multa-1', 'validada')
    expect(updateMock).toHaveBeenCalledWith({ status: 'validada' })
    expect(eqMock).toHaveBeenCalledWith('id', 'multa-1')
  })

  it('registrarDescontoMultaAction sets status to descontada', async () => {
    await registrarDescontoMultaAction(buildDescontoFormData())
    expect(updateMock).toHaveBeenCalledWith({
      valor_descontado: 100,
      tipo_desconto: 'parcial',
      autorizacao_assinada: true,
      status: 'descontada',
    })
  })

  it('desfazerDescontoMultaAction reverts status to validada', async () => {
    await desfazerDescontoMultaAction('multa-1')
    expect(updateMock).toHaveBeenCalledWith({ status: 'validada' })
  })

  it('atualizarStatusDescontoSinistroAction updates status_desconto', async () => {
    await atualizarStatusDescontoSinistroAction('sinistro-1', 'validada')
    expect(updateMock).toHaveBeenCalledWith({ status_desconto: 'validada' })
    expect(eqMock).toHaveBeenCalledWith('id', 'sinistro-1')
  })

  it('registrarDescontoSinistroAction sets status_desconto to descontada', async () => {
    await registrarDescontoSinistroAction(buildDescontoFormData({ id: 'sinistro-1' }))
    expect(updateMock).toHaveBeenCalledWith({
      valor_descontado: 100,
      tipo_desconto: 'parcial',
      autorizacao_assinada: true,
      status_desconto: 'descontada',
    })
  })

  it('desfazerDescontoSinistroAction reverts status_desconto to validada', async () => {
    await desfazerDescontoSinistroAction('sinistro-1')
    expect(updateMock).toHaveBeenCalledWith({ status_desconto: 'validada' })
  })
})
