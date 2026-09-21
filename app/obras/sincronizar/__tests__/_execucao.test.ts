/** @jest-environment node */

import { criarClienteField } from '../../_lib/field'
import { executarExecucaoPreparada, prepararExecucao } from '../_execucao'

jest.mock('../../_lib/field', () => ({ criarClienteField: jest.fn() }))

describe('prepararExecucao — marca d’água e trava', () => {
  it('aplica dez minutos de margem à última marca bem-sucedida', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          execucao_id: 'exec-1',
          marca_dagua_anterior: '2026-09-14T12:30:00.000Z',
        },
      ],
      error: null,
    })

    const resultado = await prepararExecucao({ rpc } as never, {
      tipo: 'incremental',
      origem: 'agendada',
      criadoPor: null,
      agora: new Date('2026-09-14T13:00:00.000Z'),
    })

    expect(resultado.execucao?.desde).toBe('2026-09-14T12:20:00.000Z')
    expect(rpc).toHaveBeenCalledWith(
      'obras_iniciar_sync_execucao',
      expect.objectContaining({ p_expira_antes: '2026-09-14T11:00:00.000Z' }),
    )
  })

  it('incremental inaugural lê tudo sem se declarar varredura completa', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ execucao_id: 'exec-1', marca_dagua_anterior: null }],
      error: null,
    })

    const resultado = await prepararExecucao({ rpc } as never, {
      tipo: 'incremental',
      origem: 'agendada',
      criadoPor: null,
    })

    expect(resultado.execucao?.desde).toBeUndefined()
    expect(resultado.execucao?.tipo).toBe('incremental')
  })
})

describe('executarExecucaoPreparada — falha de leitura das atividades', () => {
  it('registra falha sem avançar a marca d’água nem gravar obras', async () => {
    const chaveAnterior = process.env.FIELD_API_KEY
    process.env.FIELD_API_KEY = 'chave-de-teste-sem-valor-real'
    try {
      const listarOsNormalizadas = jest.fn().mockRejectedValue(new Error('falha ao ler as atividades da OS ord-2: 429'))
      jest.mocked(criarClienteField).mockReturnValue({
        listarOsNormalizadas,
      } as never)
      const eq = jest.fn().mockResolvedValue({ error: null })
      const update = jest.fn().mockReturnValue({ eq })
      const from = jest.fn().mockReturnValue({ update })
      const execucao = {
        id: 'exec-1', tipo: 'incremental' as const, origem: 'agendada' as const,
        marcaDaguaAnterior: '2026-09-14T12:30:00.000Z',
        desde: '2026-09-14T12:20:00.000Z',
      }

      const resultado = await executarExecucaoPreparada({ from } as never, execucao)

      expect(resultado.error).toContain('ord-2: 429')
      expect(listarOsNormalizadas).toHaveBeenCalledWith({ desde: execucao.desde })
      expect(from).toHaveBeenCalledTimes(1)
      expect(from).toHaveBeenCalledWith('obras_sync_execucao')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'falhou', marca_dagua_nova: null,
      }))
      expect(eq).toHaveBeenCalledWith('id', execucao.id)
    } finally {
      if (chaveAnterior === undefined) delete process.env.FIELD_API_KEY
      else process.env.FIELD_API_KEY = chaveAnterior
    }
  })
})
