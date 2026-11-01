/**
 * Faseamento no portal (Leva 6b, Review Focus 3): a seção mostra só a ÚLTIMA revisão emitida de cada
 * fase, com base e nome congelados; rascunho e revisão de outra obra nunca aparecem; a aba Mapa
 * aparece (e a página não dá 404) quando há só faseamento emitido.
 */
const mockSessao = jest.fn()
const mockLerObra = jest.fn()
const mockLerMapa = jest.fn()
let mockAdmin: ReturnType<Banco['cliente']>

jest.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
jest.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`)
  },
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  usePathname: () => '/portal-obra/obras/x',
}))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...p }: { href: string; children: unknown }) => <a href={href} {...p}>{children as never}</a> }))
jest.mock('@/lib/portal-obra/sessao', () => ({ lerSessao: (...a: unknown[]) => mockSessao(...a) }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdmin }))
jest.mock('@/app/obras/obras/_lib/leitura', () => ({
  ...jest.requireActual('@/app/obras/obras/_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => mockLerObra(...a),
  lerPlanos: async () => ({ ok: true, planos: [] }),
  lerRestricoes: async () => ({ ok: true, restricoes: [] }),
}))
jest.mock('@/app/obras/obras/_lib/situacao', () => ({
  ...jest.requireActual('@/app/obras/obras/_lib/situacao'),
  lerSituacaoPublicada: async () => ({ ok: true, situacao: null }),
}))
jest.mock('@/app/obras/obras/_lib/mapa-leitura', () => ({
  ...jest.requireActual('@/app/obras/obras/_lib/mapa-leitura'),
  lerMapa: (...a: unknown[]) => mockLerMapa(...a),
  lerFotosDoMapa: async () => ({ ok: true, fotos: [] }),
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { criarBanco, type Banco } from '@/app/obras/obras/[id]/faseamento/__tests__/fixtures/banco'
import { obraGrandePdf } from '@/app/obras/obras/_pdf/__tests__/fixtures/rdo'
import { lerFaseamentoDoPortal } from '../(obra)/_lib/faseamento'
import { obraTemMapa } from '../(obra)/_lib/mapa'
import MapaObraPortal from '../(obra)/obras/[obraId]/mapa/page'
import ObraPortalLayout from '../(obra)/obras/[obraId]/layout'

const O = '11111111-1111-4111-8111-111111111111'
const OUTRA = '22222222-2222-4222-8222-222222222222'
const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const F1 = u(1)
const F2 = u(2)
const ZONA = [{ id: 'c1', t: 'zona_obra', r: [0.1, 0.1, 0.3, 0.3], rot: 'Obra' }]

const rev = (id: string, fase: string, n: number, status: 'emitida' | 'rascunho', over: Record<string, unknown> = {}) => ({
  id, fase_id: fase, obra_id: O, revisao: n, status, camadas: ZONA, regras: [], carimbo: {},
  emitida_em: status === 'emitida' ? '2026-10-30T15:00:00Z' : null,
  planta_path: status === 'emitida' ? `${O}/mapa/${u(90 + n)}.png` : null,
  planta_largura: status === 'emitida' ? 2000 : null, planta_altura: status === 'emitida' ? 1000 : null,
  fase_nome: status === 'emitida' ? `Congelada ${fase === F1 ? 'um' : 'dois'} R${n}` : null,
  fase_numero: status === 'emitida' ? (fase === F1 ? 1 : 2) : null,
  ...over,
})

let b: Banco
const banco = (linhas: unknown[], extra: Record<string, unknown[]> = {}) => {
  b = criarBanco()
  b.db = { obras_fase_revisao: linhas as never, ...extra } as never
  mockAdmin = b.cliente(async () => null)
}
const naoFalha = [
  rev(u(10), F1, 0, 'emitida'),
  rev(u(11), F1, 1, 'emitida'),
  rev(u(12), F1, 2, 'rascunho'),
  rev(u(13), F2, 0, 'emitida'),
  rev(u(14), F2, 1, 'rascunho'),
  { ...rev(u(15), F1, 9, 'emitida'), obra_id: OUTRA },
]

beforeEach(() => {
  jest.clearAllMocks()
  banco(naoFalha)
  mockSessao.mockResolvedValue({ email: 'cliente@loja.com.br', obras: [O] })
  mockLerObra.mockResolvedValue({ ok: true, dados: obraGrandePdf() })
  mockLerMapa.mockResolvedValue({ ok: true, dados: { configurado: true, mapa: { modo: 'croqui', plantaPath: null, plantaLargura: null, plantaAltura: null }, ambientes: [], pontos: [], vinculos: [] } })
})

describe('lerFaseamentoDoPortal', () => {
  it('só a última emitida de cada fase; rascunho e revisão de outra obra fora', async () => {
    const r = await lerFaseamentoDoPortal(mockAdmin as never, O)
    expect(r.map((f) => [f.numero, f.revisao, f.revisaoId])).toEqual([[1, 1, u(11)], [2, 0, u(13)]])
    expect(JSON.stringify(r)).not.toMatch(new RegExp(`${u(12)}|${u(14)}|${u(15)}`))
  })

  it('base e nome vêm congelados da revisão; planta por URL assinada curta', async () => {
    const r = await lerFaseamentoDoPortal(mockAdmin as never, O)
    expect(r[0]).toMatchObject({ nome: 'Congelada um R1', plantaUrl: `https://assinada/${O}/mapa/${u(91)}.png`, plantaLargura: 2000, plantaAltura: 1000 })
    expect(b.assinadas).toEqual([`${O}/mapa/${u(91)}.png`, `${O}/mapa/${u(90)}.png`])
  })

  it('planta fora do caminho canônico da obra não ganha URL (quadro branco)', async () => {
    banco([rev(u(10), F1, 0, 'emitida', { planta_path: `${OUTRA}/mapa/${u(5)}.png` })])
    const r = await lerFaseamentoDoPortal(mockAdmin as never, O)
    expect(r[0]).toMatchObject({ plantaUrl: null, plantaLargura: null })
    expect(b.assinadas).toEqual([])
  })

  it('nada emitido: lista vazia', async () => {
    banco([rev(u(12), F1, 2, 'rascunho')])
    expect(await lerFaseamentoDoPortal(mockAdmin as never, O)).toEqual([])
  })

  it('falha de leitura lança', async () => {
    b.erro['obras_fase_revisao.select'] = { message: 'x' }
    await expect(lerFaseamentoDoPortal(mockAdmin as never, O)).rejects.toThrow('portal-obra')
  })
})

describe('página da aba Mapa', () => {
  const pagina = (obraId: string) => MapaObraPortal({ params: Promise.resolve({ obraId }) })

  it('só faseamento (sem ambiente): mostra a seção, última revisão de cada fase, "Abrir PDF" e nada de rascunho', async () => {
    const html = renderToStaticMarkup(await pagina(O))
    expect(html).toContain('Faseamento')
    expect(html).toContain('Fase 1 · Congelada um R1')
    expect(html).toContain('Fase 2 · Congelada dois R0')
    expect(html).toMatch(/R1[^<]*(<!-- -->)?[^<]*emitida em/)
    expect(html).not.toContain('Congelada um R0')
    expect(html).toContain(`/portal-obra/obras/${O}/faseamento/${u(11)}/pdf`)
    expect(html).toContain(`/portal-obra/obras/${O}/faseamento/${u(13)}/pdf`)
    expect(html).not.toContain(u(10))
    expect(html).not.toContain(u(12))
    expect(html).not.toContain(u(14))
    expect(html).not.toContain(u(15))
    expect(html).toContain('30/10/2026')
  })

  it('sem ambiente e só rascunho: 404 e nenhuma seção', async () => {
    banco([rev(u(12), F1, 2, 'rascunho')])
    await expect(pagina(O)).rejects.toThrow('NOT_FOUND')
  })

  it('obra de outro cliente: 404 antes de ler o faseamento', async () => {
    await expect(pagina(OUTRA)).rejects.toThrow('NOT_FOUND')
    expect(mockLerObra).not.toHaveBeenCalled()
  })
})

describe('aba Mapa', () => {
  const layout = (obraId: string) => ObraPortalLayout({ children: null, params: Promise.resolve({ obraId }) })

  it('obraTemMapa: só faseamento emitido = true; só rascunho = false; só ambiente = true', async () => {
    expect(await obraTemMapa(O)).toBe(true)
    banco([rev(u(12), F1, 2, 'rascunho')])
    expect(await obraTemMapa(u(31))).toBe(false)
    banco([], { obras_ambiente: [{ id: u(5), obra_id: u(32) }] })
    expect(await obraTemMapa(u(32))).toBe(true)
  })

  it('layout: com só faseamento a aba Mapa aparece; só com rascunho, não', async () => {
    let html = renderToStaticMarkup(await layout(O))
    expect(html).toContain(`href="/portal-obra/obras/${O}/mapa"`)
    banco([rev(u(12), F1, 2, 'rascunho')])
    html = renderToStaticMarkup(await layout(O))
    expect(html).not.toContain(`href="/portal-obra/obras/${O}/mapa"`)
  })
})
