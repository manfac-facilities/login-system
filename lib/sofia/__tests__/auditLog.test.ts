let currentUserId: string | null = 'user-1'
let insertMock: jest.Mock

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: currentUserId ? { id: currentUserId } : null },
      })),
    },
    from: jest.fn(() => ({ insert: insertMock })),
  })),
}))

import { logAudit } from '../auditLog'

describe('logAudit', () => {
  beforeEach(() => {
    currentUserId = 'user-1'
    insertMock = jest.fn().mockResolvedValue({ error: null })
  })

  it('grava no audit_log com o formato { tabela, operacao, registro_id, descricao, usuario_id }', async () => {
    await logAudit('multas', 'criou', 'multa-1', 'Multa registrada — excesso de velocidade (2026-07-01)')

    expect(insertMock).toHaveBeenCalledWith({
      tabela: 'multas',
      operacao: 'criou',
      registro_id: 'multa-1',
      descricao: 'Multa registrada — excesso de velocidade (2026-07-01)',
      usuario_id: 'user-1',
    })
  })

  it('usa usuario_id null quando não há usuário autenticado', async () => {
    currentUserId = null

    await logAudit('multas', 'excluiu', 'multa-1', 'Multa excluída — excesso de velocidade')

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: null })
    )
  })

  it('não lança quando o insert retorna erro', async () => {
    insertMock = jest.fn().mockResolvedValue({ error: new Error('db error') })

    await expect(
      logAudit('multas', 'excluiu', 'multa-1', 'Multa excluída — excesso de velocidade')
    ).resolves.toBeUndefined()
  })

  it('não lança quando o cliente supabase lança uma exceção', async () => {
    insertMock = jest.fn().mockRejectedValue(new Error('boom'))

    await expect(
      logAudit('multas', 'atualizou', 'multa-1', 'Multa atualizada')
    ).resolves.toBeUndefined()
  })
})
