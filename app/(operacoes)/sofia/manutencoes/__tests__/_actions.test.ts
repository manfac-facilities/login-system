// Manutenção corretiva (spec 2026-11-03 §3.2): só gestor escreve; RPCs; SOF01 repassado.
const rpcMock = jest.fn()
const podeGerirMock = jest.fn()
const getUserMock = jest.fn()
const logAuditMock = jest.fn()
const updateMock = jest.fn()
const signedMock = jest.fn()
let lido: Record<string, unknown> | null
let atualizadas: { id: string }[]
const filtrosUpdate: [string, string][] = []

function consulta() {
  const q: Record<string, unknown> = {}
  q.select = () => q
  q.eq = () => q
  q.maybeSingle = async () => ({ data: lido, error: null })
  return q
}
function atualizacao() {
  const q: Record<string, unknown> = {}
  q.eq = (k: string, v: string) => { filtrosUpdate.push([k, v]); return q }
  q.select = async () => ({ data: atualizadas, error: null })
  return q
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string, args?: unknown) => (fn === 'sofia_pode_gerir' ? podeGerirMock() : rpcMock(fn, args))),
    from: jest.fn(() => ({ ...consulta(), update: (v: unknown) => { updateMock(v); return atualizacao() } })),
    storage: { from: () => ({ createSignedUrl: signedMock }) },
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }))

import {
  abrirManutencaoAction, anexarManutencaoAction, avancarStatusManutencaoAction, concluirManutencaoAction, verAnexoManutencaoAction,
} from '../_actions'
import { MSG_SEM_PERMISSAO_FROTAS } from '@/lib/sofia/permissoes'

const ID = '11111111-2222-4333-8444-555555555555'

function fdAbrir(o: Record<string, string> = {}) {
  const fd = new FormData()
  const campos: Record<string, string> = {
    veiculo_id: 'v1', defeito: ' Embreagem patinando ', oficina: 'Beta', data_entrada: '2026-11-03', saida_prevista: '2026-11-06',
    custo: '', quem_arca: 'locadora', status: 'aguardando_orcamento', tirar_da_equipe: 'on', observacoes: '', ...o,
  }
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  if (o.tirar_da_equipe === '') fd.delete('tirar_da_equipe')
  return fd
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  rpcMock.mockReset()
  rpcMock.mockResolvedValue({ data: { id: ID }, error: null })
  podeGerirMock.mockReset()
  podeGerirMock.mockResolvedValue({ data: true, error: null })
  getUserMock.mockResolvedValue({ data: { user: { email: 'igor@manfac.com.br' } } })
  logAuditMock.mockReset()
  updateMock.mockReset()
  signedMock.mockReset()
  lido = { status: 'aguardando_orcamento', anexo_storage_path: `manutencoes/${ID}/1-nota.pdf` }
  atualizadas = [{ id: ID }]
  filtrosUpdate.length = 0
})

describe('abrirManutencaoAction', () => {
  it('sem gestor: negado sem chamar a RPC', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await abrirManutencaoAction({}, fdAbrir())).toEqual({ error: MSG_SEM_PERMISSAO_FROTAS })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('chama a RPC com os 10 parâmetros (tirar da equipe vem do checkbox)', async () => {
    expect(await abrirManutencaoAction({}, fdAbrir())).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith('sofia_abrir_manutencao', {
      p_veiculo_id: 'v1', p_defeito: 'Embreagem patinando', p_oficina: 'Beta', p_data_entrada: '2026-11-03',
      p_saida_prevista: '2026-11-06', p_custo: null, p_quem_arca: 'locadora', p_status: 'aguardando_orcamento',
      p_tirar_da_equipe: true, p_observacoes: null,
    })
    expect(Object.keys(rpcMock.mock.calls[0][1])).toHaveLength(10)
  })

  it('checkbox desmarcado → p_tirar_da_equipe false; custo com vírgula', async () => {
    await abrirManutencaoAction({}, fdAbrir({ tirar_da_equipe: '', custo: '640,50' }))
    expect(rpcMock.mock.calls[0][1]).toMatchObject({ p_tirar_da_equipe: false, p_custo: 640.5 })
  })

  it('validação do mockup antes da RPC', async () => {
    expect(await abrirManutencaoAction({}, fdAbrir({ veiculo_id: '' }))).toEqual({ error: 'Escolha o veículo.' })
    expect(await abrirManutencaoAction({}, fdAbrir({ defeito: '  ' }))).toEqual({ error: 'Descreva o defeito.' })
    expect(await abrirManutencaoAction({}, fdAbrir({ saida_prevista: '2026-11-01' }))).toEqual({ error: 'A saída prevista não pode ser antes da entrada.' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('erro SOF01 repassa a mensagem do banco; outro vira genérica', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'SOF01', message: 'Veículo desativado: reative antes de registrar a manutenção.' } })
    expect(await abrirManutencaoAction({}, fdAbrir())).toEqual({ error: 'Veículo desativado: reative antes de registrar a manutenção.' })
    rpcMock.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Apenas administradores...' } })
    expect(await abrirManutencaoAction({}, fdAbrir())).toEqual({ error: 'Erro ao registrar manutenção' })
  })
})

describe('avancarStatusManutencaoAction', () => {
  it('transição válida: update condicionado ao status atual + auditoria', async () => {
    expect(await avancarStatusManutencaoAction(ID, 'aguardando_aprovacao')).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'aguardando_aprovacao' }))
    expect(filtrosUpdate).toEqual([['id', ID], ['status', 'aguardando_orcamento']])
    expect(logAuditMock).toHaveBeenCalledWith('manutencoes', 'atualizou', ID, 'Status: Aguardando orçamento → Aguardando aprovação')
  })

  it('transição inválida: erro sem update', async () => {
    expect((await avancarStatusManutencaoAction(ID, 'em_conserto')).error).toMatch(/inválida/)
    lido = { status: 'concluida' }
    expect((await avancarStatusManutencaoAction(ID, 'aguardando_aprovacao')).error).toMatch(/inválida/)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('update com 0 linhas → "mudou"', async () => {
    atualizadas = []
    expect(await avancarStatusManutencaoAction(ID, 'aguardando_aprovacao')).toEqual({ error: 'A manutenção mudou enquanto você olhava. Recarregue.' })
    expect(logAuditMock).not.toHaveBeenCalled()
  })

  it('sem gestor: negado', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await avancarStatusManutencaoAction(ID, 'aguardando_aprovacao')).toEqual({ error: MSG_SEM_PERMISSAO_FROTAS })
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('concluirManutencaoAction', () => {
  it('chama a RPC e repassa SOF01', async () => {
    expect(await concluirManutencaoAction(ID, { data_saida: '2026-11-03', custo: '0', quem_arca: 'empresa' })).toEqual({ success: true })
    expect(rpcMock).toHaveBeenCalledWith('sofia_concluir_manutencao', { p_id: ID, p_data_saida: '2026-11-03', p_custo: 0, p_quem_arca: 'empresa' })
    rpcMock.mockResolvedValue({ data: null, error: { code: 'SOF01', message: 'Esta manutenção já foi concluída.' } })
    expect(await concluirManutencaoAction(ID, { data_saida: '2026-11-03', custo: '0', quem_arca: 'empresa' })).toEqual({ error: 'Esta manutenção já foi concluída.' })
  })

  it('sem gestor: negado sem RPC', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect(await concluirManutencaoAction(ID, { data_saida: '2026-11-03', custo: '0', quem_arca: 'empresa' })).toEqual({ error: MSG_SEM_PERMISSAO_FROTAS })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('anexo', () => {
  it('caminho de outro id ou com ".." → erro, sem update', async () => {
    expect(await anexarManutencaoAction(ID, 'manutencoes/outro-id/1-nota.pdf')).toEqual({ error: 'Arquivo inválido.' })
    expect(await anexarManutencaoAction(ID, `manutencoes/${ID}/../x.pdf`)).toEqual({ error: 'Arquivo inválido.' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('caminho certo grava e audita', async () => {
    expect(await anexarManutencaoAction(ID, `manutencoes/${ID}/1730-nota.pdf`)).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ anexo_storage_path: `manutencoes/${ID}/1730-nota.pdf` }))
    expect(logAuditMock).toHaveBeenCalled()
  })

  it('ver anexo lê o caminho do banco (não recebe caminho do navegador)', async () => {
    signedMock.mockResolvedValue({ data: { signedUrl: 'https://x/assinada' }, error: null })
    expect(await verAnexoManutencaoAction(ID)).toEqual({ url: 'https://x/assinada' })
    expect(signedMock).toHaveBeenCalledWith(`manutencoes/${ID}/1-nota.pdf`, 60)
    lido = { anexo_storage_path: null }
    expect(await verAnexoManutencaoAction(ID)).toEqual({ error: 'Esta manutenção não tem anexo.' })
  })
})
