// Checklist com fotos extras e avarias (spec 2026-11-03 §2.7/§2.8):
// ordem checklist → avarias → fotos; avaria inválida recusada ANTES de gravar.
const ordem: string[] = []
const inserts: Record<string, unknown> = {}
let erroPorTabela: Record<string, unknown> = {}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'u1' } } })) },
    from: jest.fn((table: string) => ({
      insert: jest.fn(async (rows: unknown) => {
        ordem.push(table)
        inserts[table] = rows
        return { error: erroPorTabela[table] ?? null }
      }),
    })),
    rpc: jest.fn(),
  })),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { criarChecklistAction } from '../_actions'

const OBR = {
  Frente: { path: 'c1/Frente.jpg', lat: null, lng: null },
  Traseira: { path: 'c1/Traseira.jpg', lat: null, lng: null },
  'Lateral Esq.': { path: 'c1/LE.jpg', lat: null, lng: null },
  'Lateral Dir.': { path: 'c1/LD.jpg', lat: null, lng: null },
}

function fd(fotos: Record<string, unknown>, avarias: unknown[]): FormData {
  const f = new FormData()
  const campos: Record<string, string> = {
    id: 'c1',
    tipo: 'retorno',
    equipe_id: 'e1',
    veiculo_id: 'v1',
    assinatura_motorista: 'true',
    lataria_ok: 'true',
    vidros_ok: 'true',
    pneus_ok: 'true',
    combustivel_ok: 'true',
    itens_internos_ok: 'true',
    estepe_ok: 'true',
    macaco_ok: 'true',
    triangulo_ok: 'true',
    fotos: JSON.stringify(fotos),
    avarias: JSON.stringify(avarias),
  }
  for (const [k, v] of Object.entries(campos)) f.set(k, v)
  return f
}

const AV = { ref: 'av-1', peca: 'Porta direita', tamanho: 'media', acao: '', descricao: 'Amassado' }
const FOTOS_AV = {
  'Avaria 1 peça 1': { path: 'c1/p.jpg', lat: null, lng: null, tipo_foto: 'avaria_peca', avaria_ref: 'av-1' },
  'Avaria 1 dano 1': { path: 'c1/d.jpg', lat: null, lng: null, tipo_foto: 'avaria_dano', avaria_ref: 'av-1' },
}

beforeEach(() => {
  ordem.length = 0
  for (const k of Object.keys(inserts)) delete inserts[k]
  erroPorTabela = {}
})

it('grava checklist → avarias → fotos, com avaria_id real e tipo_foto', async () => {
  const r = await criarChecklistAction({}, fd({ ...OBR, 'Extra 1': { path: 'c1/e1.jpg', lat: null, lng: null, tipo_foto: 'extra' }, ...FOTOS_AV }, [AV]))
  expect(r).toEqual({ success: true, checklistId: 'c1' })
  expect(ordem.filter((t) => t !== 'audit_log')).toEqual(['checklist', 'checklist_avarias', 'checklist_fotos'])

  const checklist = inserts.checklist as Record<string, unknown>
  expect(checklist.avaria_identificada).toBe(true)
  expect(checklist.avaria_descricao).toBe('Porta direita')

  const avarias = inserts.checklist_avarias as { id: string; checklist_id: string; peca: string; tamanho: string; acao: unknown }[]
  expect(avarias).toHaveLength(1)
  expect(avarias[0]).toEqual(expect.objectContaining({ checklist_id: 'c1', peca: 'Porta direita', tamanho: 'media', acao: null }))

  const fotos = inserts.checklist_fotos as { posicao: string; tipo_foto: string; avaria_id: string | null }[]
  const porPos = Object.fromEntries(fotos.map((f) => [f.posicao, f]))
  expect(porPos.Frente.tipo_foto).toBe('obrigatoria')
  expect(porPos.Frente.avaria_id).toBeNull()
  expect(porPos['Extra 1'].tipo_foto).toBe('extra')
  expect(porPos['Avaria 1 dano 1']).toEqual(expect.objectContaining({ tipo_foto: 'avaria_dano', avaria_id: avarias[0].id }))
  expect(porPos['Avaria 1 peça 1'].avaria_id).toBe(avarias[0].id)
})

it('sem avaria: avaria_identificada false, nenhum insert em checklist_avarias', async () => {
  const r = await criarChecklistAction({}, fd(OBR, []))
  expect(r.success).toBe(true)
  expect((inserts.checklist as Record<string, unknown>).avaria_identificada).toBe(false)
  expect(ordem).not.toContain('checklist_avarias')
})

it('avaria sem foto do dano é recusada antes de gravar qualquer coisa', async () => {
  const r = await criarChecklistAction({}, fd({ ...OBR, 'Avaria 1 peça 1': FOTOS_AV['Avaria 1 peça 1'] }, [AV]))
  expect(r.error).toBe('Avaria (Porta direita): falta foto da avaria')
  expect(ordem).toEqual([])
})

it('31 fotos são recusadas antes de gravar', async () => {
  const extras: Record<string, unknown> = {}
  for (let i = 1; i <= 27; i++) extras[`Extra ${i}`] = { path: `c1/e${i}.jpg`, lat: null, lng: null, tipo_foto: 'extra' }
  const r = await criarChecklistAction({}, fd({ ...OBR, ...extras }, []))
  expect(r.error).toBe('Limite de 30 fotos por checklist')
  expect(ordem).toEqual([])
})

it('erro ao gravar avarias devolve a mensagem fixa com o checklistId e não grava fotos', async () => {
  erroPorTabela = { checklist_avarias: { message: 'x' } }
  const r = await criarChecklistAction({}, fd({ ...OBR, ...FOTOS_AV }, [AV]))
  expect(r).toEqual({
    error: 'Checklist salvo, mas as avarias não foram registradas. Contate o suporte.',
    checklistId: 'c1',
  })
  expect(ordem).not.toContain('checklist_fotos')
})

it('avaria_identificada acende quando algum item e marcado Problema, mesmo sem avaria registrada', async () => {
  const f = fd(OBR, [])
  f.set('lataria_ok', 'false')
  f.set('itens_problemas', JSON.stringify({ lataria: 'riscado' }))
  await criarChecklistAction({}, f)
  expect((inserts['checklist'] as { avaria_identificada: boolean }).avaria_identificada).toBe(true)
})

it('avaria_identificada fica false sem problema e sem avaria', async () => {
  await criarChecklistAction({}, fd(OBR, []))
  expect((inserts['checklist'] as { avaria_identificada: boolean }).avaria_identificada).toBe(false)
})
