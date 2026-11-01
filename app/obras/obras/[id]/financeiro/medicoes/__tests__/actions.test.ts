import { criarFalso, type Falso } from '../../../../_lib/__tests__/fixtures/supabase-falso'

let f: Falso
const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => f.cliente(getUserMock)) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async (_s: unknown, e: string) => e === 'adm@manfac.com.br') }))
jest.mock('../../../../_lib/leitura', () => ({
  lerObraGrande: jest.fn(async () => ({ ok: true, dados: { calc: { realizado: 52.345 } } })),
}))

import { apagarMedicaoAction, mudarSituacaoMedicaoAction, salvarMedicaoAction } from '../_actions'
import type { MedicaoEntrada } from '../_tipos'

const MAE = '11111111-1111-4111-8111-111111111111'
const FILHA = '22222222-2222-4222-8222-222222222222'
const OUTRA = '33333333-3333-4333-8333-333333333333'
const M1 = '55555555-5555-4555-8555-555555555555'
const como = (email: string) => getUserMock.mockResolvedValue({ data: { user: { email } } })
const med = (over: Partial<MedicaoEntrada> = {}): MedicaoEntrada => ({
  osId: MAE, inicio: '2026-11-01', fim: '2026-11-30', percentualCentesimos: 1000, valorCentavos: 4_377_724, ...over,
})

beforeEach(() => {
  f = criarFalso()
  f.db.obras_obra = [
    { id: MAE, modalidade: 'obra', obra_pai_id: null, engenheiro_email: 'eng@manfac.com.br', valor: 437772.41 },
    { id: FILHA, modalidade: 'obra', obra_pai_id: MAE, engenheiro_email: null, valor: 38500 },
    { id: OUTRA, modalidade: 'obra', obra_pai_id: null, engenheiro_email: 'outro@manfac.com.br', valor: 1000 },
  ]
  f.db.obras_medicao_cliente = []
  como('eng@manfac.com.br')
})

describe('quem registra medição ao cliente', () => {
  it.each(['sup@manfac.com.br', 'outro@manfac.com.br', 'fin@manfac.com.br'])('%s (não é engenheiro desta obra nem admin) → recusado, nada gravado', async (e) => {
    como(e)
    const r = await salvarMedicaoAction(MAE, med())
    expect(r).toEqual({ ok: false, erro: 'Só o engenheiro da obra (ou da obra mãe) ou um administrador registra medição ao cliente' })
    expect(f.db.obras_medicao_cliente).toHaveLength(0)
  })
  it('engenheiro da obra grava; nasce enviada com o avanço do dia (centésimos)', async () => {
    expect(await salvarMedicaoAction(MAE, med())).toEqual({ ok: true })
    expect(f.db.obras_medicao_cliente[0]).toMatchObject({
      obra_id: MAE, periodo_inicio: '2026-11-01', periodo_fim: '2026-11-30', percentual_centesimos: 1000, valor_centavos: 4_377_724, situacao: 'enviada', avanco_centesimos: 5235,
    })
  })
  it('engenheiro da mãe grava no aditivo; admin grava em qualquer OS da obra', async () => {
    expect(await salvarMedicaoAction(MAE, med({ osId: FILHA, percentualCentesimos: 5000, valorCentavos: 1_925_000 }))).toEqual({ ok: true })
    como('adm@manfac.com.br')
    expect(await salvarMedicaoAction(MAE, med())).toEqual({ ok: true })
  })
  it('OS de outra obra é recusada mesmo para admin', async () => {
    como('adm@manfac.com.br')
    expect(await salvarMedicaoAction(MAE, med({ osId: OUTRA, percentualCentesimos: 1000, valorCentavos: 10_000 }))).toEqual({ ok: false, erro: 'OS não encontrada nesta obra' })
  })
  it('mudar situação e apagar seguem a mesma guarda; apagar só admin', async () => {
    f.db.obras_medicao_cliente.push({ id: M1, obra_id: MAE, situacao: 'enviada' })
    como('sup@manfac.com.br')
    expect((await mudarSituacaoMedicaoAction(MAE, MAE, M1, 'aprovada')).ok).toBe(false)
    como('eng@manfac.com.br')
    expect(await apagarMedicaoAction(MAE, MAE, M1)).toEqual({ ok: false, erro: 'Só administrador apaga medição ao cliente' })
    expect(await mudarSituacaoMedicaoAction(MAE, MAE, M1, 'aprovada')).toEqual({ ok: true })
    expect(f.db.obras_medicao_cliente[0].situacao).toBe('aprovada')
  })
})

describe('% ⇄ valor e regras de dinheiro', () => {
  it('% e valor que não batem com o valor receita → recusado', async () => {
    const r = await salvarMedicaoAction(MAE, med({ valorCentavos: 5_000_000 }))
    expect(r).toEqual({ ok: false, erro: 'O % e o valor não batem com o valor receita da OS — digite um deles de novo' })
  })
  it('quem digitou o valor (% arredondado a 2 casas) passa', async () => {
    // 52.532,69 → 12,00%
    expect(await salvarMedicaoAction(MAE, med({ percentualCentesimos: 1200, valorCentavos: 5_253_269 }))).toEqual({ ok: true })
  })
  it('OS sem valor receita → pede o valor receita em Dados da obra', async () => {
    f.db.obras_obra[0].valor = null
    expect(await salvarMedicaoAction(MAE, med())).toEqual({ ok: false, erro: 'Informe o valor receita desta OS em Dados da obra antes de registrar a medição' })
  })
  it('período invertido e % fora de 0,01..100 → recusado', async () => {
    expect((await salvarMedicaoAction(MAE, med({ inicio: '2026-11-30', fim: '2026-11-01' }))).ok).toBe(false)
    expect((await salvarMedicaoAction(MAE, med({ percentualCentesimos: 10001, valorCentavos: 43_781_618 }))).ok).toBe(false)
  })
  it('soma > 100% recusada pelo banco aparece em pt-BR', async () => {
    f.erroEscrita.obras_medicao_cliente = {
      code: '23514',
      message: 'OBRAS_MEDICAO_CLIENTE: a soma das liberações desta OS passaria de 100% (já há 95.00%, esta tem 10.00%)',
    }
    expect(await salvarMedicaoAction(MAE, med())).toEqual({ ok: false, erro: 'A soma das liberações desta OS passaria de 100% (já há 95,00%, esta tem 10,00%)' })
  })
  it('medição com nota: o erro do banco aparece em pt-BR', async () => {
    f.db.obras_medicao_cliente.push({ id: M1, obra_id: MAE, situacao: 'aprovada' })
    como('adm@manfac.com.br')
    f.erroEscrita.obras_medicao_cliente = { code: 'P0001', message: 'OBRAS_MEDICAO_CLIENTE: medição com nota emitida não se apaga — desligue a nota no Financeiro antes' }
    expect(await apagarMedicaoAction(MAE, MAE, M1)).toEqual({ ok: false, erro: 'Medição com nota emitida não se apaga — desligue a nota no Financeiro antes' })
  })
})

describe('restante da OS e OS cancelada (fix 1)', () => {
  beforeEach(() => {
    f.db.obras_obra[0].valor = 30000 // R$ 30.000,00
    f.db.obras_medicao_cliente = [
      { id: 'a', obra_id: MAE, situacao: 'aprovada', percentual_centesimos: 3333, valor_centavos: 1_000_000 },
      { id: 'b', obra_id: MAE, situacao: 'enviada', percentual_centesimos: 3333, valor_centavos: 1_000_000 },
      { id: 'c', obra_id: MAE, situacao: 'recusada', percentual_centesimos: 9000, valor_centavos: 2_700_000 },
    ]
  })
  it('"usar o restante" (33,34% e R$ 10.000,00) passa, mesmo sem ser o arredondamento um do outro', async () => {
    expect(await salvarMedicaoAction(MAE, med({ percentualCentesimos: 3334, valorCentavos: 1_000_000 }))).toEqual({ ok: true })
  })
  it('valor acima do restante em R$ é recusado com o restante na mensagem', async () => {
    expect(await salvarMedicaoAction(MAE, med({ percentualCentesimos: 3334, valorCentavos: 1_000_100 }))).toEqual({
      ok: false, erro: 'O valor passa do restante da OS (R$ 10.000,00, 33,34%)',
    })
  })
  it('OS cancelada não recebe medição', async () => {
    f.db.obras_obra[1].cancelado_em = '2026-10-30T12:00:00Z'
    expect(await salvarMedicaoAction(MAE, med({ osId: FILHA, percentualCentesimos: 5000, valorCentavos: 1_925_000 }))).toEqual({ ok: false, erro: 'Esta OS foi cancelada: não recebe medição' })
  })
})
