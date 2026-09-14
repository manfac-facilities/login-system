/** @jest-environment node */

const afterMock = jest.fn()
const createAdminClientMock = jest.fn(() => ({ nome: 'admin' }))
const prepararExecucaoMock = jest.fn()
const executarExecucaoPreparadaMock = jest.fn()

jest.mock('next/server', () => ({
  ...jest.requireActual('next/server'),
  after: (callback: () => Promise<void>) => afterMock(callback),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => createAdminClientMock(),
}))
jest.mock('@/app/obras/sincronizar/_execucao', () => ({
  prepararExecucao: (...args: unknown[]) => prepararExecucaoMock(...args),
  executarExecucaoPreparada: (...args: unknown[]) => executarExecucaoPreparadaMock(...args),
}))

import { autorizacaoDoCronValida, POST } from '../route'

const SEGREDO = 'segredo-falso-de-teste'

function requisicao(authorization?: string, tipo = 'incremental') {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (authorization) headers.set('authorization', authorization)
  return new Request('http://localhost/api/obras/sincronizar', {
    method: 'POST',
    headers,
    body: JSON.stringify({ tipo }),
  })
}

describe('POST /api/obras/sincronizar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OBRAS_CRON_SECRET = SEGREDO
    prepararExecucaoMock.mockResolvedValue({
      execucao: {
        id: 'exec-1',
        tipo: 'incremental',
        origem: 'agendada',
        marcaDaguaAnterior: null,
      },
    })
  })

  afterEach(() => {
    delete process.env.OBRAS_CRON_SECRET
  })

  it('recusa pedido sem o segredo e não cria client administrativo', async () => {
    const resposta = await POST(requisicao())

    expect(resposta.status).toBe(401)
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('aceita o segredo exato e devolve antes do trabalho demorado', async () => {
    const resposta = await POST(requisicao(`Bearer ${SEGREDO}`))
    const corpo = await resposta.json()

    expect(resposta.status).toBe(202)
    expect(corpo).toEqual({ status: 'rodando', execucaoId: 'exec-1' })
    expect(prepararExecucaoMock).toHaveBeenCalledWith(
      { nome: 'admin' },
      { tipo: 'incremental', origem: 'agendada', criadoPor: null },
    )
    expect(executarExecucaoPreparadaMock).not.toHaveBeenCalled()

    const callback = afterMock.mock.calls[0][0]
    await callback()
    expect(executarExecucaoPreparadaMock).toHaveBeenCalled()
  })

  it('usa comparação exata mesmo quando os segredos têm tamanhos diferentes', () => {
    expect(autorizacaoDoCronValida('Bearer curto', SEGREDO)).toBe(false)
    expect(autorizacaoDoCronValida(`Bearer ${SEGREDO}`, SEGREDO)).toBe(true)
  })

  it('informa conflito quando outra execução já está rodando', async () => {
    prepararExecucaoMock.mockResolvedValue({ jaEstavaRodando: true })

    const resposta = await POST(requisicao(`Bearer ${SEGREDO}`))

    expect(resposta.status).toBe(409)
    expect(afterMock).not.toHaveBeenCalled()
  })
})
