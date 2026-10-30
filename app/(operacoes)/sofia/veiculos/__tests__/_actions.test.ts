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
let chains: Record<string, ReturnType<typeof makeChainable>> = {}
const podeGerirMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => {
      if (!chains[table]) chains[table] = makeChainable(tableResults[table])
      return chains[table]
    }),
    rpc: jest.fn((fn: string) =>
      fn === 'sofia_pode_gerir' ? podeGerirMock() : Promise.reject(new Error(`rpc inesperada: ${fn}`))
    ),
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUserEmail ? { email: currentUserEmail } : null } })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  atualizarEquipeVeiculoAction,
  atualizarLocacaoVeiculoAction,
  enviarParaOficinaAction,
  retornarDaOficinaAction,
  definirSubstitutoAction,
} from '../_actions'

const PODE = { data: true, error: null }
const NAO_PODE = { data: false, error: null }
const ERRO_RPC = { data: true, error: { message: 'x' } }

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe('actions de veículo — v04', () => {
  beforeEach(() => {
    currentUserEmail = 'igor@manfac.com.br' // gestor de frotas (sofia_pode_gerir = true)
    tableResults = {
      veiculos: { error: null },
      veiculo_responsabilidade_historico: { error: null },
    }
    chains = {}
    ;podeGerirMock.mockReset()
    ;podeGerirMock.mockResolvedValue(PODE)
  })

  describe('atualizarEquipeVeiculoAction', () => {
    it('bloqueia quem não pode gerir frotas', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      ;podeGerirMock.mockResolvedValue(NAO_PODE)
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: 'e1' }))
      expect(result.error).toBe('Apenas administradores ou gestores de frotas podem editar a equipe do veículo')
      expect(chains.veiculos).toBeUndefined()
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

  describe('atualizarLocacaoVeiculoAction', () => {
    beforeEach(() => {
      chains.veiculos = makeChainable(tableResults.veiculos)
    })

    it('lança erro quando o usuário não pode gerir frotas', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      ;podeGerirMock.mockResolvedValue(NAO_PODE)

      await expect(
        atualizarLocacaoVeiculoAction(fd({ id: 'v1', valor_locacao_mensal: '1500' }))
      ).rejects.toThrow('Apenas administradores ou gestores de frotas podem executar esta ação')
      expect(chains.veiculos.update).not.toHaveBeenCalled()
    })

    it('gestor de frotas altera o valor de locação', async () => {
      await expect(
        atualizarLocacaoVeiculoAction(fd({ id: 'v1', valor_locacao_mensal: '1500' }))
      ).resolves.toBeUndefined()
      expect(chains.veiculos.update).toHaveBeenCalledWith({ valor_locacao_mensal: 1500 })
    })
  })

  describe('enviarParaOficinaAction', () => {
    it('bloqueia quem não pode gerir frotas', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      ;podeGerirMock.mockResolvedValue(NAO_PODE)
      const result = await enviarParaOficinaAction({}, fd({ id: 'v1', previsao_retorno_oficina: '2026-08-01' }))
      expect(result.error).toBe('Apenas administradores ou gestores de frotas podem enviar veículo para oficina')
      expect(chains.veiculos).toBeUndefined()
    })

    it('registra com sucesso', async () => {
      const result = await enviarParaOficinaAction({}, fd({ id: 'v1', previsao_retorno_oficina: '2026-08-01' }))
      expect(result).toEqual({ success: true })
    })

    it('retorna erro quando falha ao fechar o histórico de responsabilidade', async () => {
      tableResults.veiculo_responsabilidade_historico = { error: { message: 'falhou' } }
      const result = await enviarParaOficinaAction({}, fd({ id: 'v1', previsao_retorno_oficina: '2026-08-01' }))
      expect(result).toEqual({ error: 'Erro ao enviar veículo para oficina' })
    })
  })

  describe('retornarDaOficinaAction', () => {
    it('bloqueia quem não pode gerir frotas', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      ;podeGerirMock.mockResolvedValue(NAO_PODE)
      const result = await retornarDaOficinaAction({}, fd({ id: 'v1' }))
      expect(result.error).toBe('Apenas administradores ou gestores de frotas podem registrar retorno da oficina')
      expect(chains.veiculos).toBeUndefined()
    })

    it('registra com sucesso', async () => {
      const result = await retornarDaOficinaAction({}, fd({ id: 'v1' }))
      expect(result).toEqual({ success: true })
    })
  })

  describe('definirSubstitutoAction', () => {
    it('bloqueia quem não pode gerir frotas', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      ;podeGerirMock.mockResolvedValue(NAO_PODE)
      const result = await definirSubstitutoAction({}, fd({ id: 'v1', substituto_id: 'v2' }))
      expect(result.error).toBe('Apenas administradores ou gestores de frotas podem definir o veículo substituto')
      expect(chains.veiculos).toBeUndefined()
    })

    it('registra com sucesso', async () => {
      const result = await definirSubstitutoAction({}, fd({ id: 'v1', substituto_id: 'v2' }))
      expect(result).toEqual({ success: true })
    })
  })

  describe('erro na RPC sofia_pode_gerir nega (falha fechado)', () => {
    beforeEach(() => {
      podeGerirMock.mockResolvedValue(ERRO_RPC)
    })

    it.each([
      ['atualizarEquipeVeiculoAction', () => atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: 'e1' }))],
      ['enviarParaOficinaAction', () => enviarParaOficinaAction({}, fd({ id: 'v1' }))],
      ['retornarDaOficinaAction', () => retornarDaOficinaAction({}, fd({ id: 'v1' }))],
      ['definirSubstitutoAction', () => definirSubstitutoAction({}, fd({ id: 'v1', substituto_id: 'v2' }))],
    ])('%s', async (_n, chamar) => {
      const result = await chamar()
      expect(result.error).toMatch(/^Apenas administradores ou gestores de frotas podem /)
      expect(chains.veiculos).toBeUndefined()
      expect(chains.veiculo_responsabilidade_historico).toBeUndefined()
    })

    it('atualizarLocacaoVeiculoAction', async () => {
      await expect(
        atualizarLocacaoVeiculoAction(fd({ id: 'v1', valor_locacao_mensal: '1500' }))
      ).rejects.toThrow('Apenas administradores ou gestores de frotas podem executar esta ação')
      expect(chains.veiculos).toBeUndefined()
    })
  })
})
