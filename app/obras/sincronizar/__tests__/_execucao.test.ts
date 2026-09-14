/** @jest-environment node */

import { prepararExecucao } from '../_execucao'

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
