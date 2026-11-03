/**
 * @jest-environment node
 *
 * Diários e relatórios + "Abrir PDF" do portal (Leva 5 §3.2, Review Focus 3):
 * só envio feito AO CLIENTE desta obra (lado cliente, destinatário aceito) de
 * documento ainda validado/enviado; rascunho/desfeito nunca vira PDF; obra de
 * outro cliente → 404 sem ler nada; sem sessão → /portal-obra. Galeria: só
 * fotos de diário validado, caminho canônico, URL assinada de 5 min.
 */
const mockSessao = jest.fn()
const mockLerObra = jest.fn()
const mockRdo = jest.fn()
const mockSemanal = jest.fn()
const mockPeriodo = jest.fn()
const mockAta = jest.fn()
let mockAdmin: unknown

jest.mock('@/lib/portal-obra/sessao', () => ({ lerSessao: (...a: unknown[]) => mockSessao(...a) }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => mockAdmin }))
jest.mock('@/app/obras/obras/_lib/leitura', () => ({
  ...jest.requireActual('@/app/obras/obras/_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => mockLerObra(...a),
}))
jest.mock('@react-pdf/renderer', () => ({ renderToBuffer: async () => Buffer.from('%PDF-rdo') }))
jest.mock('@/app/obras/obras/_pdf/base', () => ({ registrarFontes: () => {} }))
jest.mock('@/app/obras/obras/_pdf/rdo', () => ({ DocumentoRdo: () => null }))
jest.mock('@/app/obras/obras/_pdf/carregar-rdo', () => ({ carregarPdfRdo: (...a: unknown[]) => mockRdo(...a) }))
jest.mock('@/app/obras/obras/_pdf/carregar-semanal', () => ({
  carregarPdfSemanal: (...a: unknown[]) => mockSemanal(...a),
  renderizarSemanal: async () => Buffer.from('%PDF-semanal'),
}))
jest.mock('@/app/obras/obras/_pdf/carregar-periodo', () => ({
  carregarPdfPeriodo: (...a: unknown[]) => mockPeriodo(...a),
  renderizarPeriodo: async () => Buffer.from('%PDF-periodo'),
}))
jest.mock('@/app/obras/obras/_pdf/carregar-ata', () => ({
  carregarPdfAta: (...a: unknown[]) => mockAta(...a),
  renderizarAta: async () => Buffer.from('%PDF-ata'),
}))

import { NextRequest } from 'next/server'
import { FakeAdmin } from '@/lib/portal-obra/__tests__/fixtures/fake-admin'
import type { ObraGrande } from '@/app/obras/obras/_lib/leitura'
import { lerDocumentosEnviados, lerGaleria } from '../(obra)/_lib/ler'
import { GET } from '../(obra)/obras/[obraId]/pdf/[envioId]/route'

const O = '11111111-1111-4111-8111-111111111111'
const OUTRA = '22222222-2222-4222-8222-222222222222'
const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Obra com uma etapa cuja referência (menor numero) é 77: o título da fase nunca mostra o 77. */
const og = {
  obra: { id: O, modalidade: 'obra', loja: 'DP Macaé 3' },
  plano: [{ numero: 77, etapa: 'Alvenaria', descricao: 'Alvenaria do depósito' }],
  etapas: [{ etapa: 'Alvenaria', numeros: [77], fim: '2026-11-20' }],
  calc: { atividades: [{ numero: 77, status: 'concluido', fimReal: '2026-11-18', inicioReal: '2026-11-02', inicioPrevisto: '2026-11-02', fimPrevisto: '2026-11-20' }] },
  calcBase: null,
} as unknown as ObraGrande

function banco() {
  const envio = (n: number, o: Record<string, unknown>) => ({
    id: u(n), obra_id: O, lado: 'cliente', destinatarios: ['cliente@loja.com.br'], resultado: 'ok', ...o,
  })
  return {
    obras_envio: [
      envio(1, { tipo: 'diario', referencia: '2026-11-03', rdo_id: 'rdo-ok', enviado_em: '2026-11-03T21:05:00Z' }),
      envio(2, { tipo: 'diario', referencia: '2026-11-03', rdo_id: 'rdo-ok', enviado_em: '2026-11-04T10:00:00Z' }), // reenvio: só o mais recente
      envio(3, { tipo: 'diario', referencia: '2026-11-04', rdo_id: 'rdo-desfeito', enviado_em: '2026-11-04T21:00:00Z' }),
      envio(4, { tipo: 'diario', referencia: '2026-11-05', rdo_id: 'rdo-int', enviado_em: '2026-11-05T21:00:00Z', lado: 'interno' }),
      envio(5, { tipo: 'diario', referencia: '2026-11-06', rdo_id: 'rdo-falhou', enviado_em: '2026-11-06T21:00:00Z', destinatarios: [], resultado: 'falha' }),
      envio(6, { tipo: 'semanal', referencia: '2026-11-02', semanal_id: 'sem-ok', enviado_em: '2026-11-06T20:00:00Z' }),
      envio(7, { tipo: 'fase', referencia: '2026-11-19', relatorio_id: 'rel-fase', enviado_em: '2026-11-19T20:00:00Z' }),
      envio(8, { tipo: 'mensal', referencia: '2026-10-30', relatorio_id: 'rel-rascunho', enviado_em: '2026-10-30T20:00:00Z' }),
      envio(9, { tipo: 'ata', referencia: '2026-10-28', registro_id: 'reg-ata', enviado_em: '2026-10-28T20:00:00Z' }),
      envio(10, { tipo: 'imediata', referencia: '2026-10-29', registro_id: 'reg-imed', enviado_em: '2026-10-29T20:00:00Z' }),
      envio(11, { tipo: 'diario', referencia: '2026-11-03', rdo_id: 'rdo-outra', enviado_em: '2026-11-07T21:00:00Z', obra_id: OUTRA }),
    ],
    obras_rdo: [
      { id: 'rdo-ok', obra_id: O, data: '2026-11-03', estado: 'enviado' },
      { id: 'rdo-desfeito', obra_id: O, data: '2026-11-04', estado: 'rascunho' },
      { id: 'rdo-int', obra_id: O, data: '2026-11-05', estado: 'enviado' },
      { id: 'rdo-falhou', obra_id: O, data: '2026-11-06', estado: 'validado' },
      { id: 'rdo-outra', obra_id: OUTRA, data: '2026-11-03', estado: 'enviado' },
    ],
    obras_semanal: [{ id: 'sem-ok', obra_id: O, semana_inicio: '2026-11-02', estado: 'enviado' }],
    obras_relatorio: [
      { id: 'rel-fase', obra_id: O, tipo: 'fase', referencia: '77', periodo_fim: '2026-11-18', estado: 'enviado' },
      { id: 'rel-rascunho', obra_id: O, tipo: 'mensal', referencia: '2026-10', periodo_fim: '2026-10-30', estado: 'rascunho' },
    ],
    obras_registro: [
      { id: 'reg-ata', obra_id: O, tipo: 'reuniao', data: '2026-10-28' },
      { id: 'reg-imed', obra_id: O, tipo: 'imediata', data: '2026-10-29' },
    ],
    obras_rdo_foto: [
      { id: 'f1', rdo_id: 'rdo-ok', path: `${O}/rdo/2026-11-03/aaa.jpg`, legenda: 'Piso do salão', ordem: 1, atividade_numero: 77 },
      { id: 'f2', rdo_id: 'rdo-ok', path: `${O}/rdo/2026-11-03/bbb.jpg`, legenda: null, ordem: 2 },
      { id: 'f3', rdo_id: 'rdo-ok', path: `${OUTRA}/rdo/2026-11-03/ccc.jpg`, legenda: 'caminho de outra obra', ordem: 3 },
      { id: 'f4', rdo_id: 'rdo-desfeito', path: `${O}/rdo/2026-11-04/ddd.jpg`, legenda: 'rascunho', ordem: 1 },
      { id: 'f5', rdo_id: 'rdo-outra', path: `${OUTRA}/rdo/2026-11-03/eee.jpg`, legenda: 'outra obra', ordem: 1 },
    ],
  }
}

function admin() {
  const a = new FakeAdmin(banco()) as FakeAdmin & { storage: unknown; assinadas: { paths: string[]; validade: number }[] }
  a.assinadas = []
  a.storage = {
    from: (b: string) => ({
      createSignedUrls: async (paths: string[], validade: number) => {
        a.assinadas.push({ paths, validade })
        return { data: paths.map((p) => ({ path: p, signedUrl: `https://sb/${b}/${p}?token=t`, error: null })), error: null }
      },
    }),
  }
  return a
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAdmin = admin()
  mockSessao.mockResolvedValue({ email: 'cliente@loja.com.br', obras: [O] })
  mockLerObra.mockResolvedValue({ ok: true, dados: og })
  mockRdo.mockResolvedValue({ ok: true, dados: {}, nomeArquivo: 'diario-dp-macae-3-2026-11-03.pdf' })
  mockSemanal.mockResolvedValue({ ok: true, dados: {}, nomeArquivo: 'semanal.pdf' })
  mockPeriodo.mockResolvedValue({ ok: true, dados: {}, nomeArquivo: 'fase-dp-macae-3-2026-11-18.pdf' })
  mockAta.mockResolvedValue({ ok: true, dados: {}, nomeArquivo: 'ata.pdf' })
})

describe('lerDocumentosEnviados', () => {
  it('só envio ao cliente com destinatário aceito, documento validado/enviado, desta obra; sem imediata; reenvio aparece uma vez', async () => {
    const r = await lerDocumentosEnviados(mockAdmin as never, O, og)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.documentos.map((d) => [d.envioId, d.titulo])).toEqual([
      [u(7), 'Relatório de fase — etapa 1, Alvenaria'],
      [u(6), 'Relatório semanal — semana de 02/11'],
      [u(2), 'Diário de obra — 03/11/2026'],
      [u(9), 'Ata de reunião — 28/10/2026'],
    ])
    expect(r.documentos[2].quando).toBe('enviado em 04/11/2026 às 07:00')
    // O numero (77) da referência da fase nunca vai ao texto exibido.
    expect(r.documentos.map((d) => `${d.titulo} ${d.quando}`).join(' ')).not.toContain('77')
  })

  it('erro de leitura: falha (a página avisa), nunca lista parcial', async () => {
    ;(mockAdmin as FakeAdmin).falhar.add('obras_rdo')
    expect(await lerDocumentosEnviados(mockAdmin as never, O, og)).toEqual({ ok: false })
  })
})

describe('GET /portal-obra/obras/<obra>/pdf/<envio>', () => {
  const pedir = (obra: string, envio: string) =>
    GET(new NextRequest(`http://x/portal-obra/obras/${obra}/pdf/${envio}`), { params: Promise.resolve({ obraId: obra, envioId: envio }) })

  it('sem sessão: 303 para /portal-obra, sem ler nada', async () => {
    mockSessao.mockResolvedValue(null)
    const r = await pedir(O, u(2))
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/portal-obra')
    expect(mockLerObra).not.toHaveBeenCalled()
  })

  it('obra de outro cliente: 404 genérico, sem ler a obra nem o envio', async () => {
    const r = await pedir(OUTRA, u(11))
    expect(r.status).toBe(404)
    expect(await r.text()).toBe('Documento não encontrado')
    expect(mockLerObra).not.toHaveBeenCalled()
    expect((mockAdmin as FakeAdmin).chamadas).toHaveLength(0)
  })

  it('envio de outra obra pela URL da minha obra: 404', async () => {
    expect((await pedir(O, u(11))).status).toBe(404)
    expect(mockRdo).not.toHaveBeenCalled()
  })

  it.each([
    ['lado interno', 4],
    ['envio sem destinatário aceito', 5],
    ['diário desfeito (rascunho)', 3],
    ['relatório em rascunho', 8],
    ['imediata (sem PDF)', 10],
    ['envio antigo substituído pelo reenvio', 1],
  ])('%s: 404 e nenhum carregador chamado', async (_n, envio) => {
    const r = await pedir(O, u(envio))
    expect(r.status).toBe(404)
    expect(await r.text()).toBe('Documento não encontrado')
    for (const m of [mockRdo, mockSemanal, mockPeriodo, mockAta]) expect(m).not.toHaveBeenCalled()
  })

  it('diário enviado: PDF do carregador do hub, com o admin e o id autorizado; sem cache', async () => {
    const r = await pedir(O, u(2))
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('application/pdf')
    expect(r.headers.get('cache-control')).toBe('private, no-store')
    expect(r.headers.get('content-disposition')).toBe('inline; filename="diario-dp-macae-3-2026-11-03.pdf"')
    expect(mockRdo).toHaveBeenCalledWith(mockAdmin, O, '2026-11-03')
  })

  it('semanal, fase e ata saem dos seus carregadores (a fase pela referência interna, nunca exposta na URL)', async () => {
    expect((await pedir(O, u(6))).status).toBe(200)
    expect(mockSemanal).toHaveBeenCalledWith(mockAdmin, O, '2026-11-02', expect.any(String))
    expect((await pedir(O, u(7))).status).toBe(200)
    expect(mockPeriodo).toHaveBeenCalledWith(mockAdmin, O, 'fase', '77', expect.any(String))
    expect((await pedir(O, u(9))).status).toBe(200)
    expect(mockAta).toHaveBeenCalledWith(mockAdmin, O, 'reg-ata')
  })

  it('carregador recusa (ex.: conteúdo não validado): 404 genérico', async () => {
    mockRdo.mockResolvedValue({ ok: false, status: 404, erro: 'Diário não validado' })
    const r = await pedir(O, u(2))
    expect(r.status).toBe(404)
    expect(await r.text()).toBe('Documento não encontrado')
  })

  it('erro de banco ao ler a obra: 500 (não um 404 silencioso)', async () => {
    mockLerObra.mockResolvedValue({ ok: false, erro: 'Falha ao ler a obra: timeout' })
    expect((await pedir(O, u(2))).status).toBe(500)
    mockLerObra.mockResolvedValue({ ok: false, erro: 'Obra não encontrada' })
    expect((await pedir(O, u(2))).status).toBe(404)
  })

  it('envio com id fora do formato: 404', async () => {
    expect((await pedir(O, 'rdo-ok')).status).toBe(404)
  })
})

describe('lerGaleria', () => {
  it('só fotos de diário validado/enviado desta obra, caminho canônico, etapa pela atividade (senão Geral), URL de 5 min', async () => {
    const a = mockAdmin as ReturnType<typeof admin>
    const r = await lerGaleria(a as never, O, og)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.fotos.map((f) => [f.id, f.etapa, f.data])).toEqual([
      ['f1', 'Alvenaria', '03/11/2026'],
      ['f2', 'Geral', '03/11/2026'],
    ])
    expect(a.assinadas).toEqual([{ paths: [`${O}/rdo/2026-11-03/aaa.jpg`, `${O}/rdo/2026-11-03/bbb.jpg`], validade: 300 }])
    expect(JSON.stringify(r)).not.toMatch(/numero|atividade_numero|77/)
  })
})
