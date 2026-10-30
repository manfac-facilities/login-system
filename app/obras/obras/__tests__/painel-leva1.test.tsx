import { fireEvent, render, screen, within } from '@testing-library/react'
import PainelObra from '../_ui/painel'
import type { ObraGrande } from '../_lib/leitura'
import type { AtividadeCalculada } from '../_lib/cronograma'

const obra = {
  id: 'o1', os: '0526-1', loja: 'Macaé 3', cliente: 'DPSP', modalidade: 'obra',
  data_base: '2026-10-01', atividade_trava: null,
} as unknown as ObraGrande['obra']

const vazio: ObraGrande = {
  obra, versaoBase: null, versaoVigente: null, rascunho: null,
  plano: [], exec: [], impedimentos: [], feriados: new Set(),
  calc: null, calcBase: null, etapas: [], hist: [], dadosAte: null, terminoBase: null, sinal: null, atraso: null,
}

const ativ = (over: Partial<AtividadeCalculada>): AtividadeCalculada => ({
  numero: 1, etapa: 'Demolição', descricao: 'Demolições', pred1: null, pred2: null, duracao: 10,
  bloqueiaPorTrava: false, pesoValor: 0, status: 'em_andamento', percentual: 0.5, inicioReal: '2026-10-01', fimReal: null,
  inicioPrevisto: '2026-10-01', fimPrevisto: '2026-10-14', inicioProjetado: '2026-10-01', fimProjetado: '2026-10-16',
  peso: 0.5, percentualPrevisto: 1, situacao: 'atrasada', travada: false,
  inicioFixo: null, diasRestantes: null, alertaInicioFixo: null, inicioFixoAjustado: false, ...over,
})

const atividades = [
  ativ({ numero: 1 }),
  ativ({
    numero: 2, etapa: 'Acabamento', descricao: 'Pintura', status: 'nao_iniciado', percentual: 0, inicioReal: null,
    inicioPrevisto: '2026-10-15', fimPrevisto: '2026-12-10', inicioProjetado: '2026-10-19', fimProjetado: '2026-12-17',
    percentualPrevisto: 0.25, situacao: 'inicio_atrasado',
  }),
]

const comCronograma = (over: Partial<ObraGrande> = {}): ObraGrande => ({
  ...vazio,
  versaoBase: { id: 'v1', numero: 1, salvaEm: '2026-10-01T10:00:00Z', motivo: null },
  versaoVigente: { id: 'v1', numero: 1, salvaEm: '2026-10-01T10:00:00Z', motivo: null },
  calc: { atividades, previsto: 0.625, realizado: 0.25, desvioPP: -37.5, terminoPrevisto: '2026-12-10', terminoProjetado: '2026-12-17' },
  calcBase: { atividades, previsto: 0.625, realizado: 0.25, desvioPP: -37.5, terminoPrevisto: '2026-12-10', terminoProjetado: '2026-12-17' },
  etapas: [
    { etapa: 'Demolição', inicio: '2026-10-01', fim: '2026-10-14', diasUteis: 10, percentual: 0.5, inicioProjetado: '2026-10-01', fimProjetado: '2026-10-16', numeros: [1] },
    { etapa: 'Acabamento', inicio: '2026-10-15', fim: '2026-12-10', diasUteis: 40, percentual: 0, inicioProjetado: '2026-10-19', fimProjetado: '2026-12-17', numeros: [2] },
  ],
  hist: [
    { numero: 1, dataStatus: '2026-10-09', percentual: 0.3 },
    { numero: 1, dataStatus: '2026-10-23', percentual: 0.5 },
  ],
  dadosAte: '2026-10-23',
  terminoBase: '2026-12-10', sinal: 'vermelho',
  atraso: { total: 5, cliente: 4, manfac: 1, terceiro: 0, clima: 0 },
  ...over,
})

const renderPainel = (d: ObraGrande) =>
  render(<PainelObra dados={d} hoje="2026-10-29" estadoDiario="nao_iniciado" ultimoEnvio={null} />)

describe('Painel da obra (Leva 1)', () => {
  it('sem cronograma: estado vazio com link para montar', () => {
    renderPainel(vazio)
    expect(screen.getByText(/ainda não tem cronograma/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cronograma/i })).toHaveAttribute('href', '/obras/obras/o1/cronograma')
    expect(screen.queryByRole('figure', { name: /Curva S/ })).toBeNull()
  })

  it('KPI "Dias vs base" mostra "+5 dias: 4 do cliente, 1 da Manfac"', () => {
    renderPainel(comCronograma())
    const kpi = screen.getByRole('group', { name: 'Dias vs base' })
    expect(kpi.textContent?.replace(/\s+/g, ' ')).toMatch(/\+5 dias: 4 do cliente, 1 da Manfac/)
  })

  it('sempre diz "Dados até dd/mm"', () => {
    renderPainel(comCronograma())
    expect(screen.getAllByText(/Dados até 23\/10/).length).toBeGreaterThan(0)
  })

  it('curva S tem as três legendas em texto', () => {
    renderPainel(comCronograma())
    const curva = screen.getByRole('figure', { name: /Curva S/ })
    const legenda = within(curva).getByRole('list', { name: 'Legenda' })
    expect(within(legenda).getByText('Base')).toBeInTheDocument()
    expect(within(legenda).getByText('Previsto')).toBeInTheDocument()
    expect(within(legenda).getByText('Realizado')).toBeInTheDocument()
  })

  it('alternar Semanal/Mensal troca os rótulos dos períodos', () => {
    renderPainel(comCronograma())
    const bloco = screen.getByRole('figure', { name: /Progresso por período/ })
    // Semanal: períodos terminam nas sextas (09/10, 16/10, ...)
    expect(within(bloco).getAllByText('09/10').length).toBeGreaterThan(0)
    expect(within(bloco).queryAllByText('out/26')).toHaveLength(0)
    fireEvent.click(within(bloco).getByRole('button', { name: 'Mensal' }))
    expect(within(bloco).getAllByText('out/26').length).toBeGreaterThan(0)
    expect(within(bloco).queryAllByText('09/10')).toHaveLength(0)
    expect(within(bloco).getByRole('button', { name: 'Mensal' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('obra sem histórico e sem base renderiza sem erro', () => {
    const d = comCronograma({
      hist: [], dadosAte: null, calcBase: null, versaoBase: null, versaoVigente: null, terminoBase: null, atraso: null,
      rascunho: { id: 'r', numero: 1, salvaEm: null, motivo: null },
    })
    renderPainel(d)
    expect(screen.getByRole('figure', { name: /Curva S/ })).toBeInTheDocument()
    expect(screen.getByText(/Base ainda não salva — os números/)).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Dias vs base' })).getByText('—')).toBeInTheDocument()
  })

  it('evolução por etapa mostra Δ dias da etapa vs base', () => {
    renderPainel(comCronograma({
      calcBase: {
        atividades: atividades.map((a) => ({ ...a, fimPrevisto: a.numero === 1 ? '2026-10-14' : '2026-12-10' })),
        previsto: 0.625, realizado: 0.25, desvioPP: 0, terminoPrevisto: '2026-12-10', terminoProjetado: '2026-12-10',
      },
    }))
    const evol = screen.getByRole('region', { name: /Evolução por etapa/ })
    // Demolição: fim base 14/10 (qua) → projetado 16/10 (sex) = +2 dias úteis
    expect(within(evol).getByText('+2 dias')).toBeInTheDocument()
  })
})
