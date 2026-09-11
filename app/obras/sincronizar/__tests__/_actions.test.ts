/**
 * Testes da Server Action de sincronização.
 *
 * Nenhum teste daqui faz chamada de rede nem toca banco: o cliente do Field e o
 * client do Supabase são dublês. O que está sob teste é a costura — quem pode
 * rodar, o que acontece sem chave, o que é gravado e o que o relatório conta.
 */

const getUserMock = jest.fn()
const selectInMock = jest.fn()
const insertMock = jest.fn()
const updateEqMock = jest.fn()
const updateMock = jest.fn(() => ({ eq: updateEqMock }))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ in: selectInMock })),
      insert: insertMock,
      update: updateMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../../_lib/field', () => ({ criarClienteField: jest.fn() }))

import { isAdmin } from '@/lib/auth/roles'
import { criarClienteField, type OsNormalizada } from '../../_lib/field'
import { sincronizarComFieldAction } from '../_actions'

const CHAVE_FALSA = 'chave-de-teste-sem-valor-real'

const listarOsNormalizadas = jest.fn()

function osDoField(over: Partial<OsNormalizada> = {}): OsNormalizada {
  return {
    os: '0226-014989',
    descricao: 'Forro do estoque caiu',
    loja: 'Av. Paulista, 1000',
    idField: 'ord-1',
    atualizadoEm: '2026-09-11T12:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FIELD_API_KEY = CHAVE_FALSA
  getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'joao@manfac.com.br' } } })
  ;(isAdmin as jest.Mock).mockResolvedValue(true)
  ;(criarClienteField as jest.Mock).mockReturnValue({
    resolverIdDoTipoDeOs: jest.fn(),
    listarOsNormalizadas,
  })
  listarOsNormalizadas.mockResolvedValue([])
  selectInMock.mockResolvedValue({ data: [], error: null })
  insertMock.mockResolvedValue({ error: null })
  updateEqMock.mockResolvedValue({ error: null })
})

afterEach(() => {
  delete process.env.FIELD_API_KEY
})

describe('sincronizarComFieldAction — porteiro', () => {
  it('recusa quem não está logado', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const estado = await sincronizarComFieldAction()
    expect(estado.error).toMatch(/sess/i)
    expect(criarClienteField).not.toHaveBeenCalled()
  })

  it('recusa quem não é administrador do hub', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    const estado = await sincronizarComFieldAction()
    expect(estado.error).toMatch(/administradores/i)
    expect(criarClienteField).not.toHaveBeenCalled()
  })
})

describe('sincronizarComFieldAction — chave da API', () => {
  it('devolve erro claro e não chama o Field quando FIELD_API_KEY não existe', async () => {
    delete process.env.FIELD_API_KEY
    const estado = await sincronizarComFieldAction()

    expect(estado.relatorio).toBeUndefined()
    expect(estado.error).toContain('FIELD_API_KEY')
    expect(criarClienteField).not.toHaveBeenCalled()
  })

  it('trata chave em branco como chave ausente', async () => {
    process.env.FIELD_API_KEY = '   '
    const estado = await sincronizarComFieldAction()

    expect(estado.error).toContain('FIELD_API_KEY')
    expect(criarClienteField).not.toHaveBeenCalled()
  })

  it('nunca devolve o valor da chave na mensagem de erro', async () => {
    listarOsNormalizadas.mockRejectedValue(new Error('Field Control respondeu 401 em GET /orders'))
    const estado = await sincronizarComFieldAction()

    expect(estado.error).toBeDefined()
    expect(estado.error).not.toContain(CHAVE_FALSA)
  })
})

describe('sincronizarComFieldAction — gravação', () => {
  it('insere a obra nova e conta no relatório', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField()])

    const estado = await sincronizarComFieldAction()

    expect(insertMock).toHaveBeenCalledWith([
      { os: '0226-014989', loja: 'Av. Paulista, 1000', descricao: 'Forro do estoque caiu', etapa: 'definir' },
    ])
    expect(updateMock).not.toHaveBeenCalled()
    expect(estado.relatorio).toMatchObject({ totalDoField: 1, novas: 1, atualizadas: 0, inalteradas: 0 })
  })

  it('atualiza só o campo vazio de obra que já existe', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField()])
    selectInMock.mockResolvedValue({
      data: [{ id: 'obra-1', os: '0226-014989', loja: 'DROGARIA SP', descricao: null }],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith({ descricao: 'Forro do estoque caiu' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'obra-1')
    expect(estado.relatorio).toMatchObject({ novas: 0, atualizadas: 1, inalteradas: 0 })
  })

  it('não grava nada quando a obra já existe completa', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField()])
    selectInMock.mockResolvedValue({
      data: [{ id: 'obra-1', os: '0226-014989', loja: 'DROGARIA SP', descricao: 'Reforma' }],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(estado.relatorio).toMatchObject({ novas: 0, atualizadas: 0, inalteradas: 1 })
  })

  it('ignora a OS sem número, com motivo no relatório', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField({ os: '', idField: 'ord-9' })])

    const estado = await sincronizarComFieldAction()

    expect(insertMock).not.toHaveBeenCalled()
    expect(estado.relatorio?.ignoradas).toHaveLength(1)
    expect(estado.relatorio?.ignoradas[0].motivo).toMatch(/sem número/i)
  })

  it('não consulta o banco nem grava quando o Field não devolve nada', async () => {
    listarOsNormalizadas.mockResolvedValue([])

    const estado = await sincronizarComFieldAction()

    expect(selectInMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(estado.relatorio).toEqual({
      totalDoField: 0,
      novas: 0,
      atualizadas: 0,
      inalteradas: 0,
      ignoradas: [],
    })
  })

  it('não grava nada quando a leitura do banco falha', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField()])
    selectInMock.mockResolvedValue({ data: null, error: { message: 'RLS denied' } })

    const estado = await sincronizarComFieldAction()

    expect(estado.error).toBeDefined()
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('registra no relatório a obra que o banco recusou atualizar, sem derrubar o resto', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField(), osDoField({ os: 'OS-NOVA', idField: 'ord-2' })])
    selectInMock.mockResolvedValue({
      data: [{ id: 'obra-1', os: '0226-014989', loja: null, descricao: null }],
      error: null,
    })
    updateEqMock.mockResolvedValue({ error: { message: 'coluna inexistente' } })

    const estado = await sincronizarComFieldAction()

    expect(estado.relatorio?.atualizadas).toBe(0)
    expect(estado.relatorio?.novas).toBe(1)
    expect(estado.relatorio?.ignoradas[0].motivo).toMatch(/coluna inexistente/)
  })

  it('devolve mensagem legível quando o Field falha, sem lançar', async () => {
    listarOsNormalizadas.mockRejectedValue(new Error('Field Control respondeu 500 em GET /orders'))

    const estado = await sincronizarComFieldAction()

    expect(estado.relatorio).toBeUndefined()
    expect(estado.error).toContain('Field Control respondeu 500')
  })
})
