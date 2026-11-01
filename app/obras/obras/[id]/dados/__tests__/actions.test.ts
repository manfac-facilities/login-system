import { criarFalso, type Falso } from '../../../_lib/__tests__/fixtures/supabase-falso'

let f: Falso
const getUserMock = jest.fn()
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(async () => f.cliente(getUserMock)) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn(async () => true) }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn(async (_s: unknown, e: string) => e === 'adm@manfac.com.br') }))

import { moverPessoaAction, removerPessoaAction, salvarPessoaAction, salvarValorReceitaAction } from '../_actions'
import { salvarDestinatarioAction } from '../../configuracoes/_actions'
import { destinatarioAposChip, estadoChips } from '../../../_lib/organograma'

const MAE = '11111111-1111-4111-8111-111111111111'
const FILHA = '22222222-2222-4222-8222-222222222222'
const OUTRA = '33333333-3333-4333-8333-333333333333'
const P1 = '44444444-4444-4444-8444-444444444444'
const como = (email: string) => getUserMock.mockResolvedValue({ data: { user: { email } } })

beforeEach(() => {
  f = criarFalso()
  f.db.obras_obra = [
    { id: MAE, modalidade: 'obra', obra_pai_id: null, valor: null },
    { id: FILHA, modalidade: 'obra', obra_pai_id: MAE, valor: null },
    { id: OUTRA, modalidade: 'obra', obra_pai_id: null, valor: 100 },
  ]
  f.db.obras_cliente_pessoa = []
  f.db.obras_destinatario = []
  como('adm@manfac.com.br')
})

describe('valor receita (só admin, server-checked)', () => {
  it('engenheiro/supervisor não grava — e nada muda', async () => {
    como('eng@manfac.com.br')
    expect(await salvarValorReceitaAction(MAE, MAE, '437.772,41')).toEqual({ ok: false, erro: 'Só administrador altera os dados da obra' })
    expect(f.db.obras_obra[0].valor).toBeNull()
  })
  it('admin grava em REAIS na OS mãe e no aditivo', async () => {
    expect(await salvarValorReceitaAction(MAE, MAE, '437.772,41')).toEqual({ ok: true })
    expect(await salvarValorReceitaAction(MAE, FILHA, '38500')).toEqual({ ok: true })
    expect(f.db.obras_obra[0].valor).toBe(437772.41)
    expect(f.db.obras_obra[1].valor).toBe(38500)
  })
  it('vazio apaga; inválido ou OS de outra obra recusa', async () => {
    f.db.obras_obra[0].valor = 10
    expect(await salvarValorReceitaAction(MAE, MAE, '  ')).toEqual({ ok: true })
    expect(f.db.obras_obra[0].valor).toBeNull()
    expect((await salvarValorReceitaAction(MAE, MAE, 'mil')).ok).toBe(false)
    expect((await salvarValorReceitaAction(MAE, MAE, '0')).ok).toBe(false)
    expect(await salvarValorReceitaAction(MAE, OUTRA, '5,00')).toEqual({ ok: false, erro: 'OS não encontrada nesta obra' })
    expect(f.db.obras_obra[2].valor).toBe(100)
  })
})

describe('organograma (só admin)', () => {
  it('não admin não adiciona, não remove, não reordena', async () => {
    f.db.obras_cliente_pessoa.push({ id: P1, obra_id: MAE, nome: 'Ana', ordem: 0 })
    como('eng@manfac.com.br')
    expect((await salvarPessoaAction(MAE, { nome: 'Bia', cargo: null, email: null })).ok).toBe(false)
    expect((await removerPessoaAction(MAE, P1)).ok).toBe(false)
    expect((await moverPessoaAction(MAE, P1, 'baixo')).ok).toBe(false)
    expect(f.db.obras_cliente_pessoa).toHaveLength(1)
  })
  it('admin adiciona no fim, normaliza e-mail, cargo vazio vira null', async () => {
    f.db.obras_cliente_pessoa.push({ id: P1, obra_id: MAE, nome: 'Ana', ordem: 3 })
    expect(await salvarPessoaAction(MAE, { nome: ' Bia ', cargo: ' ', email: ' Bia@DPSP.com.br ' })).toEqual({ ok: true })
    expect(f.db.obras_cliente_pessoa[1]).toMatchObject({ obra_id: MAE, nome: 'Bia', cargo: null, email: 'bia@dpsp.com.br', ordem: 4 })
  })
  it('nome obrigatório, e-mail opcional mas válido', async () => {
    expect((await salvarPessoaAction(MAE, { nome: '', cargo: null, email: null })).ok).toBe(false)
    expect((await salvarPessoaAction(MAE, { nome: 'X', cargo: null, email: 'sem-arroba' })).ok).toBe(false)
    expect((await salvarPessoaAction(MAE, { nome: 'Paula', cargo: 'Gerente da loja', email: '' })).ok).toBe(true)
    expect(f.db.obras_cliente_pessoa[0].email).toBeNull()
  })
  it('erro do trigger do banco aparece em pt-BR', async () => {
    f.erroEscrita.obras_cliente_pessoa = { code: '42501', message: 'OBRAS_CLIENTE_PESSOA: só administrador altera o organograma do cliente' }
    expect(await salvarPessoaAction(MAE, { nome: 'X', cargo: null, email: null })).toEqual({ ok: false, erro: 'Só administrador altera o organograma do cliente' })
  })
  it('remover a pessoa NÃO apaga o destinatário do e-mail', async () => {
    f.db.obras_cliente_pessoa.push({ id: P1, obra_id: MAE, nome: 'Ana', email: 'ana@dpsp.com.br', ordem: 0 })
    f.db.obras_destinatario.push({ id: 'd1', obra_id: MAE, email: 'ana@dpsp.com.br', lado: 'cliente', tipos: ['diario'], ativo: true })
    expect(await removerPessoaAction(MAE, P1)).toEqual({ ok: true })
    expect(f.db.obras_cliente_pessoa).toHaveLength(0)
    expect(f.db.obras_destinatario).toHaveLength(1)
  })
})

describe('chips gravam pelas actions das Configurações (o envio continua lendo obras_destinatario)', () => {
  it('ligar Semanal num destinatário existente atualiza a MESMA linha, preservando lado/tipos', async () => {
    f.db.obras_destinatario.push({ id: 'd1', obra_id: MAE, email: 'ana@dpsp.com.br', nome: 'Ana', funcao: 'Coord.', lado: 'cliente', tipos: ['diario', 'imediato'], ativo: true })
    const atual = estadoChips('ana@dpsp.com.br', [{ ...f.db.obras_destinatario[0] } as never], []).destinatario
    const entrada = destinatarioAposChip({ nome: 'Ana', cargo: null, email: 'ana@dpsp.com.br' }, atual, 'semanal', true)!
    expect(await salvarDestinatarioAction(MAE, entrada)).toEqual({ ok: true })
    expect(f.db.obras_destinatario).toHaveLength(1)
    expect(f.db.obras_destinatario[0]).toMatchObject({ id: 'd1', lado: 'cliente', ativo: true, tipos: ['diario', 'imediato', 'semanal'] })
  })
  it('desligar o último tipo desativa (a linha fica, não some)', async () => {
    f.db.obras_destinatario.push({ id: 'd1', obra_id: MAE, email: 'ana@dpsp.com.br', nome: null, funcao: null, lado: 'cliente', tipos: ['diario'], ativo: true })
    const atual = estadoChips('ana@dpsp.com.br', [{ ...f.db.obras_destinatario[0] } as never], []).destinatario
    const entrada = destinatarioAposChip({ nome: 'Ana', cargo: null, email: 'ana@dpsp.com.br' }, atual, 'diario', false)!
    expect(await salvarDestinatarioAction(MAE, entrada)).toEqual({ ok: true })
    expect(f.db.obras_destinatario[0]).toMatchObject({ ativo: false, tipos: ['diario'] })
  })
})

describe('valor receita: guarda do banco e OS cancelada (fix 1)', () => {
  it('erro OBRAS_VALOR do trigger aparece em pt-BR', async () => {
    f.erroEscrita.obras_obra = { code: '42501', message: 'OBRAS_VALOR: só administrador altera o valor receita de obra da modalidade OBRA' }
    expect(await salvarValorReceitaAction(MAE, MAE, '10,00')).toEqual({ ok: false, erro: 'Só administrador altera o valor receita de obra da modalidade OBRA' })
  })
  it('aditivo cancelado não recebe valor receita', async () => {
    f.db.obras_obra[1].cancelado_em = '2026-10-30T12:00:00Z'
    expect(await salvarValorReceitaAction(MAE, FILHA, '10,00')).toEqual({ ok: false, erro: 'Esta OS foi cancelada: o valor receita não conta mais' })
    expect(f.db.obras_obra[1].valor).toBeNull()
  })
})
