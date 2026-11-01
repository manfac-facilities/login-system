/**
 * Situação para o cliente nos relatórios (Leva 5 §7, Task 6): semanal e
 * mensal/fase/entrega levam a situação publicada vigente no conteúdo
 * (congelado junto na validação), no e-mail (HTML e texto) e no PDF. Sem
 * situação, o conteúdo não ganha campo e o e-mail sai igual. Os validadores do
 * congelado aceitam o conteúdo antigo (sem o campo) e recusam situação fora do formato.
 */
jest.mock('@react-pdf/renderer', () => {
  const R = jest.requireActual('react')
  const el =
    (tag: string) =>
    ({ children, render }: { children?: unknown; render?: (p: { pageNumber: number; totalPages: number }) => string }) =>
      R.createElement(tag, null, render ? render({ pageNumber: 1, totalPages: 2 }) : children)
  return {
    Document: el('pdf-document'), Page: el('pdf-page'), View: el('pdf-view'), Text: el('pdf-text'),
    Image: () => R.createElement('pdf-image'),
    StyleSheet: { create: <T,>(s: T) => s },
    Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  }
})

import { render } from '@testing-library/react'
import { conteudoSemanalValido, montarConteudoSemanal, montarEmailSemanal } from '../../_lib/email-semanal'
import { montarEmailPeriodo } from '../../_lib/email-periodo'
import { conteudoPeriodoValido, montarConteudoPeriodo } from '../../_lib/relatorio-periodo'
import type { SituacaoRelatorio } from '../../_lib/situacao'
import { DocumentoSemanal, montarDadosPdfSemanal } from '../semanal'
import { conteudoSemanalDe } from '../carregar-semanal'
import { DocumentoPeriodo, montarDadosPdfPeriodo } from '../periodo'
import { obraGrandePdf } from './fixtures/rdo'

const SIT: SituacaoRelatorio = {
  explicacao: 'O atraso é de responsabilidade da Manfac: o drywall levou mais tempo que o planejado.',
  acoes: [{ oque: 'Segunda equipe de drywall', quando: 'desde 23/11', efeito: 'recupera cerca de 2 dias úteis' }],
  atualizadoEm: '16/11/2026',
  por: 'Jose Guilherme',
}

const semanal = (lado: 'cliente' | 'interno', situacao?: SituacaoRelatorio | null) =>
  montarConteudoSemanal({
    lado, obra: obraGrandePdf(), segunda: '2026-10-26', ref: '2026-10-30', hoje: '2026-10-30',
    plano: null, planoProximo: null, restricoes: [], observacoes: 'Obs.', situacao,
  })

const periodo = (situacao?: SituacaoRelatorio | null) =>
  montarConteudoPeriodo({
    lado: 'cliente', tipo: 'mensal', referencia: '2026-10', obra: obraGrandePdf(), inicio: '2026-10-01', fim: '2026-10-31',
    ref: '2026-10-30', hoje: '2026-10-30', planos: [], restricoes: [], highlights: [], observacoes: null, situacao,
  })

describe('semanal', () => {
  it('sem situação: nenhum campo novo e o e-mail sai igual ao de antes', () => {
    const sem = semanal('cliente')
    expect(sem).not.toHaveProperty('situacao')
    expect(semanal('cliente', null)).toEqual(sem)
    const e = montarEmailSemanal(sem, { fotos: 0 })
    expect(e.html).not.toContain('Situação da obra')
    expect(e.texto).not.toContain('SITUAÇÃO DA OBRA')
  })

  it('com situação: no conteúdo (cliente e interno), no e-mail e no PDF', () => {
    const c = semanal('cliente', SIT)
    expect(c.situacao).toEqual(SIT)
    expect(semanal('interno', SIT).situacao).toEqual(SIT)
    const e = montarEmailSemanal(c, { fotos: 0 })
    expect(e.html).toContain('Situação da obra')
    expect(e.html).toContain('O que estamos fazendo para recuperar')
    expect(e.html).toContain('Segunda equipe de drywall · desde 23/11 · recupera cerca de 2 dias úteis')
    expect(e.texto).toContain('SITUAÇÃO DA OBRA')
    expect(e.texto).toContain('Atualizado em 16/11/2026 por Jose Guilherme.')
    const pdf = montarDadosPdfSemanal({
      conteudo: c, os: 'OS', cliente: 'DPSP', engenheiro: null, validadoEm: null, fotos: [], fotosOmitidas: 0, geradoEm: '2026-10-31T12:00:00Z', logo: null,
    })
    const { container } = render(<DocumentoSemanal d={pdf} />)
    expect(container.textContent).toContain('responsabilidade da Manfac')
    expect(container.textContent).toContain('Atualizado em 16/11/2026 por Jose Guilherme')
  })

  it('rascunho monta com a situação vigente lida; validado/enviado usa o congelado (a situação não muda depois)', () => {
    const d = {
      og: obraGrandePdf(), segunda: '2026-10-26', sexta: '2026-10-30', ref: '2026-10-30', hoje: '2026-10-30',
      plano: null, planoProximo: null, restricoes: [], semanal: null, situacao: SIT,
    }
    expect(conteudoSemanalDe(d, 'cliente').situacao).toEqual(SIT)
    const congelado = semanal('cliente', SIT)
    const validado = {
      ...d,
      situacao: { ...SIT, explicacao: 'Versão nova publicada depois.' },
      semanal: { id: 's', estado: 'validado' as const, observacoes: null, conteudo: { cliente: congelado, interno: semanal('interno', SIT), fotos: [] }, validadoPor: null, validadoEm: null },
    }
    expect(conteudoSemanalDe(validado, 'cliente').situacao).toEqual(SIT)
  })

  it('validador do congelado: antigo (sem campo) ok; situação fora do formato recusada', () => {
    expect(conteudoSemanalValido(semanal('cliente'), 'cliente')).toBe(true)
    expect(conteudoSemanalValido(semanal('cliente', SIT), 'cliente')).toBe(true)
    expect(conteudoSemanalValido({ ...semanal('cliente'), situacao: { ...SIT, explicacao: 'Custou R$ 3 mil' } }, 'cliente')).toBe(false)
    expect(conteudoSemanalValido({ ...semanal('cliente'), situacao: { ...SIT, email: 'x@y' } }, 'cliente')).toBe(false)
    expect(conteudoSemanalValido({ ...semanal('cliente'), situacao: null }, 'cliente')).toBe(false)
  })
})

describe('mensal/fase/entrega', () => {
  it('sem situação: nada muda; com situação: conteúdo, e-mail e PDF', () => {
    const sem = periodo()
    expect(sem).not.toHaveProperty('situacao')
    expect(montarEmailPeriodo(sem, { fotos: 0 }).html).not.toContain('Situação da obra')
    const c = periodo(SIT)
    const e = montarEmailPeriodo(c, { fotos: 0 })
    expect(e.html).toContain('O que estamos fazendo para recuperar')
    expect(e.texto).toContain('SITUAÇÃO DA OBRA')
    const pdf = montarDadosPdfPeriodo({
      conteudo: c, os: 'OS', cliente: 'DPSP', engenheiro: null, validadoEm: null, fotos: [], fotosOmitidas: 0, geradoEm: '2026-10-31T12:00:00Z', logo: null,
    } as Parameters<typeof montarDadosPdfPeriodo>[0])
    const { container } = render(<DocumentoPeriodo d={pdf} />)
    expect(container.textContent).toContain('Segunda equipe de drywall')
  })

  it('validador do congelado', () => {
    const esperado = { tipo: 'mensal' as const, referencia: '2026-10' }
    expect(conteudoPeriodoValido(periodo(), 'cliente', esperado)).toBe(true)
    expect(conteudoPeriodoValido(periodo(SIT), 'cliente', esperado)).toBe(true)
    expect(conteudoPeriodoValido({ ...periodo(), situacao: { ...SIT, acoes: 'x' } }, 'cliente', esperado)).toBe(false)
  })
})
