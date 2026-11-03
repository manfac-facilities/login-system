/**
 * Review Focus 5 (Leva 6): no mapa do portal, foto de diário em rascunho e
 * impedimento oculto (ou encerrado) nunca aparecem; obra de outro cliente é
 * recusada pela guarda antes de ler o mapa; obra sem mapa → aba some e a
 * página dá 404. Nada interno (numero da atividade, nome do ponto, R$).
 */
const mockSessao = jest.fn()
const mockLerObra = jest.fn()
const mockLerMapa = jest.fn()
const mockLerFotos = jest.fn()
let mockAdmin: ReturnType<typeof criarAdmin>

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
  lerFotosDoMapa: (...a: unknown[]) => mockLerFotos(...a),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FotoMapa } from '@/app/obras/obras/_lib/mapa'
import type { MapaDaObra } from '@/app/obras/obras/_lib/mapa-leitura'
import { obraGrandePdf } from '@/app/obras/obras/_pdf/__tests__/fixtures/rdo'
import type { VisaoCliente } from '../(obra)/_lib/visao'
import { lerMapaDoPortal, obraTemMapa, type MapaCliente } from '../(obra)/_lib/mapa'
import AbasObra from '../(obra)/obras/[obraId]/_abas'
import MapaObraPortal from '../(obra)/obras/[obraId]/mapa/page'
import ObraPortalLayout from '../(obra)/obras/[obraId]/layout'
import MapaPortal from '../(obra)/obras/[obraId]/mapa/_tela'

const O = '11111111-1111-4111-8111-111111111111'
const ALHEIA = '22222222-2222-4222-8222-222222222222'
const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AMB = u(1)
const AMB2 = u(2)
const PLANTA = `${O}/mapa/${u(9)}.png`

/** Admin falso: tabela → linhas (ignora filtros, para provar que o código também filtra) + storage que assina. */
function criarAdmin(db: Record<string, Record<string, unknown>[]> = {}) {
  const filtros: { tabela: string; op: string; col: string; v: unknown }[] = []
  const assinadas: string[][] = []
  const tabelas: string[] = []
  const q = (tabela: string) => {
    tabelas.push(tabela)
    const b = {
      select: () => b,
      eq: (col: string, v: unknown) => (filtros.push({ tabela, op: 'eq', col, v }), b),
      is: (col: string, v: unknown) => (filtros.push({ tabela, op: 'is', col, v }), b),
      not: (col: string, _o: string, v: unknown) => (filtros.push({ tabela, op: 'not', col, v }), b),
      limit: () => b,
      order: () => b,
      then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: db[tabela] ?? [], error: null }).then(ok),
    }
    return b
  }
  return {
    filtros,
    assinadas,
    tabelas,
    from: q,
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => {
          assinadas.push(paths)
          return { data: paths.map((p) => ({ path: p, signedUrl: `https://assinada/${p}`, error: null })), error: null }
        },
        createSignedUrl: async (p: string) => {
          assinadas.push([p])
          return { data: { signedUrl: `https://assinada/${p}` }, error: null }
        },
      }),
    },
  }
}

const mapaDb = (over: Partial<MapaDaObra> = {}): MapaDaObra => ({
  configurado: true,
  mapa: { modo: 'croqui', plantaPath: null, plantaLargura: null, plantaAltura: null },
  ambientes: [
    { id: AMB, nome: 'Salão de vendas', areaM2: 412, x: 0.1, y: 0.1, w: 0.5, h: 0.5, ordem: 1 },
    { id: AMB2, nome: 'Estoque', areaM2: null, x: 0.6, y: 0.1, w: 0.3, h: 0.5, ordem: 2 },
  ],
  pontos: [
    { id: u(20), numero: 3, nome: 'Canto da gôndola interna', ambienteId: AMB, x: 0.2, y: 0.2, ativo: true },
    { id: u(21), numero: 4, nome: 'Desativado', ambienteId: AMB, x: 0.3, y: 0.3, ativo: false },
  ],
  vinculos: [{ ambienteId: AMB, atividadeNumero: 77 }],
  ...over,
})

const foto = (id: string, estado: string, over: Partial<FotoMapa> = {}): FotoMapa => ({
  id, rdoId: 'r', path: `${O}/rdo/2026-10-30/${id}.jpg`, legenda: null, ordem: 0, data: '2026-10-30', estado,
  ambienteId: AMB, pontoId: null, atividadeNumero: null, ...over,
})

const ativ = {
  numero: 77, etapa: 'Alvenaria', descricao: 'Drywall do salão', peso: 1, pesoValor: 98765, duracao: 5, percentual: 0.7, percentualPrevisto: 0.9,
  inicioPrevisto: '2026-10-26', fimPrevisto: '2026-10-30', inicioProjetado: '2026-10-26', fimProjetado: '2026-11-03', situacao: 'atrasada', status: 'em_andamento',
}
const og = obraGrandePdf({ calc: { atividades: [ativ], previsto: 0.9, realizado: 0.7, desvioPP: -20, terminoPrevisto: '2026-10-30', terminoProjetado: '2026-11-03' } as never })
const visao = {
  cronograma: { etapas: [{ atividades: [{ codigo: '1.1', descricao: 'Drywall do salão', situacao: 'Atrasada', tom: 'atraso', realizado: '70%' }] }] },
} as unknown as VisaoCliente

beforeEach(() => {
  jest.clearAllMocks()
  mockAdmin = criarAdmin()
  mockSessao.mockResolvedValue({ email: 'cliente@loja.com.br', obras: [O] })
  mockLerObra.mockResolvedValue({ ok: true, dados: obraGrandePdf() })
  mockLerMapa.mockResolvedValue({ ok: true, dados: mapaDb() })
  mockLerFotos.mockResolvedValue({ ok: true, fotos: [] })
})

describe('lerMapaDoPortal', () => {
  it('foto de diário em rascunho nunca aparece: filtro no banco e no código; URL só das publicadas', async () => {
    mockLerFotos.mockImplementation(async (_a: unknown, _o: string, op: { ambienteId: string }) => ({
      ok: true,
      fotos: op.ambienteId === AMB ? [foto('valida', 'validado'), foto('rasc', 'rascunho'), foto('env', 'enviado', { ordem: 1 })] : [],
    }))
    const r = (await lerMapaDoPortal(mockAdmin as never, O, og, visao))!
    for (const c of mockLerFotos.mock.calls) {
      expect(c[1]).toBe(O)
      expect(c[2]).toMatchObject({ estados: ['validado', 'enviado'], limite: 6 })
    }
    expect(r.ambientes[0].fotos.map((f) => f.id).sort()).toEqual(['env', 'valida'])
    expect(JSON.stringify(r)).not.toMatch(/rasc/)
    expect(mockAdmin.assinadas.flat().some((p) => p.includes('rasc'))).toBe(false)
  })

  it('foto de ponto desativado: sai só com o ambiente (sem "ponto N" que não está no mapa)', async () => {
    mockLerFotos.mockImplementation(async (_a: unknown, _o: string, op: { ambienteId: string }) => ({
      ok: true,
      fotos: op.ambienteId === AMB ? [foto('ativo', 'validado', { pontoId: u(20) }), foto('desat', 'validado', { pontoId: u(21), ordem: 1 })] : [],
    }))
    const r = (await lerMapaDoPortal(mockAdmin as never, O, og, visao))!
    expect(Object.fromEntries(r.ambientes[0].fotos.map((f) => [f.id, f.pontoNumero]))).toEqual({ ativo: 3, desat: null })
    expect(r.cronogramaPublicado).toBe(true)
  })

  it('foto fora do caminho canônico desta obra não ganha URL', async () => {
    mockLerFotos.mockResolvedValue({ ok: true, fotos: [foto('alheia', 'validado', { path: `${ALHEIA}/rdo/2026-10-30/x.jpg` })] })
    const r = (await lerMapaDoPortal(mockAdmin as never, O, og, visao))!
    expect(r.ambientes.flatMap((a) => a.fotos)).toEqual([])
    expect(mockAdmin.assinadas).toEqual([])
  })

  it('impedimento oculto ou encerrado nunca aparece; o visível e aberto ganha ▲ com a descrição', async () => {
    mockAdmin = criarAdmin({
      obras_impedimento: [
        { id: 'vis', obra_id: O, ambiente_id: AMB, descricao: 'Aguardando liberação da área', categoria: 'impedimento', exibir_ao_cliente: true, encerrado_em: null },
        { id: 'oc', obra_id: O, ambiente_id: AMB, descricao: 'Pedreiro faltou sem avisar', categoria: 'impedimento', exibir_ao_cliente: false, encerrado_em: null },
        { id: 'fe', obra_id: O, ambiente_id: AMB2, descricao: 'Já resolvido', categoria: 'impedimento', exibir_ao_cliente: true, encerrado_em: '2026-10-29' },
        { id: 'or', obra_id: O, ambiente_id: AMB2, descricao: 'Orientação interna', categoria: 'orientacao', exibir_ao_cliente: true, encerrado_em: null },
      ],
    })
    const r = (await lerMapaDoPortal(mockAdmin as never, O, og, visao))!
    expect(mockAdmin.filtros).toEqual(
      expect.arrayContaining([
        { tabela: 'obras_impedimento', op: 'eq', col: 'obra_id', v: O },
        { tabela: 'obras_impedimento', op: 'eq', col: 'exibir_ao_cliente', v: true },
        { tabela: 'obras_impedimento', op: 'is', col: 'encerrado_em', v: null },
        { tabela: 'obras_impedimento', op: 'eq', col: 'categoria', v: 'impedimento' },
      ]),
    )
    expect(r.ambientes[0].impedimentos).toEqual([{ id: 'vis', descricao: 'Aguardando liberação da área' }])
    expect(r.ambientes[1].impedimentos).toEqual([])
    const s = JSON.stringify(r)
    expect(s).not.toMatch(/Pedreiro|Já resolvido|Orientação interna/)
  })

  it('atividade pelo código e pela situação do cronograma do portal; nada de numero, peso, nome de ponto ou ponto desativado', async () => {
    const r = (await lerMapaDoPortal(mockAdmin as never, O, og, visao))!
    expect(r.ambientes[0].pct).toBeCloseTo(0.7)
    expect(r.ambientes[0].atividades).toEqual([{ codigo: '1.1', descricao: 'Drywall do salão', situacao: 'Atrasada', tom: 'atraso', realizado: '70%' }])
    expect(r.ambientes[1].pct).toBeNull()
    expect(r.pontos).toEqual([{ id: u(20), numero: 3, x: 0.2, y: 0.2 }])
    const s = JSON.stringify(r)
    expect(s).not.toMatch(/"numero":77|98765|peso|Canto da gôndola|Desativado/)
  })

  it('sem cronograma salvo no portal: nenhum avanço por ambiente ("—")', async () => {
    const r = (await lerMapaDoPortal(mockAdmin as never, O, og, { cronograma: null } as unknown as VisaoCliente))!
    expect(r.ambientes.map((a) => [a.pct, a.atividades.length])).toEqual([[null, 0], [null, 0]])
    expect(r.cronogramaPublicado).toBe(false)
  })

  it('planta: só caminho canônico desta obra vira URL assinada; senão cai no croqui', async () => {
    mockLerMapa.mockResolvedValue({ ok: true, dados: mapaDb({ mapa: { modo: 'planta', plantaPath: PLANTA, plantaLargura: 2000, plantaAltura: 1200 } }) })
    let r = (await lerMapaDoPortal(mockAdmin as never, O, og, visao))!
    expect(r.modo).toBe('planta')
    expect(r.plantaUrl).toBe(`https://assinada/${PLANTA}`)
    mockAdmin = criarAdmin()
    mockLerMapa.mockResolvedValue({ ok: true, dados: mapaDb({ mapa: { modo: 'planta', plantaPath: `${ALHEIA}/mapa/${u(9)}.png`, plantaLargura: 2000, plantaAltura: 1200 } }) })
    r = (await lerMapaDoPortal(mockAdmin as never, O, og, visao))!
    expect(r.modo).toBe('croqui')
    expect(r.plantaUrl).toBeNull()
    expect(mockAdmin.assinadas).toEqual([])
  })

  it('obra sem ambiente: null; falha de leitura lança', async () => {
    mockLerMapa.mockResolvedValueOnce({ ok: true, dados: mapaDb({ ambientes: [], pontos: [], vinculos: [] }) })
    expect(await lerMapaDoPortal(mockAdmin as never, O, og, visao)).toBeNull()
    mockLerMapa.mockResolvedValueOnce({ ok: false, erro: 'x' })
    await expect(lerMapaDoPortal(mockAdmin as never, O, og, visao)).rejects.toThrow('portal-obra')
  })
})

describe('página e aba', () => {
  const pagina = (obraId: string) => MapaObraPortal({ params: Promise.resolve({ obraId }) })

  it('obra de outro cliente: 404 pela guarda, sem ler a obra nem o mapa', async () => {
    await expect(pagina(ALHEIA)).rejects.toThrow('NOT_FOUND')
    expect(mockLerObra).not.toHaveBeenCalled()
    expect(mockLerMapa).not.toHaveBeenCalled()
  })

  it('obra SPOT liberada: 404 antes do mapa', async () => {
    mockLerObra.mockResolvedValue({ ok: true, dados: obraGrandePdf({ obra: { id: O, modalidade: 'spot' } as never }) })
    await expect(pagina(O)).rejects.toThrow('NOT_FOUND')
    expect(mockLerMapa).not.toHaveBeenCalled()
  })

  it('obra sem mapa: página 404', async () => {
    mockLerMapa.mockResolvedValue({ ok: true, dados: mapaDb({ ambientes: [], pontos: [], vinculos: [] }) })
    await expect(pagina(O)).rejects.toThrow('NOT_FOUND')
    expect(mockLerMapa).toHaveBeenCalledWith(mockAdmin, O)
  })

  it('obra com mapa: a página renderiza o mapa', async () => {
    const html = renderToStaticMarkup(await pagina(O))
    expect(html).toContain('Salão de vendas')
  })

  it('layout: guarda antes de obraTemMapa (obra alheia → 404 sem consultar ambientes); com mapa, aba aparece', async () => {
    const layout = (obraId: string) => ObraPortalLayout({ children: null, params: Promise.resolve({ obraId }) })
    await expect(layout(ALHEIA)).rejects.toThrow('NOT_FOUND')
    expect(mockAdmin.tabelas).not.toContain('obras_ambiente')
    expect(mockLerObra).not.toHaveBeenCalled()

    mockAdmin = criarAdmin({ obras_ambiente: [{ id: AMB }] })
    const html = renderToStaticMarkup(await layout(O))
    expect(mockAdmin.filtros).toContainEqual({ tabela: 'obras_ambiente', op: 'eq', col: 'obra_id', v: O })
    expect(html).toContain(`href="/portal-obra/obras/${O}/mapa"`)
  })

  it('aba Mapa só com mapa; obraTemMapa lê pelo id da obra', async () => {
    const { rerender } = render(<AbasObra raiz="/portal-obra/obras/x" aguardando={0} />)
    expect(screen.queryByRole('link', { name: 'Mapa' })).toBeNull()
    rerender(<AbasObra raiz="/portal-obra/obras/x" aguardando={0} comMapa />)
    expect(screen.getByRole('link', { name: 'Mapa' }).getAttribute('href')).toBe('/portal-obra/obras/x/mapa')

    mockAdmin = criarAdmin({ obras_ambiente: [] })
    expect(await obraTemMapa(u(30))).toBe(false)
    mockAdmin = criarAdmin({ obras_ambiente: [{ id: AMB }] })
    expect(await obraTemMapa(u(31))).toBe(true)
    expect(mockAdmin.filtros).toContainEqual({ tabela: 'obras_ambiente', op: 'eq', col: 'obra_id', v: u(31) })
  })
})

describe('tela', () => {
  const mapa: MapaCliente = {
    cronogramaPublicado: true,
    modo: 'croqui', plantaUrl: null, plantaLargura: null, plantaAltura: null,
    ambientes: [
      {
        id: AMB, nome: 'Salão de vendas', areaM2: 412, x: 0.1, y: 0.1, w: 0.5, h: 0.5, pct: 0.64, previsto: 0.71, faixa: 3,
        atividades: [{ codigo: '1.1', descricao: 'Drywall do salão', situacao: 'Atrasada', tom: 'atraso', realizado: '70%' }],
        impedimentos: [], fotos: [{ id: 'f', url: 'https://assinada/f.jpg', data: '2026-10-31', pontoNumero: 3 }],
      },
      {
        id: AMB2, nome: 'Estoque', areaM2: null, x: 0.6, y: 0.1, w: 0.3, h: 0.5, pct: null, previsto: null, faixa: null,
        atividades: [], impedimentos: [{ id: 'vis', descricao: 'Aguardando liberação da área' }], fotos: [],
      },
    ],
    pontos: [{ id: u(20), numero: 3, x: 0.2, y: 0.2 }],
  }

  it('tocar no ambiente mostra avanço, atividades com a situação do portal, fotos e o ▲ visível', () => {
    render(<MapaPortal mapa={mapa} />)
    const painel = screen.getByRole('complementary', { name: 'Ambiente escolhido' })
    expect(painel.textContent).toContain('avanço 64%')
    expect(painel.textContent).toContain('Atrasada · 70%')
    expect(screen.getByAltText(/Foto de 31\/10/)).toBeTruthy()
    expect(painel.textContent).toContain('ponto 3')

    fireEvent.click(screen.getAllByRole('button', { name: /Estoque/ })[0])
    expect(painel.textContent).toContain('avanço —')
    expect(painel.textContent).toContain('Aguardando liberação da área')
    expect(painel.textContent).toContain('assim que os diários de obra forem validados')
    expect(screen.getByLabelText('Ponto 3')).toBeTruthy()
  })

  it('barra do cartão na cor da faixa do ambiente; sem cronograma publicado, texto próprio', () => {
    const { container } = render(<MapaPortal mapa={{ ...mapa, cronogramaPublicado: false, modo: 'ambientes' }} />)
    const barras = [...container.querySelectorAll('button i')].map((i) => (i as HTMLElement).style.background)
    expect(barras[0]).toBe('rgb(93, 159, 220)') // CORES_FAIXA[3]
    fireEvent.click(screen.getByRole('button', { name: /Estoque/ }))
    expect(screen.getByRole('complementary', { name: 'Ambiente escolhido' }).textContent).toContain('Cronograma ainda não publicado')
  })
})
