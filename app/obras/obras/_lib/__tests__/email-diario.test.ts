import { montarEmailDiario, type RdoCompleto } from '../email-diario'
import type { ImpedimentoRow, ObraGrande } from '../leitura'
import type { ObraRow } from '../../../_lib/tipos'

const imp = (over: Partial<ImpedimentoRow>): ImpedimentoRow => ({
  id: 'i', obraId: 'o1', categoria: 'impedimento', tipo: 'Área não liberada', responsavel: 'cliente',
  atividadeNumero: 12, descricao: 'Autorização de baixa das gôndolas', pessoaCliente: null, fotoPath: null,
  travaAtividade: true, impactoDias: null, exibirAoCliente: true, abertoEm: '2026-10-22', encerradoEm: null,
  rdoId: null, orientacaoId: null, criadoPor: null, criadoEm: '2026-10-22T10:00:00Z', ...over,
})

const IMPEDIMENTOS: ImpedimentoRow[] = [
  imp({ id: 'c1' }),
  imp({
    id: 'm1', tipo: 'Material Manfac', responsavel: 'manfac', descricao: 'Atraso na entrega do perfil',
    travaAtividade: false, impactoDias: 1, exibirAoCliente: true, abertoEm: '2026-10-28',
  }),
  imp({
    id: 'oculto', tipo: 'Equipe', responsavel: 'manfac', descricao: 'Pedreiro faltou sem avisar',
    travaAtividade: false, impactoDias: 0.5, exibirAoCliente: false, abertoEm: '2026-10-29',
  }),
  imp({ id: 'fechado', descricao: 'Já resolvido antes', travaAtividade: false, encerradoEm: '2026-10-27' }),
]

function obraGrande(over: Partial<ObraGrande> = {}): ObraGrande {
  const plano = Array.from({ length: 12 }, (_, i) => ({
    numero: i + 1, etapa: 'E', descricao: `Atividade ${i + 1}`, pred1: null, pred2: null, duracao: 5,
    bloqueiaPorTrava: i + 1 >= 11, pesoValor: 98765,
  }))
  plano[5].descricao = 'Escoramento da viga principal'
  plano[0].descricao = 'Levantamento topográfico'
  const exec = plano.map((p) => ({
    numero: p.numero, status: p.numero === 6 ? ('em_andamento' as const) : ('nao_iniciado' as const),
    percentual: p.numero === 6 ? 0.7 : 0, inicioReal: null, fimReal: null,
  }))
  return {
    obra: { id: 'o1', loja: 'DP Macaé 3', modalidade: 'obra', data_base: '2026-10-26', atividade_trava: 6, valor: 123456.78 } as unknown as ObraRow,
    versaoBase: { id: 'v1', numero: 1, salvaEm: '2026-10-26T12:00:00Z', motivo: null },
    versaoVigente: { id: 'v1', numero: 1, salvaEm: '2026-10-26T12:00:00Z', motivo: null },
    rascunho: null,
    plano,
    exec,
    impedimentos: IMPEDIMENTOS,
    feriados: new Set<string>(),
    calc: {
      atividades: [], previsto: 0.08, realizado: 0.06, desvioPP: -2,
      terminoPrevisto: '2027-02-12', terminoProjetado: '2027-02-12',
    },
    terminoBase: '2027-02-12',
    sinal: 'amarelo',
    atraso: { total: 0, cliente: 0, manfac: 0, terceiro: 0, clima: 0 },
    ...over,
  }
}

const rdo = (over: Partial<RdoCompleto> = {}): RdoCompleto => ({
  id: 'r1', data: '2026-10-29', semExecucao: false, motivoSemExecucao: null,
  programacaoAmanha: 'Concluir escoramento · iniciar estudo de solo',
  avancos: [
    { numero: 1, de: 0.4, para: 1, concluida: true },
    { numero: 6, de: 0.5, para: 0.7, concluida: false },
    { numero: 3, de: 0, para: 0, concluida: false },
  ],
  ...over,
})

const montar = (lado: 'cliente' | 'interno', o: Partial<ObraGrande> = {}, r: Partial<RdoCompleto> = {}) =>
  montarEmailDiario({
    lado, obra: obraGrande(o), rdo: rdo(r), validadoPor: 'eng.fulano@manfac.com.br',
    validadoEm: '2026-10-29T21:40:00Z', diaN: 4, fotosCid: [{ cid: 'foto1@rdo', legenda: 'ponto 1' }],
  })

describe('montarEmailDiario', () => {
  it('assunto: loja, dia N e data', () => {
    expect(montar('cliente').assunto).toBe('Diário de obra · DP Macaé 3 · dia 4 · 29/10/2026')
  })

  it('html do cliente não contém impedimento oculto nem R$ nem peso', () => {
    const { html, texto } = montar('cliente')
    for (const s of [html, texto]) {
      expect(s).not.toContain('Pedreiro faltou')
      expect(s).not.toContain('R$')
      expect(s).not.toContain('98765')
      expect(s).not.toContain('98.765')
      expect(s).not.toContain('123456')
      expect(s).not.toContain('Já resolvido antes')
    }
  })

  it('impedimento da Manfac aparece ao cliente como "Manfac", sem o tipo interno', () => {
    const { html } = montar('cliente')
    expect(html).toContain('Atraso na entrega do perfil')
    expect(html).toContain('Manfac')
    expect(html).not.toContain('Material Manfac')
    expect(html).not.toContain('Equipe')
  })

  it('html interno contém o impedimento oculto, com o responsável e o tipo reais', () => {
    const { html } = montar('interno')
    expect(html).toContain('Pedreiro faltou sem avisar')
    expect(html).toContain('Material Manfac')
    expect(html).toContain('Não foi ao cliente')
  })

  it('cabeçalho com validado por e hora de Brasília', () => {
    const { html } = montar('cliente')
    expect(html).toContain('MANFAC · DIÁRIO DE OBRA')
    expect(html).toContain('DP Macaé 3 — dia 4')
    expect(html).toContain('validado por eng.fulano@manfac.com.br às 18:40')
  })

  it('três números: previsto, realizado e dias de impacto do cliente', () => {
    const { html } = montar('cliente')
    expect(html).toContain('8%')
    expect(html).toContain('6%')
    // c1 trava a atividade: dias úteis de 22/10 a 29/10 = 6
    expect(html).toMatch(/6 d<\/b>/)
  })

  it('sinal vermelho mostra "Atrasado" e a quebra do atraso por responsável', () => {
    const { html, texto } = montar('cliente', {
      sinal: 'vermelho',
      atraso: { total: 5, cliente: 4, manfac: 1, terceiro: 0, clima: 0 },
      calc: { atividades: [], previsto: 0.2, realizado: 0.1, desvioPP: -10, terminoPrevisto: '2027-02-12', terminoProjetado: '2027-02-19' },
    })
    expect(html).toContain('Atrasado')
    expect(html).toContain('19/02/2027')
    expect(html).toContain('+5 dias: 4 do cliente, 1 da Manfac')
    expect(texto).toContain('+5 dias: 4 do cliente, 1 da Manfac')
  })

  it('trava técnica aparece como item próprio enquanto a atividade da trava não termina', () => {
    expect(montar('cliente').html).toContain('Escoramento da viga principal (70%)')
    const exec = obraGrande().exec.map((e) => (e.numero === 6 ? { ...e, status: 'concluido' as const, percentual: 1 } : e))
    expect(montar('cliente', { exec }).html).not.toContain('trava de segurança')
  })

  it('o que a Manfac fez hoje: concluídas, de→para e fotos por CID', () => {
    const { html } = montar('cliente')
    expect(html).toContain('Levantamento topográfico — concluída')
    expect(html).toContain('Escoramento da viga principal: 50% → 70%')
    expect(html).not.toContain('Atividade 3')
    expect(html).toContain('src="cid:foto1@rdo"')
    expect(html).toContain('Concluir escoramento')
  })

  it('dia sem execução mostra a frase no lugar dos avanços', () => {
    const { html, texto } = montar('cliente', {}, { semExecucao: true, motivoSemExecucao: 'Área não liberada pela loja', avancos: [] })
    expect(html).toContain('Sem execução hoje — Área não liberada pela loja')
    expect(texto).toContain('Sem execução hoje — Área não liberada pela loja')
  })

  it('escapa HTML do texto digitado', () => {
    const { html } = montar('cliente', {}, { programacaoAmanha: '<script>x</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('fotos omitidas por tamanho aparecem no texto', () => {
    const r = montarEmailDiario({
      lado: 'cliente', obra: obraGrande(), rdo: rdo(), validadoPor: 'x', validadoEm: '2026-10-29T21:40:00Z',
      diaN: 4, fotosCid: [], fotosOmitidas: 2,
    })
    expect(r.texto).toContain('2 fotos omitidas')
    expect(r.html).toContain('2 fotos omitidas')
  })
  it('orientações à loja do dia: cliente vê as exibíveis, interno vê todas', () => {
    const impedimentos = [
      ...IMPEDIMENTOS,
      imp({ id: 'o1', categoria: 'orientacao', tipo: null, responsavel: null, atividadeNumero: null,
        descricao: 'Não molhar o piso por 72h', pessoaCliente: 'Carla (gerente)', exibirAoCliente: true,
        abertoEm: '2026-10-29', criadoEm: '2026-10-29T17:15:00Z' }),
      imp({ id: 'o2', categoria: 'orientacao', tipo: null, responsavel: null, atividadeNumero: null,
        descricao: 'Orientação interna da equipe', exibirAoCliente: false, abertoEm: '2026-10-29' }),
      imp({ id: 'o3', categoria: 'orientacao', tipo: null, responsavel: null, atividadeNumero: null,
        descricao: 'Orientação de ontem', exibirAoCliente: true, abertoEm: '2026-10-28' }),
    ]
    const cli = montar('cliente', { impedimentos })
    expect(cli.html).toContain('Orientações à loja')
    expect(cli.html).toContain('Não molhar o piso por 72h — recebida por Carla (gerente) às 14:15')
    expect(cli.texto).toContain('Não molhar o piso por 72h')
    expect(cli.html).not.toContain('Orientação interna da equipe')
    expect(cli.html).not.toContain('Orientação de ontem')
    const int = montar('interno', { impedimentos })
    expect(int.html).toContain('Orientação interna da equipe (não foi ao cliente)')
    expect(int.html).not.toContain('Orientação de ontem')
    expect(montar('cliente').html).not.toContain('Orientações à loja')
  })
})
