/**
 * Relatório semanal (Leva 3 §2.3): lado cliente sem R$, sem item oculto e sem
 * área interna; restrição liberada some; PPC sem plano; resumo da IA só do cliente.
 */
import { conteudoSemanalValido, montarConteudoSemanal, montarEmailSemanal, resumoParaIa } from '../email-semanal'
import type { AtividadeCalculada } from '../cronograma'
import type { PlanoSemana, Restricao } from '../last-planner'
import { imp, obraGrandePdf } from '../../_pdf/__tests__/fixtures/rdo'

const SEG = '2026-10-26'

const ativ = (numero: number, over: Partial<AtividadeCalculada> = {}): AtividadeCalculada =>
  ({
    numero, etapa: 'E', descricao: `Atividade ${numero}`, pred1: null, pred2: null, duracao: 5, bloqueiaPorTrava: false,
    pesoValor: 98765, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null,
    inicioPrevisto: '2026-10-26', fimPrevisto: '2026-10-30', inicioProjetado: '2026-10-26', fimProjetado: '2026-11-03',
    peso: 1 / 6, percentualPrevisto: 0, situacao: 'no_prazo', travada: false, inicioFixo: null, diasRestantes: null,
    alertaInicioFixo: null, inicioFixoAjustado: false, ...over,
  }) as AtividadeCalculada

const restricao = (over: Partial<Restricao>): Restricao => ({
  id: 'r', obraId: 'o1', atividadeNumero: 3, tipo: 'decisao_cliente', descricao: 'Aprovar o layout do depósito',
  responsavel: 'cliente', prazo: '2026-10-28', situacao: 'identificada', liberadaEm: null, criadoPor: null,
  criadoEm: '2026-10-20T10:00:00Z', ...over,
})

const plano: PlanoSemana = {
  id: 'p1', obraId: 'o1', semanaInicio: SEG, fechadoEm: '2026-10-24T18:00:00Z', fechadoPor: 'eng@manfac.com.br',
  itens: [
    { id: 'a', planoId: 'p1', numero: 1, metaPercentual: 1, percentualFinal: 1, cumprido: true, causa: null, avaliadoEm: 'x' },
    { id: 'b', planoId: 'p1', numero: 3, metaPercentual: 0.6, percentualFinal: 0.4, cumprido: false, causa: 'material', avaliadoEm: 'x' },
    { id: 'c', planoId: 'p1', numero: 4, metaPercentual: 0.5, percentualFinal: 0.2, cumprido: false, causa: 'projeto', avaliadoEm: 'x' },
  ],
}

function conteudo(lado: 'cliente' | 'interno', over: Partial<Parameters<typeof montarConteudoSemanal>[0]> = {}) {
  const og = obraGrandePdf()
  og.calc = {
    ...og.calc!,
    atividades: [
      ativ(1, { descricao: 'Demolição do piso', status: 'concluido', percentual: 1, fimReal: '2026-10-28' }),
      ativ(2, { status: 'concluido', percentual: 1, fimReal: '2026-10-20' }),
      ativ(3, { descricao: 'Alvenaria do depósito', status: 'em_andamento', percentual: 0.4 }),
    ],
  }
  return montarConteudoSemanal({
    lado, obra: og, segunda: SEG, ref: '2026-10-30', hoje: '2026-10-30', plano, planoProximo: null,
    restricoes: [
      restricao({ id: 'aberta' }),
      restricao({ id: 'lib', descricao: 'Liberar a área do caixa', situacao: 'liberada' }),
      restricao({ id: 'manf', descricao: 'Comprar o perfil', responsavel: 'manfac', tipo: 'material' }),
    ],
    observacoes: '  Alvenaria atrasou por material.  ',
    ...over,
  })
}

describe('montarConteudoSemanal', () => {
  it('cliente: sem R$, sem oculto, sem área interna, sem restrição liberada', () => {
    const c = conteudo('cliente')
    const { html, texto } = montarEmailSemanal(c, { fotos: 2 })
    for (const s of [html, texto, resumoParaIa(c)]) {
      expect(s).not.toMatch(/R\$|98765|98\.765|123456/)
      expect(s).not.toContain('Pedreiro faltou') // impedimento oculto
      expect(s).not.toContain('Liberar a área do caixa') // restrição liberada
      expect(s).not.toContain('Comprar o perfil') // restrição da Manfac não é "do cliente"
      expect(s).not.toContain('Material') // causa interna da Manfac
    }
    expect(c.naoCumpridos.find((n) => n.descricao === 'Alvenaria do depósito')).toMatchObject({ causa: null, responsavel: 'Manfac' })
    expect(c.naoCumpridos.find((n) => n.descricao === 'Instalação elétrica')).toMatchObject({ causa: 'Projeto', responsavel: 'Cliente' })
    expect(c.doCliente).toEqual([expect.objectContaining({ descricao: 'Aprovar o layout do depósito', vencida: true })])
    expect(texto).toContain('2 fotos da semana no PDF anexo')
  })

  it('interno: mostra o oculto e a causa da Manfac', () => {
    const c = conteudo('interno')
    expect(c.ocultos.map((o) => o.corpo).join()).toContain('Pedreiro faltou')
    expect(c.naoCumpridos[0]).toMatchObject({ causa: 'Material', responsavel: 'Manfac' })
    expect(c.assunto).toMatch(/interno$/)
  })

  it('PPC, concluídas da semana, em andamento e observações', () => {
    const c = conteudo('cliente')
    expect(c.ppc).toEqual({ valor: '33%', cumpridos: 1, avaliados: 3, planejados: 3 })
    expect(c.concluidas).toEqual([{ descricao: 'Demolição do piso', fim: '28/10/2026' }])
    expect(c.emAndamento).toEqual([{ descricao: 'Alvenaria do depósito', percentual: '40%', termino: '03/11/2026' }])
    expect(c.observacoes).toBe('Alvenaria atrasou por material.')
    expect(c.proximaSemana).toBeNull()
  })

  it('sem plano: PPC null e texto "sem plano fechado"', () => {
    const c = conteudo('cliente', { plano: null })
    expect(c.ppc).toBeNull()
    expect(montarEmailSemanal(c, { fotos: 0 }).texto).toContain('sem plano fechado')
  })

  it('impedimento encerrado antes da semana não entra; aberto na semana entra', () => {
    const og = obraGrandePdf({
      impedimentos: [
        imp({ id: 'velho', descricao: 'Antigo resolvido', abertoEm: '2026-10-10', encerradoEm: '2026-10-20' }),
        imp({ id: 'novo', descricao: 'Gôndolas no caminho', abertoEm: '2026-10-27', encerradoEm: '2026-10-29' }),
      ],
    })
    const c = montarConteudoSemanal({
      lado: 'cliente', obra: og, segunda: SEG, ref: '2026-10-30', hoje: '2026-10-30', plano: null, planoProximo: null,
      restricoes: [], observacoes: null,
    })
    expect(c.impedimentos.map((i) => i.corpo).join()).toContain('Gôndolas no caminho')
    expect(c.impedimentos.map((i) => i.corpo).join()).not.toContain('Antigo resolvido')
  })

  it('cliente vê o código exibido da atividade, nunca o numero interno', () => {
    const og = obraGrandePdf({
      impedimentos: [
        imp({ id: 'na', descricao: 'Gôndolas no caminho', abertoEm: '2026-10-27', atividadeNumero: 3 }),
        imp({ id: 'velha', descricao: 'Forro antigo', abertoEm: '2026-10-27', atividadeNumero: 99 }),
      ],
    })
    // numero 3 é a 2ª atividade da 2ª etapa: código 2.2.
    og.calc = { ...og.calc!, atividades: [ativ(1, { etapa: 'A' }), ativ(7, { etapa: 'B' }), ativ(3, { etapa: 'B', descricao: 'Alvenaria do depósito' })] }
    const c = montarConteudoSemanal({
      lado: 'cliente', obra: og, segunda: SEG, ref: '2026-10-30', hoje: '2026-10-30', plano: null, planoProximo: null,
      restricoes: [restricao({ id: 'aberta' }), restricao({ id: 'fora', atividadeNumero: 99, descricao: 'Definir cor' })],
      observacoes: null,
    })
    expect(c.doCliente.map((r) => r.atividade)).toEqual(['2.2 — Alvenaria do depósito', 'fora da versão vigente'])
    const corpos = c.impedimentos.map((i) => i.corpo).join(' | ')
    expect(corpos).toContain('atividade 2.2 (Alvenaria do depósito)')
    expect(corpos).toContain('atividade fora da versão vigente')
    const { html, texto } = montarEmailSemanal(c, { fotos: 0 })
    for (const t of [html, texto]) {
      expect(t).not.toMatch(/atividade 3|atividade 99|Atividade 99/)
      expect(t).toContain('atividade 2.2')
    }
  })

  it('semana em curso: rótulo do previsto é a data de referência, não a sexta', () => {
    const c = conteudo('cliente', { ref: '2026-10-28', hoje: '2026-10-28' })
    expect(c.avanco.ate).toBe('28/10/2026')
    expect(montarEmailSemanal(c, { fotos: 0 }).html).toContain('previsto até 28/10/2026')
    expect(conteudo('cliente').avanco.ate).toBe('a sexta')
  })

  it('resumo da IA recusa o conteúdo interno e não leva as observações', () => {
    expect(() => resumoParaIa(conteudo('interno'))).toThrow()
    expect(resumoParaIa(conteudo('cliente'))).not.toContain('Alvenaria atrasou por material')
  })
})

describe('conteúdo congelado (entrada não confiável)', () => {
  it('aceita o conteúdo montado, ida e volta por JSON', () => {
    expect(conteudoSemanalValido(JSON.parse(JSON.stringify(conteudo('cliente'))), 'cliente')).toBe(true)
    expect(conteudoSemanalValido(JSON.parse(JSON.stringify(conteudo('interno'))), 'interno')).toBe(true)
  })

  it('recusa lado trocado, sinal fora dos três, cor estranha, campo de tipo errado e oculto no cliente', () => {
    const c = conteudo('cliente')
    expect(conteudoSemanalValido(c, 'interno')).toBe(false)
    expect(conteudoSemanalValido({ ...c, sinal: { ...c.sinal, rotulo: '<b>x</b>' } }, 'cliente')).toBe(false)
    expect(conteudoSemanalValido({ ...c, sinal: { ...c.sinal, fundo: 'red;background:url(x)' } }, 'cliente')).toBe(false)
    expect(conteudoSemanalValido({ ...c, sinal: { ...c.sinal, extra: 'x' } }, 'cliente')).toBe(false)
    expect(conteudoSemanalValido({ ...c, segunda: '2026-10-26<x>' }, 'cliente')).toBe(false)
    expect(conteudoSemanalValido({ ...c, concluidas: [{ descricao: 1, fim: 'x' }] }, 'cliente')).toBe(false)
    expect(conteudoSemanalValido({ ...c, ocultos: [{ rotulo: 'a', corpo: 'b' }] }, 'cliente')).toBe(false)
    expect(conteudoSemanalValido(null, 'cliente')).toBe(false)
  })

  it('e-mail escapa todo texto interpolado, inclusive o do sinal', () => {
    const c = conteudo('cliente')
    const mau = '<img src=x onerror=alert(1)>'
    const { html } = montarEmailSemanal(
      {
        ...c,
        titulo: mau, subtitulo: mau, previsao: mau, observacoes: mau,
        sinal: { ...c.sinal, rotulo: mau, fundo: '"><script>', texto: '"><script>' },
        avanco: { ...c.avanco, previsto: mau, ate: mau },
        doCliente: [{ descricao: mau, atividade: mau, tipo: mau, prazo: mau, vencida: false }],
      },
      { fotos: 0 },
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
