const listarMock = jest.fn()

jest.mock('../../_comunicados-actions', () => ({
  listarComunicadosNaoLidos: (...a: unknown[]) => listarMock(...a),
  marcarComunicadoLido: jest.fn(),
}))

import FaixaComunicadosServidor from '../faixa-comunicados-servidor'

beforeEach(() => listarMock.mockReset())

it('exceção na busca devolve null em vez de derrubar o layout', async () => {
  listarMock.mockRejectedValue(new Error('banco fora'))
  expect(await FaixaComunicadosServidor()).toBeNull()
})

it('sucesso devolve a faixa com os comunicados por prop', async () => {
  const c = [{ id: 'c1', titulo: 'T', corpo: 'a', publicado_em: '2026-09-22T12:00:00Z' }]
  listarMock.mockResolvedValue(c)
  const el = await FaixaComunicadosServidor()
  expect(el?.props.iniciais).toEqual(c)
})
