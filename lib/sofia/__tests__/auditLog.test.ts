import { registrarAuditoria } from '../auditLog'

describe('registrarAuditoria', () => {
  it('inserts a row with the given fields', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null })
    const supabase = { from: jest.fn(() => ({ insert: insertMock })) } as unknown as Parameters<
      typeof registrarAuditoria
    >[0]

    await registrarAuditoria(supabase, {
      tabela: 'multas',
      registro_id: 'multa-1',
      acao: 'criacao',
      dados: { id: 'multa-1', valor: 100 },
      usuario_email: 'joao@manfac.com.br',
    })

    expect(supabase.from).toHaveBeenCalledWith('audit_log')
    expect(insertMock).toHaveBeenCalledWith({
      tabela: 'multas',
      registro_id: 'multa-1',
      acao: 'criacao',
      dados: { id: 'multa-1', valor: 100 },
      usuario_email: 'joao@manfac.com.br',
    })
  })

  it('throws when the insert fails', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: new Error('db error') })
    const supabase = { from: jest.fn(() => ({ insert: insertMock })) } as unknown as Parameters<
      typeof registrarAuditoria
    >[0]

    await expect(
      registrarAuditoria(supabase, {
        tabela: 'multas',
        registro_id: 'multa-1',
        acao: 'exclusao',
        dados: {},
        usuario_email: null,
      })
    ).rejects.toThrow()
  })
})
