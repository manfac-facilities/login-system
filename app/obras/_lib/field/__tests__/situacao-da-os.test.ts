/**
 * A situação da ÚLTIMA atividade de uma OS.
 *
 * O Field guarda o andamento nas atividades da OS, não na OS. O critério de
 * entrada (feedback 20) fala da situação da última atividade — então é ela que
 * precisa ser lida, e lida do campo estruturado (`status`), nunca do texto
 * livre que a equipe digita.
 *
 * Falha aqui NUNCA derruba a varredura inteira: a OS fica sem situação e é
 * ignorada com motivo, do mesmo jeito que `consulta-ordem.ts` faz com a ordem
 * antiga inconclusiva.
 */

import { consultarSituacaoDaUltimaAtividade } from '../situacao-da-os'
import type { HttpField } from '../http'

function httpFalso(resposta: unknown): HttpField {
  return { get: jest.fn().mockResolvedValue(resposta) } as unknown as HttpField
}

function httpQueFalha(erro: Error): HttpField {
  return { get: jest.fn().mockRejectedValue(erro) } as unknown as HttpField
}

describe('qual atividade é a última', () => {
  it('usa a de maior posição, não a última da lista', async () => {
    const http = httpFalso({
      items: [
        { id: 'c', position: 3, status: 'pending' },
        { id: 'a', position: 1, status: 'done' },
      ],
    })
    await expect(consultarSituacaoDaUltimaAtividade(http, 'OS-1')).resolves.toEqual({
      situacao: 'pending',
    })
  })

  it('desempata posição igual pela atualização mais recente', async () => {
    const http = httpFalso({
      items: [
        { id: 'velha', position: 2, status: 'done', updatedAt: '2026-09-01T10:00:00Z' },
        { id: 'nova', position: 2, status: 'in-progress', updatedAt: '2026-09-14T10:00:00Z' },
      ],
    })
    await expect(consultarSituacaoDaUltimaAtividade(http, 'OS-2')).resolves.toEqual({
      situacao: 'in-progress',
    })
  })

  it('lê o campo estruturado, nunca o texto livre digitado pela equipe', async () => {
    const http = httpFalso({
      items: [
        {
          id: 'a',
          position: 1,
          status: 'pending',
          statusDescription: 'sem tempo para executa',
          statusClassification: { description: 'Falta de Tempo', status: 'reported' },
        },
      ],
    })
    await expect(consultarSituacaoDaUltimaAtividade(http, 'OS-3')).resolves.toEqual({
      situacao: 'pending',
    })
  })

  it('pede as atividades da OS certa', async () => {
    const http = httpFalso({ items: [{ id: 'a', position: 1, status: 'pending' }] })
    await consultarSituacaoDaUltimaAtividade(http, 'OS 4/26')
    expect(http.get).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('OS 4/26')),
      expect.anything(),
    )
  })
})

describe('quando não dá para saber', () => {
  it('OS sem nenhuma atividade fica sem situação, com motivo', async () => {
    const http = httpFalso({ items: [] })
    const resultado = await consultarSituacaoDaUltimaAtividade(http, 'OS-5')
    expect(resultado.situacao).toBeNull()
    expect(resultado.motivo).toContain('nenhuma atividade')
  })

  it('resposta sem a lista de atividades fica sem situação, com motivo', async () => {
    const http = httpFalso({})
    const resultado = await consultarSituacaoDaUltimaAtividade(http, 'OS-6')
    expect(resultado.situacao).toBeNull()
    expect(resultado.motivo).toBeTruthy()
  })

  it('falha de rede não derruba a varredura: devolve motivo, não lança', async () => {
    const http = httpQueFalha(new Error('429 Too Many Requests'))
    const resultado = await consultarSituacaoDaUltimaAtividade(http, 'OS-7')
    expect(resultado.situacao).toBeNull()
    expect(resultado.motivo).toContain('429')
  })

  it('atividade sem status vira situação nula, não string vazia', async () => {
    const http = httpFalso({ items: [{ id: 'a', position: 1 }] })
    const resultado = await consultarSituacaoDaUltimaAtividade(http, 'OS-8')
    expect(resultado.situacao).toBeNull()
    expect(resultado.motivo).toBeTruthy()
  })
})
