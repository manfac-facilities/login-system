// importarRevisoesAction (spec 2026-11-03 §2): só gestor, revalida no servidor, insert único.
const insertMock = jest.fn()
const podeGerirMock = jest.fn()
const getUserMock = jest.fn()
const logAuditMock = jest.fn()
let veiculos: Record<string, unknown>[]
let existentes: Record<string, unknown>[]

function consulta(dados: () => unknown[]) {
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'range']) q[m] = () => q
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: dados(), error: null }).then(ok)
  return q
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn(() => podeGerirMock()),
    from: jest.fn((t: string) =>
      t === 'veiculos' ? consulta(() => veiculos) : { ...consulta(() => existentes), insert: insertMock }),
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }))

import { importarRevisoesAction } from '../_actions'
import { MSG_SEM_PERMISSAO_FROTAS } from '@/lib/sofia/permissoes'
import type { LinhaImportada } from '@/lib/sofia/revisaoImportacao'

const linha = (p: Partial<LinhaImportada>): LinhaImportada => ({
  linha: 2, placa: 'AAA1A11', kmTexto: '', km: 30000, data: '2026-06-01', oficina: 'Beta', valor: 500, pecas: null, obs: null,
  veiculo_id: 'v1', resultado: 'ok', motivo: '', ...p,
})

beforeEach(() => {
  insertMock.mockReset()
  insertMock.mockResolvedValue({ error: null })
  logAuditMock.mockReset()
  getUserMock.mockResolvedValue({ data: { user: { email: 'igor@manfac.com.br' } } })
  podeGerirMock.mockResolvedValue({ data: true, error: null })
  veiculos = [
    { id: 'v1', placa: 'AAA1A11', km_atual: 41000, intervalo_revisao_km: null },
    { id: 'v2', placa: 'BBB2B22', km_atual: 10000, intervalo_revisao_km: 15000 },
  ]
  existentes = [{ veiculo_id: 'v1', km_realizada: 40000 }]
})

describe('importarRevisoesAction', () => {
  it('sem gestor: mensagem padrão e nenhum insert', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await importarRevisoesAction([linha({})], false)).toEqual({ error: MSG_SEM_PERMISSAO_FROTAS })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('lista vazia → "Nenhuma linha para importar"', async () => {
    expect(await importarRevisoesAction([], false)).toEqual({ error: 'Nenhuma linha para importar' })
  })

  it('grava num insert único, com próxima = km + intervalo do carro, origem importacao', async () => {
    const r = await importarRevisoesAction([linha({}), linha({ placa: 'BBB2B22', km: 5000 })], false)
    expect(r).toEqual({ importadas: 2, avisosIncluidos: 0, erros: 0, repetidas: 0 })
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock.mock.calls[0][0]).toEqual([
      expect.objectContaining({ veiculo_id: 'v1', km_realizada: 30000, proxima_km: 40000, origem: 'importacao', tipo: 'preventiva', prever_proxima: true, status: 'em_dia' }),
      expect.objectContaining({ veiculo_id: 'v2', km_realizada: 5000, proxima_km: 20000 }),
    ])
    expect(logAuditMock).toHaveBeenCalledWith('revisoes', 'criou', null, 'Importação de planilha: 2 revisões (0 avisos incluídos, 0 erros e 0 repetidas fora)')
  })

  it('aviso desmarcado não grava o aviso (revalidado no servidor, não confia no "resultado" do navegador)', async () => {
    const r = await importarRevisoesAction([linha({}), linha({ placa: 'BBB2B22', km: 12000, resultado: 'ok' })], false)
    expect(r).toMatchObject({ importadas: 1, avisosIncluidos: 0 })
    expect(insertMock.mock.calls[0][0]).toHaveLength(1)
  })

  it('aviso marcado grava o aviso', async () => {
    const r = await importarRevisoesAction([linha({}), linha({ placa: 'BBB2B22', km: 12000 })], true)
    expect(r).toMatchObject({ importadas: 2, avisosIncluidos: 1 })
  })

  it('repetida no banco não grava; placa inexistente conta como erro', async () => {
    const r = await importarRevisoesAction([linha({ km: 40000 }), linha({ placa: 'ZZZ9Z99' }), linha({})], false)
    expect(r).toEqual({ importadas: 1, avisosIncluidos: 0, erros: 1, repetidas: 1 })
    expect(insertMock.mock.calls[0][0]).toEqual([expect.objectContaining({ km_realizada: 30000 })])
  })

  it('só repetidas → nada a importar, nenhum insert', async () => {
    expect(await importarRevisoesAction([linha({ km: 40000 })], false)).toEqual({ error: 'Nenhuma linha para importar' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('erro no insert: nada gravado, mensagem', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    insertMock.mockResolvedValue({ error: { message: 'x' } })
    expect(await importarRevisoesAction([linha({})], false)).toEqual({ error: 'Erro ao importar as revisões. Nada foi gravado.' })
    expect(logAuditMock).not.toHaveBeenCalled()
  })
})
