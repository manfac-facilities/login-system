// Baixa de avaria (só gestor/admin) e painel do último checklist (spec 2026-11-03 §2.9/§2.10).
const getUserMock = jest.fn()
const podeGerirMock = jest.fn()
const updatePayload: unknown[] = []
const updateEqs: unknown[][] = []
let ultimoChecklist: unknown = null
let fotosDoUltimo: unknown[] = []
const signedMock = jest.fn()

function cadeiaUpdate() {
  const c: Record<string, unknown> = {}
  c.eq = jest.fn((...args: unknown[]) => {
    updateEqs.push(args)
    return c
  })
  c.then = (resolve: (v: unknown) => void) => resolve({ error: null })
  return c
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: jest.fn((fn: string) => (fn === 'sofia_pode_gerir' ? podeGerirMock() : Promise.resolve({ data: null, error: null }))),
    storage: { from: jest.fn(() => ({ createSignedUrls: signedMock })) },
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: jest.fn(async () => ({ error: null })) }
      if (table === 'checklist_avarias')
        return {
          update: jest.fn((p: unknown) => {
            updatePayload.push(p)
            return cadeiaUpdate()
          }),
        }
      if (table === 'checklist') {
        const c: Record<string, unknown> = {}
        for (const m of ['select', 'eq', 'order', 'limit']) c[m] = jest.fn(() => c)
        c.maybeSingle = jest.fn(async () => ({ data: ultimoChecklist, error: null }))
        return c
      }
      // checklist_fotos
      const c: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) c[m] = jest.fn(() => c)
      c.in = jest.fn(async () => ({ data: fotosDoUltimo, error: null }))
      return c
    }),
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { definirAcaoAvariaAction, marcarAvariaReparadaAction, ultimoChecklistAction } from '../_actions'
import { hojeSP } from '@/lib/sofia/multaEtapas'

const AV = '11111111-1111-4111-8111-111111111111'
const VE = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  updatePayload.length = 0
  updateEqs.length = 0
  getUserMock.mockReset()
  getUserMock.mockResolvedValue({ data: { user: { id: 'u', email: 'x@manfac.com.br' } } })
  podeGerirMock.mockReset()
  signedMock.mockReset()
  ultimoChecklist = null
  fotosDoUltimo = []
})

describe('marcarAvariaReparadaAction', () => {
  it('usuário comum não dá baixa (nenhum UPDATE)', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    const r = await marcarAvariaReparadaAction(AV, '2026-10-01')
    expect(r.error).toBeTruthy()
    expect(updatePayload).toHaveLength(0)
  })

  it('gestor dá baixa com a data informada (meio-dia de SP), só se ainda aberta', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: null })
    const r = await marcarAvariaReparadaAction(AV, '2026-10-01')
    expect(r).toEqual({ success: true })
    expect(updatePayload[0]).toEqual({ status: 'reparada', reparada_em: '2026-10-01T12:00:00-03:00' })
    expect(updateEqs).toEqual([
      ['id', AV],
      ['status', 'aberta'],
    ])
  })

  it('data no futuro ou id inválido é recusado antes de qualquer consulta', async () => {
    podeGerirMock.mockResolvedValue({ data: true, error: null })
    expect((await marcarAvariaReparadaAction(AV, '2999-01-01')).error).toBeTruthy()
    expect((await marcarAvariaReparadaAction('nao-uuid', hojeSP())).error).toBeTruthy()
    expect(podeGerirMock).not.toHaveBeenCalled()
    expect(updatePayload).toHaveLength(0)
  })
})

describe('definirAcaoAvariaAction', () => {
  it('comum não define; gestor define reparo/troca', async () => {
    podeGerirMock.mockResolvedValue({ data: false, error: null })
    expect((await definirAcaoAvariaAction(AV, 'troca')).error).toBeTruthy()
    expect(updatePayload).toHaveLength(0)
    podeGerirMock.mockResolvedValue({ data: true, error: null })
    expect(await definirAcaoAvariaAction(AV, 'troca')).toEqual({ success: true })
    expect(updatePayload[0]).toEqual({ acao: 'troca' })
    expect((await definirAcaoAvariaAction(AV, 'pintura')).error).toBeTruthy()
  })
})

describe('ultimoChecklistAction', () => {
  it('sem checklist anterior → vazio', async () => {
    expect(await ultimoChecklistAction(VE)).toEqual({ ultimo: null, fotos: {} })
  })

  it('devolve URLs assinadas (3600 s) por posição', async () => {
    ultimoChecklist = { id: 'c9', data: '2026-10-28T10:00:00Z' }
    fotosDoUltimo = [
      { storage_path: 'c9/Frente.jpg', posicao: 'Frente' },
      { storage_path: 'c9/Traseira.jpg', posicao: 'Traseira' },
    ]
    signedMock.mockResolvedValue({
      data: [
        { path: 'c9/Frente.jpg', signedUrl: 'https://x/frente' },
        { path: 'c9/Traseira.jpg', signedUrl: 'https://x/traseira' },
      ],
    })
    const r = await ultimoChecklistAction(VE)
    expect(r).toEqual({
      ultimo: ultimoChecklist,
      fotos: { Frente: 'https://x/frente', Traseira: 'https://x/traseira' },
    })
    expect(signedMock).toHaveBeenCalledWith(['c9/Frente.jpg', 'c9/Traseira.jpg'], 3600)
  })

  it('veiculoId inválido → vazio sem consultar', async () => {
    expect(await ultimoChecklistAction('x')).toEqual({ ultimo: null, fotos: {} })
  })
})
