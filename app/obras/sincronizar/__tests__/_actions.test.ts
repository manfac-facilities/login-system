/**
 * Testes da Server Action de sincronização.
 *
 * Nenhum teste daqui faz chamada de rede nem toca banco: o cliente do Field e o
 * client do Supabase são dublês. O que está sob teste é a costura — quem pode
 * rodar, o que acontece sem chave, o que é gravado e o que o relatório conta.
 */

const getUserMock = jest.fn()
const selectRangeMock = jest.fn()
const selectOrderMock = jest.fn(() => ({ range: selectRangeMock }))
const selectMock = jest.fn(() => ({ order: selectOrderMock }))
const insertMock = jest.fn()
const updateEqMock = jest.fn()
const updateMock = jest.fn(() => ({ eq: updateEqMock }))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({
      select: selectMock,
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
const consultarSituacaoDaOrdem = jest.fn()

function osDoField(over: Partial<OsNormalizada> = {}): OsNormalizada {
  return {
    os: '0226-014989',
    descricao: 'Forro do estoque caiu',
    loja: 'Av. Paulista, 1000',
    idField: 'ord-1',
    atualizadoEm: '2026-09-11T12:00:00Z',
    archived: false,
    ...over,
  }
}

function obraDoBanco(indice: number, over: Record<string, unknown> = {}) {
  return {
    id: `obra-${indice}`,
    os: `OS-${indice}`,
    loja: 'Av. Paulista, 1000',
    descricao: 'Forro do estoque caiu',
    fonte: 'field',
    field_id: `ord-${indice}`,
    field_ausente_desde: null,
    field_ausente_em: null,
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
    consultarSituacaoDaOrdem,
  })
  listarOsNormalizadas.mockResolvedValue([])
  consultarSituacaoDaOrdem.mockResolvedValue({
    situacao: 'inconclusiva',
  })
  selectRangeMock.mockResolvedValue({ data: [], error: null })
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
      {
        os: '0226-014989',
        loja: 'Av. Paulista, 1000',
        descricao: 'Forro do estoque caiu',
        fonte: 'field',
        field_id: 'ord-1',
        etapa: 'definir',
      },
    ])
    expect(updateMock).not.toHaveBeenCalled()
    expect(estado.relatorio).toMatchObject({ totalDoField: 1, novas: 1, atualizadas: 0, inalteradas: 0 })
  })

  it('atualiza só o campo vazio de obra que já existe', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField()])
    selectRangeMock.mockResolvedValue({
      data: [{ id: 'obra-1', os: '0226-014989', loja: 'DROGARIA SP', descricao: null, fonte: 'field', field_id: 'ord-1', field_ausente_desde: null, field_ausente_em: null }],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith({ descricao: 'Forro do estoque caiu' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'obra-1')
    expect(estado.relatorio).toMatchObject({ novas: 0, atualizadas: 1, inalteradas: 0 })
  })

  it('lê e carimba a fonte quando o Field encontra uma obra de procedência desconhecida', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField()])
    selectRangeMock.mockResolvedValue({
      data: [{ id: 'obra-1', os: '0226-014989', loja: 'DROGARIA SP', descricao: 'Reforma', fonte: null, field_id: null, field_ausente_desde: null, field_ausente_em: null }],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(selectMock).toHaveBeenCalledWith(
      'id, os, loja, descricao, fonte, field_id, field_ausente_desde, field_ausente_em',
    )
    expect(updateMock).toHaveBeenCalledWith({ fonte: 'field', field_id: 'ord-1' })
    expect(estado.relatorio).toMatchObject({ novas: 0, atualizadas: 1, inalteradas: 0 })
  })

  it('não grava nada quando a obra já existe completa', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField()])
    selectRangeMock.mockResolvedValue({
      data: [{ id: 'obra-1', os: '0226-014989', loja: 'DROGARIA SP', descricao: 'Reforma', fonte: 'field', field_id: 'ord-1', field_ausente_desde: null, field_ausente_em: null }],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(estado.relatorio).toMatchObject({ novas: 0, atualizadas: 0, inalteradas: 1 })
  })

  it('atualiza o número da mesma obra pelo field_id e relata a correção', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField({ os: '0226-999999' })])
    selectRangeMock.mockResolvedValue({
      data: [
        {
          id: 'obra-1',
          os: '0226-014989',
          loja: 'DROGARIA SP',
          descricao: 'Reforma',
          fonte: 'field',
          field_id: 'ord-1',
          field_ausente_desde: null,
          field_ausente_em: null,
        },
      ],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith({ os: '0226-999999' })
    expect(estado.relatorio?.numerosDeOsAlterados).toEqual([
      {
        obraId: 'obra-1',
        idField: 'ord-1',
        anterior: '0226-014989',
        atual: '0226-999999',
      },
    ])
    expect(estado.relatorio?.novosAlertasDeAusencia).toBe(0)
  })

  it('consulta a ordem antiga e herda o histórico quando ela está arquivada', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField({ idField: 'ord-nova' })])
    consultarSituacaoDaOrdem.mockResolvedValue({ situacao: 'arquivada' })
    selectRangeMock.mockResolvedValue({
      data: [
        obraDoBanco(1, {
          os: '0226-014989',
          field_id: 'ord-antiga',
          field_ausente_desde: '2026-09-12T12:00:00Z',
          field_ausente_em: '2026-09-13T12:00:00Z',
        }),
      ],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(consultarSituacaoDaOrdem).toHaveBeenCalledWith('ord-antiga')
    expect(updateMock).toHaveBeenCalledWith({
      field_id: 'ord-nova',
      field_ausente_desde: null,
      field_ausente_em: null,
    })
    expect(estado.relatorio?.historicosHerdados).toEqual([
      {
        obraId: 'obra-1',
        os: '0226-014989',
        idFieldAnterior: 'ord-antiga',
        idFieldAtual: 'ord-nova',
      },
    ])
    expect(estado.relatorio?.alertasRemovidos).toBe(1)
  })

  it('falha ao consultar a antiga não herda e o motivo chega ao relatório', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField({ idField: 'ord-nova' })])
    consultarSituacaoDaOrdem.mockRejectedValue(new Error('Field indisponível'))
    selectRangeMock.mockResolvedValue({
      data: [obraDoBanco(1, { os: '0226-014989', field_id: 'ord-antiga' })],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ field_id: 'ord-nova' }))
    expect(estado.relatorio?.historicosHerdados).toHaveLength(0)
    expect(estado.relatorio?.ignoradas[0].motivo).toContain(
      'falha inesperada ao consultar a ordem antiga',
    )
  })

  it('field_id antigo na listagem bloqueia consulta e herança', async () => {
    listarOsNormalizadas.mockResolvedValue([
      osDoField({ os: 'OS-300', idField: 'ord-antiga', archived: true }),
      osDoField({ idField: 'ord-nova' }),
    ])
    selectRangeMock.mockResolvedValue({
      data: [obraDoBanco(1, { os: '0226-014989', field_id: 'ord-antiga' })],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(consultarSituacaoDaOrdem).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ field_id: 'ord-nova' }))
    expect(estado.relatorio?.historicosHerdados).toHaveLength(0)
    expect(estado.relatorio?.ignoradas[0].motivo).toMatch(/veio na mesma varredura/i)
  })

  it('leva o motivo da consulta ao relatório sem categorizá-lo', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField({ idField: 'ord-nova' })])
    consultarSituacaoDaOrdem.mockResolvedValue({
      situacao: 'inconclusiva',
      motivo: 'Field Control respondeu 422',
    })
    selectRangeMock.mockResolvedValue({
      data: [obraDoBanco(1, { os: '0226-014989', field_id: 'ord-antiga' })],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(estado.relatorio?.historicosHerdados).toHaveLength(0)
    expect(estado.relatorio?.ignoradas[0].motivo).toContain('Field Control respondeu 422')
  })

  it('registra a primeira ausência sem apagar nem esconder a obra', async () => {
    const presentes = Array.from({ length: 5 }, (_, indice) => obraDoBanco(indice + 2))
    listarOsNormalizadas.mockResolvedValue(
      presentes.map((obra) => osDoField({ os: obra.os, idField: obra.field_id })),
    )
    selectRangeMock.mockResolvedValue({
      data: [obraDoBanco(1), ...presentes],
      error: null,
    })

    const estado = await sincronizarComFieldAction()

    expect(updateMock).toHaveBeenCalledWith({ field_ausente_desde: expect.any(String) })
    expect(estado.relatorio?.suspeitasDeAusencia).toBe(1)
    expect(estado.relatorio?.novosAlertasDeAusencia).toBe(0)
  })

  it('ignora a OS sem número, com motivo no relatório', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField({ os: '', idField: 'ord-9' })])

    const estado = await sincronizarComFieldAction()

    expect(insertMock).not.toHaveBeenCalled()
    expect(estado.relatorio?.ignoradas).toHaveLength(1)
    expect(estado.relatorio?.ignoradas[0].motivo).toMatch(/sem número/i)
  })

  it('consulta o banco mesmo quando o Field não devolve nada, pois a lista vazia pode indicar ausência', async () => {
    listarOsNormalizadas.mockResolvedValue([])
    selectRangeMock.mockResolvedValue({ data: [obraDoBanco(1)], error: null })

    const estado = await sincronizarComFieldAction()

    expect(selectRangeMock).toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
    expect(estado.relatorio).toEqual({
      totalDoField: 0,
      novas: 0,
      atualizadas: 0,
      inalteradas: 0,
      suspeitasDeAusencia: 0,
      novosAlertasDeAusencia: 0,
      alertasRemovidos: 0,
      numerosDeOsAlterados: [],
      historicosHerdados: [],
      ignoradas: [],
      avisos: [
        'Varredura suspeita: o Field devolveu 0 OS. Nenhuma ausência foi registrada.',
      ],
    })
  })

  it('bloqueia ausência em massa e leva o aviso ao relatório', async () => {
    const existentes = Array.from({ length: 10 }, (_, indice) => obraDoBanco(indice + 1))
    listarOsNormalizadas.mockResolvedValue(
      existentes
        .slice(0, 3)
        .map((obra) => osDoField({ os: obra.os, idField: obra.field_id })),
    )
    selectRangeMock.mockResolvedValue({ data: existentes, error: null })

    const estado = await sincronizarComFieldAction()

    expect(updateMock).not.toHaveBeenCalled()
    expect(estado.relatorio?.suspeitasDeAusencia).toBe(0)
    expect(estado.relatorio?.avisos[0]).toMatch(/limite de segurança/i)
  })

  it('não grava nada quando a leitura do banco falha', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField()])
    selectRangeMock.mockResolvedValue({ data: null, error: { message: 'RLS denied' } })

    const estado = await sincronizarComFieldAction()

    expect(estado.error).toBeDefined()
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('só considera a leitura completa depois de percorrer todas as páginas do banco', async () => {
    const paginaCheia = Array.from({ length: 1000 }, (_, indice) => ({
      id: `obra-${indice}`,
      os: `OS-${indice}`,
      loja: null,
      descricao: null,
      fonte: null,
      field_id: null,
      field_ausente_desde: null,
      field_ausente_em: null,
    }))
    selectRangeMock
      .mockResolvedValueOnce({ data: paginaCheia, error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    await sincronizarComFieldAction()

    expect(selectRangeMock).toHaveBeenNthCalledWith(1, 0, 999)
    expect(selectRangeMock).toHaveBeenNthCalledWith(2, 1000, 1999)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('registra no relatório a obra que o banco recusou atualizar, sem derrubar o resto', async () => {
    listarOsNormalizadas.mockResolvedValue([osDoField(), osDoField({ os: 'OS-NOVA', idField: 'ord-2' })])
    selectRangeMock.mockResolvedValue({
      data: [{ id: 'obra-1', os: '0226-014989', loja: null, descricao: null, fonte: 'field', field_id: 'ord-1', field_ausente_desde: null, field_ausente_em: null }],
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
    expect(selectRangeMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })
})
