import { consultarSituacaoDaOrdemField } from '../consulta-ordem'
import { ErroDaApiField } from '../erros'
import type { HttpField } from '../http'

function httpQue(resposta: unknown): HttpField {
  return { get: async <T,>() => resposta as T }
}

describe('consultarSituacaoDaOrdemField', () => {
  it('reconhece a ordem antiga ativa', async () => {
    await expect(consultarSituacaoDaOrdemField(httpQue({ archived: false }), 'ord-antiga')).resolves.toEqual({
      situacao: 'ativa',
    })
  })

  it('reconhece a ordem antiga arquivada', async () => {
    await expect(consultarSituacaoDaOrdemField(httpQue({ archived: true }), 'ord-antiga')).resolves.toEqual({
      situacao: 'arquivada',
    })
  })

  it('trata 404 como inconclusivo e preserva o motivo', async () => {
    const http: HttpField = {
      get: jest.fn(async () => {
        throw new ErroDaApiField(404, null, 'GET /orders/ord-antiga')
      }),
    }

    await expect(consultarSituacaoDaOrdemField(http, 'ord-antiga')).resolves.toEqual({
      situacao: 'inconclusiva',
      motivo: 'Field Control respondeu 404 em GET /orders/ord-antiga',
    })
  })

  it('considera inconclusiva a resposta sem archived booleano', async () => {
    const resultado = await consultarSituacaoDaOrdemField(httpQue({ archived: null }), 'ord-antiga')

    expect(resultado.situacao).toBe('inconclusiva')
    expect(resultado.motivo).toMatch(/archived/i)
  })

  it('transforma falha da consulta em resultado inconclusivo para tentar depois', async () => {
    const http: HttpField = {
      get: jest.fn(async () => {
        throw new ErroDaApiField(500, null, 'GET /orders/ord-antiga')
      }),
    }

    const resultado = await consultarSituacaoDaOrdemField(http, 'ord-antiga')

    expect(resultado.situacao).toBe('inconclusiva')
    expect(resultado.motivo).toMatch(/500/)
  })
})
