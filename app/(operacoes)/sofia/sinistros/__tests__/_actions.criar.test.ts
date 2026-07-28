type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['insert', 'select', 'eq', 'single']
  for (const m of methods) chain[m] = jest.fn(() => chain)
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { criarSinistroAction } from '../_actions'

function buildFormData(fields: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    id: 'sinistro-1',
    veiculo_id: 'veiculo-1',
    motorista_id: '',
    data: '2026-07-27',
    tipo: 'avaria',
    descricao: 'Arranhão na lateral',
    valor_dano: '',
    observacoes: '',
    fotos: '{}',
  }
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v)
  return fd
}

describe('criarSinistroAction', () => {
  beforeEach(() => {
    tableResults = {
      sinistros: { error: null },
      sinistro_fotos: { error: null },
    }
  })

  it('cria o sinistro usando o id vindo do formulário', async () => {
    const result = await criarSinistroAction({}, buildFormData())
    expect(result).toEqual({ success: true, sinistroId: 'sinistro-1' })
  })

  it('grava as linhas de foto quando o mapa de fotos vem preenchido', async () => {
    const fd = buildFormData({
      fotos: JSON.stringify({ 'Dano 1': 'sinistros/sinistro-1/dano1.jpg' }),
    })
    const result = await criarSinistroAction({}, fd)
    expect(result).toEqual({ success: true, sinistroId: 'sinistro-1' })
  })

  it('surfaces erro (mas mantém o sinistro salvo) se a gravação das fotos falhar', async () => {
    tableResults.sinistro_fotos = { error: { message: 'RLS denied' } }
    const fd = buildFormData({
      fotos: JSON.stringify({ 'Dano 1': 'sinistros/sinistro-1/dano1.jpg' }),
    })
    const result = await criarSinistroAction({}, fd)
    expect(result.error).toBeTruthy()
    expect(result.sinistroId).toBe('sinistro-1')
  })

  it('exige data, tipo e descrição', async () => {
    const result = await criarSinistroAction({}, buildFormData({ descricao: '' }))
    expect(result).toEqual({ error: 'Data, tipo e descrição são obrigatórios' })
  })
})
