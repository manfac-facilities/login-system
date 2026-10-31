/**
 * Relatório de período (Leva 4 §2.1): referência estrita por tipo,
 * disponibilidade (fase só com etapa concluída, entrega só com a obra
 * concluída), highlights marcados/desmarcados, amostra de fotos, esquema do
 * congelado e o PDF (versão cliente, sem R$/oculto/ids, curva S).
 */
jest.mock('@react-pdf/renderer', () => {
  const R = jest.requireActual('react')
  const el =
    (tag: string) =>
    ({ children, render }: { children?: unknown; render?: (p: { pageNumber: number; totalPages: number }) => string }) =>
      R.createElement(tag, null, render ? render({ pageNumber: 1, totalPages: 1 }) : children)
  return {
    Document: el('pdf-document'),
    Page: el('pdf-page'),
    View: el('pdf-view'),
    Text: el('pdf-text'),
    Svg: el('pdf-svg'),
    Polyline: ({ points }: { points: string }) => R.createElement('pdf-polyline', { 'data-points': points }),
    Line: () => R.createElement('pdf-line'),
    Image: () => R.createElement('pdf-image'),
    StyleSheet: { create: <T,>(s: T) => s },
    Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  }
})
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { render } from '@testing-library/react'
import { highlightsDoPeriodo } from '../../_lib/highlights'
import { montarEmailPeriodo } from '../../_lib/email-periodo'
import { montarConteudoPeriodo } from '../../_lib/relatorio-periodo'
import {
  amostraDeFotos,
  conteudoPeriodoDe,
  periodoDisponivel,
  relatorioRowDe,
  relatorioValido,
  textosDosHighlights,
  ultimoMesDoMensal,
  validacaoLiberadaEm,
  type DadosPeriodo,
} from '../carregar-periodo'
import { DocumentoPeriodo, montarDadosPdfPeriodo } from '../periodo'
import { obraPeriodo } from './fixtures/periodo'

const HOJE = '2026-11-10'

describe('relatorioValido', () => {
  it('regex por tipo, igual ao check do banco', () => {
    expect(relatorioValido('mensal', '2026-11')).toBe(true)
    expect(relatorioValido('fase', '10')).toBe(true)
    expect(relatorioValido('fase', '0')).toBe(true)
    expect(relatorioValido('entrega', 'entrega')).toBe(true)
    for (const [t, r] of [['mensal', '2026-00'], ['mensal', '2026-13'], ['mensal', '2026-11 '], ['fase', '01'], ['fase', '-1'], ['fase', '1e3'], ['fase', '9999999999'], ['entrega', 'Entrega'], ['semanal', '2026-11'], ['constructor', 'x'], [1, '1']]) {
      expect(relatorioValido(t, r)).toBe(false)
    }
  })
})

describe('periodoDisponivel', () => {
  it('fase: só etapa concluída; período início real → conclusão', () => {
    expect(periodoDisponivel(obraPeriodo(), 'fase', '10', HOJE)).toEqual({ ok: true, inicio: '2026-10-26', fim: '2026-11-06' })
    expect(periodoDisponivel(obraPeriodo(), 'fase', '30', HOJE)).toEqual({ ok: false, erro: expect.stringMatching(/não concluída/) })
  })

  it('entrega: só com a obra concluída; data-base → término real', () => {
    expect(periodoDisponivel(obraPeriodo(), 'entrega', 'entrega', HOJE).ok).toBe(false)
    expect(periodoDisponivel(obraPeriodo({ tudoConcluido: true }), 'entrega', 'entrega', '2026-11-30')).toEqual({ ok: true, inicio: '2026-10-26', fim: '2026-11-25' })
  })

  it('mensal: do 1º dia (ou data-base) ao último dia útil; mês futuro ou antes da base não', () => {
    expect(periodoDisponivel(obraPeriodo(), 'mensal', '2026-10', HOJE)).toEqual({ ok: true, inicio: '2026-10-26', fim: '2026-10-30' })
    expect(periodoDisponivel(obraPeriodo(), 'mensal', '2026-12', HOJE).ok).toBe(false)
    expect(periodoDisponivel(obraPeriodo(), 'mensal', '2026-09', HOJE).ok).toBe(false)
    // Depois do mês do término (projetado 27/11) não há mensal.
    expect(ultimoMesDoMensal(obraPeriodo())).toBe('2026-11')
    expect(periodoDisponivel(obraPeriodo(), 'mensal', '2026-12', '2027-01-10')).toEqual({ ok: false, erro: expect.stringMatching(/término/) })
    expect(ultimoMesDoMensal(obraPeriodo({ tudoConcluido: true }))).toBe('2026-11')
    const sem = obraPeriodo()
    sem.obra = { ...sem.obra, data_base: null }
    expect(periodoDisponivel(sem, 'mensal', '2026-11', HOJE)).toEqual({ ok: false, erro: expect.stringMatching(/data-base/) })
  })
})

const dados = (over: Partial<DadosPeriodo> = {}): DadosPeriodo => {
  const og = obraPeriodo()
  const p = { obra: og, inicio: '2026-10-26', fim: '2026-11-06', ref: '2026-11-06', planos: [] }
  return {
    og, tipo: 'fase', referencia: '10', inicio: p.inicio, fim: p.fim, ref: p.ref, hoje: HOJE, planos: [], restricoes: [],
    relatorio: null, automaticos: highlightsDoPeriodo(p), ...over,
  }
}

describe('validacaoLiberadaEm', () => {
  it('mensal: último dia útil do mês com os feriados da obra; fase/entrega: sem trava de data', () => {
    expect(validacaoLiberadaEm(obraPeriodo(), 'mensal', '2026-11')).toBe('2026-11-30')
    const og = obraPeriodo()
    og.feriados = new Set(['2026-11-30'])
    expect(validacaoLiberadaEm(og, 'mensal', '2026-11')).toBe('2026-11-27')
    expect(validacaoLiberadaEm(og, 'fase', '10')).toBeNull()
    expect(validacaoLiberadaEm(og, 'entrega', 'entrega')).toBeNull()
  })
})

describe('highlights marcados', () => {
  it('sem seleção salva: todos; com seleção: todos menos os desmarcados + o livre; novo automático nasce marcado', () => {
    const a = dados().automaticos
    expect(a.map((h) => h.id)).toEqual(['etapa-antecipada:10', 'atividade-antecipada:10', 'atividade-antecipada:20', 'impedimento-resolvido:cli'])
    expect(textosDosHighlights(a, null)).toHaveLength(4)
    const t = textosDosHighlights(a, { desmarcados: ['etapa-antecipada:10', 'atividade-antecipada:10', 'impedimento-resolvido:cli'], livre: 'Livre' })
    expect(t).toEqual([a[2].texto, 'Livre'])
    // Seleção salva antes de o destaque existir: ele não está nos desmarcados, então entra.
    const novo = { id: 'ppc:2026-11-09', texto: 'Semana de 09/11: 100% do plano cumprido (PPC)' }
    expect(textosDosHighlights([...a, novo], { desmarcados: [a[0].id], livre: null })).toContain(novo.texto)
  })

  it('desmarcado não aparece no conteúdo, no e-mail nem no PDF; id nunca aparece', () => {
    const rel = relatorioRowDe(
      { id: 'r', estado: 'rascunho', periodo_inicio: '2026-10-26', periodo_fim: '2026-11-06', highlights: { desmarcados: ['atividade-antecipada:10', 'atividade-antecipada:20', 'impedimento-resolvido:cli'], livre: null } },
      'fase', '10',
    )
    const c = conteudoPeriodoDe(dados({ relatorio: rel }), 'cliente')
    expect(c.highlights).toHaveLength(1)
    expect(c.highlights[0]).toMatch(/^Etapa 1 — Demolição concluída/)
    const email = montarEmailPeriodo(c, { fotos: 0 })
    const pdf = render(<DocumentoPeriodo d={montarDadosPdfPeriodo({ conteudo: c, os: null, cliente: null, engenheiro: null, validadoEm: null, fotos: [], fotosOmitidas: 0, geradoEm: '2026-11-10T12:00:00Z', logo: null })} />).container.textContent ?? ''
    for (const t of [JSON.stringify(c), email.html, email.texto, pdf]) {
      expect(t).not.toContain('Demolição do piso concluída em')
      expect(t).not.toContain('Retirada de entulho concluída em')
      expect(t).not.toContain('Resolvido em')
      expect(t).not.toMatch(/antecipada:|resolvido:|R\$|98765|123456|Pedreiro faltou/)
    }
    expect(pdf).toContain('Destaques do período')
    expect(email.html).toContain('Destaques do período')
  })
})

describe('esquema do congelado e da seleção', () => {
  const congelado = () => {
    const base = { tipo: 'fase' as const, referencia: '10', obra: obraPeriodo(), inicio: '2026-10-26', fim: '2026-11-06', ref: '2026-11-06', hoje: HOJE, planos: [], restricoes: [], highlights: ['Congelado'], observacoes: 'Validado assim.' }
    return JSON.parse(JSON.stringify({ cliente: montarConteudoPeriodo({ ...base, lado: 'cliente' }), interno: montarConteudoPeriodo({ ...base, lado: 'interno' }), fotos: ['f1'] }))
  }
  const linha = (conteudo: unknown, highlights: unknown = null) =>
    relatorioRowDe({ id: 'r', estado: 'validado', periodo_inicio: '2026-10-26', periodo_fim: '2026-11-06', conteudo, highlights }, 'fase', '10')

  it('válido: usado; tipo/referência trocados, oculto no cliente ou fotos demais: descartado', () => {
    expect(linha(congelado()).conteudo?.cliente.highlights).toEqual(['Congelado'])
    expect(relatorioRowDe({ id: 'r', estado: 'validado', periodo_inicio: 'x', periodo_fim: 'x', conteudo: congelado() }, 'fase', '30').conteudo).toBeNull()
    const c1 = congelado()
    c1.cliente.ocultos = [{ rotulo: 'a', corpo: 'b' }]
    expect(linha(c1).conteudo).toBeNull()
    const c2 = congelado()
    c2.fotos = Array.from({ length: 13 }, (_, i) => `f${i}`)
    expect(linha(c2).conteudo).toBeNull()
    const c3 = congelado()
    c3.cliente.highlights = [{ id: 'atividade-antecipada:10' }]
    expect(linha(c3).conteudo).toBeNull()
    // Validado com congelado descartado: montado na hora, nunca o lixo.
    const d = dados({ relatorio: linha(c1) })
    expect(conteudoPeriodoDe(d, 'cliente').ocultos).toEqual([])
  })

  it('seleção de highlights fora do formato: ignorada (todos marcados)', () => {
    expect(linha(null, { desmarcados: 'x' }).highlights).toBeNull()
    expect(linha(null, { desmarcados: [1] }).highlights).toBeNull()
    expect(linha(null, { marcados: ['a'] }).highlights).toBeNull()
    expect(linha(null, { desmarcados: [], livre: 'x'.repeat(301) }).highlights).toBeNull()
    expect(linha(null, { desmarcados: ['a'], livre: '  ' }).highlights).toEqual({ desmarcados: ['a'], livre: null })
  })
})

describe('amostraDeFotos', () => {
  const f = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, path: 'p', legenda: null, data: '2026-11-01' }))
  it('até o máximo, espalhadas, com a primeira e a última', () => {
    expect(amostraDeFotos(f(5), 12)).toHaveLength(5)
    const a = amostraDeFotos(f(40), 12)
    expect(a).toHaveLength(12)
    expect(a[0].id).toBe('f0')
    expect(a[11].id).toBe('f39')
    expect(new Set(a.map((x) => x.id)).size).toBe(12)
  })
})

describe('PDF do período', () => {
  const conteudo = (lado: 'cliente' | 'interno', tipo: 'mensal' | 'entrega' = 'mensal') =>
    montarConteudoPeriodo({
      lado, tipo, referencia: tipo === 'mensal' ? '2026-11' : 'entrega', obra: obraPeriodo({ tudoConcluido: tipo === 'entrega' }),
      inicio: '2026-11-01', fim: '2026-11-30', ref: HOJE, hoje: HOJE, planos: [], restricoes: [], highlights: ['Destaque livre'], observacoes: 'Mês produtivo.',
    })
  const pdf = (c: ReturnType<typeof conteudo>) =>
    montarDadosPdfPeriodo({
      conteudo: c, os: 'OS-4321', cliente: 'DPSP', engenheiro: 'eng@manfac.com.br', validadoEm: '2026-11-10T20:00:00Z',
      fotos: [{ dados: Buffer.from([0xff, 0xd8, 0xff]), formato: 'jpg', legenda: 'fachada', data: '2026-11-04' }],
      fotosOmitidas: 0, geradoEm: '2026-11-11T12:00:00Z', logo: null,
    })

  it('versão cliente: seções, curva S sem NaN, destaques, observações, fotos; sem R$ nem oculto', () => {
    const { container } = render(<DocumentoPeriodo d={pdf(conteudo('cliente'))} />)
    const t = container.textContent ?? ''
    expect(t).toContain('RELATÓRIO MENSAL DE OBRA')
    expect(t).toContain('Curva S')
    expect(t).toContain('Destaque livre')
    expect(t).toContain('Mês produtivo.')
    expect(t).toContain('04/11 · fachada')
    expect(t).not.toMatch(/R\$|98765|123456|Pedreiro faltou|NaN/)
    const pontos = [...container.querySelectorAll('pdf-polyline')].map((p) => p.getAttribute('data-points') ?? '')
    expect(pontos.length).toBeGreaterThan(0)
    expect(pontos.join(' ')).not.toMatch(/NaN|Infinity/)
  })

  it('entrega: comparativo base × final', () => {
    const t = render(<DocumentoPeriodo d={pdf(conteudo('cliente', 'entrega'))} />).container.textContent ?? ''
    expect(t).toContain('RELATÓRIO DE ENTREGA DE OBRA')
    expect(t).toContain('Comparativo base × final')
  })

  it('recusa o conteúdo interno', () => {
    expect(() => pdf(conteudo('interno'))).toThrow()
  })
})
