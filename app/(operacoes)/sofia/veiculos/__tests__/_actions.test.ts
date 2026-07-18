type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'eq', 'neq', 'limit', 'is']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>
let currentUserEmail: string | null

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUserEmail ? { email: currentUserEmail } : null } })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  atualizarEquipeVeiculoAction,
  enviarParaOficinaAction,
  retornarDaOficinaAction,
  definirSubstitutoAction,
} from '../_actions'

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe('actions de veículo — v04', () => {
  beforeEach(() => {
    currentUserEmail = 'jvictorco28@gmail.com' // admin (lib/auth/admins.ts)
    tableResults = {
      veiculos: { error: null },
      veiculo_responsabilidade_historico: { error: null },
    }
  })

  describe('atualizarEquipeVeiculoAction', () => {
    it('bloqueia usuário não-admin', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: 'e1' }))
      expect(result.error).toBe('Apenas administradores podem editar a equipe do veículo')
    })

    it('bloqueia quando a equipe já está vinculada a outro veículo', async () => {
      tableResults.veiculos = { data: [{ id: 'v2', placa: 'XYZ-9999' }] }
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: 'e1' }))
      expect(result.error).toBe('Equipe já vinculada ao veículo XYZ-9999')
    })

    it('atualiza com sucesso quando a equipe está livre', async () => {
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: 'e1' }))
      expect(result).toEqual({ success: true })
    })

    it('permite desvincular (equipe_id vazio)', async () => {
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: '' }))
      expect(result).toEqual({ success: true })
    })
  })

  describe('enviarParaOficinaAction', () => {
    it('bloqueia usuário não-admin', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      const result = await enviarParaOficinaAction({}, fd({ id: 'v1', previsao_retorno_oficina: '2026-08-01' }))
      expect(result.error).toBe('Apenas administradores podem enviar veículo para oficina')
    })

    it('registra com sucesso', async () => {
      const result = await enviarParaOficinaAction({}, fd({ id: 'v1', previsao_retorno_oficina: '2026-08-01' }))
      expect(result).toEqual({ success: true })
    })
  })

  describe('retornarDaOficinaAction', () => {
    it('bloqueia usuário não-admin', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      const result = await retornarDaOficinaAction({}, fd({ id: 'v1' }))
      expect(result.error).toBe('Apenas administradores podem registrar retorno da oficina')
    })

    it('registra com sucesso', async () => {
      const result = await retornarDaOficinaAction({}, fd({ id: 'v1' }))
      expect(result).toEqual({ success: true })
    })
  })

  describe('definirSubstitutoAction', () => {
    it('bloqueia usuário não-admin', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      const result = await definirSubstitutoAction({}, fd({ id: 'v1', substituto_id: 'v2' }))
      expect(result.error).toBe('Apenas administradores podem definir o veículo substituto')
    })

    it('registra com sucesso', async () => {
      const result = await definirSubstitutoAction({}, fd({ id: 'v1', substituto_id: 'v2' }))
      expect(result).toEqual({ success: true })
    })
  })
})
