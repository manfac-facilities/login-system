/**
 * PDF do diário (Leva 2 §3.3): dados → árvore do documento. O react-pdf é
 * trocado por elementos simples para ler o texto da árvore no jsdom.
 * Critério 1 do plano: versão cliente sem R$, sem item oculto, sem área interna.
 */
jest.mock('@react-pdf/renderer', () => {
  const R = jest.requireActual('react')
  const el =
    (tag: string) =>
    ({ children, render }: { children?: unknown; render?: (p: { pageNumber: number; totalPages: number }) => string }) =>
      R.createElement(tag, null, render ? render({ pageNumber: 1, totalPages: 2 }) : children)
  return {
    Document: el('pdf-document'),
    Page: el('pdf-page'),
    View: el('pdf-view'),
    Text: el('pdf-text'),
    Image: () => R.createElement('pdf-image'),
    StyleSheet: { create: <T,>(s: T) => s },
    Font: { register: jest.fn(), registerHyphenationCallback: jest.fn() },
  }
})

import { render } from '@testing-library/react'
import { DocumentoRdo, montarDadosPdfRdo } from '../rdo'
import { obraGrandePdf, rdoPdf } from './fixtures/rdo'
import type { RdoCompleto } from '../../_lib/email-diario'

const foto = { dados: Buffer.from([0xff, 0xd8, 0xff]), formato: 'jpg' as const, legenda: 'fachada' }

function montar(over: Partial<RdoCompleto> = {}, extra: Partial<Parameters<typeof montarDadosPdfRdo>[0]> = {}) {
  return montarDadosPdfRdo({
    obra: obraGrandePdf(),
    rdo: rdoPdf(over),
    equipe: { efetivo: 6, texto: '2 pedreiros, 2 serventes' },
    validadoPor: 'eng@manfac.com.br',
    validadoEm: '2026-10-29T21:40:00Z',
    diaN: 4,
    fotos: [foto, foto],
    fotosOmitidas: 1,
    geradoEm: '2026-10-30T12:05:00Z',
    logo: null,
    ...extra,
  })
}

const texto = (d: ReturnType<typeof montar>) => render(<DocumentoRdo d={d} />).container.textContent ?? ''

describe('PDF do diário — versão cliente', () => {
  it('é sempre o lado cliente', () => {
    expect(montar().conteudo.lado).toBe('cliente')
  })

  it('não mostra R$, peso, valor, impedimento/orientação ocultos nem encerrados', () => {
    const t = texto(montar())
    for (const proibido of ['R$', '98765', '98.765', '123456', '123.456', 'Pedreiro faltou', 'Orientação interna', 'Já resolvido antes', 'INTERNO']) {
      expect(t).not.toContain(proibido)
    }
  })

  it('Manfac aparece sem a área interna (tipo do impedimento e causa material/equipe)', () => {
    const d = montar()
    const t = texto(d)
    expect(t).toContain('Atraso na entrega do perfil')
    expect(t).not.toContain('Material Manfac')
    // "Equipe" é título de seção; o que não pode é causa/tipo interno depois do travessão.
    expect(t).not.toMatch(/— (Material|Equipe)/)
    const material = d.conteudo.naoAvancou.find((a) => a.numero === 4)!
    expect(material).toMatchObject({ causa: null, responsavel: 'Manfac' })
    expect(t).not.toMatch(/Material(?! Manfac)/)
  })

  it('cabeçalho: obra, OS, cliente, data, dia N, engenheiro', () => {
    const t = texto(montar())
    for (const s of ['RELATÓRIO DIÁRIO DE OBRA', 'DP Macaé 3', 'OS-4321', 'DPSP', '29/10/2026', 'dia 4', 'eng@manfac.com.br']) {
      expect(t).toContain(s)
    }
  })

  it('seções: clima por turno, equipe, de → para, não avançou com causa, impedimentos, orientações, amanhã, fotos', () => {
    const t = texto(montar())
    expect(t).toContain('Manhã:')
    expect(t).toContain('Sol')
    expect(t).toContain('Chuva')
    expect(t).toContain('6 pessoas · 2 pedreiros, 2 serventes')
    expect(t).toContain('Demolição do piso')
    expect(t).toContain('concluída')
    expect(t).toMatch(/Alvenaria do depósito20%55%em andamento/)
    expect(t).toContain('Não avançou hoje')
    expect(t).toMatch(/Atividade 50%ProjetoCliente/)
    expect(t).toContain('Autorização de baixa das gôndolas')
    expect(t).toContain('Manter o corredor livre — recebida por Ana')
    expect(t).toContain('Concluir alvenaria e iniciar elétrica')
    expect(t).toContain('fachada')
    expect(t).toContain('1 foto omitida')
  })

  it('rodapé: gerado em … a partir do diário validado em …, com página', () => {
    const t = texto(montar())
    expect(t).toContain('gerado em 30/10/2026 às 09:05 a partir do diário validado em 29/10/2026 às 18:40')
    expect(t).toContain('página 1 de 2')
  })

  it('sem execução: mostra o motivo no lugar da tabela de serviços', () => {
    const t = texto(montar({ semExecucao: true, motivoSemExecucao: 'chuva forte', avancos: [] }))
    expect(t).toContain('Sem execução hoje — chuva forte')
    expect(t).not.toContain('Não avançou hoje')
  })

  it('sem fotos nem omitidas: não há seção de fotos', () => {
    expect(texto(montar({}, { fotos: [], fotosOmitidas: 0 }))).not.toContain('Fotos do dia')
  })
})
