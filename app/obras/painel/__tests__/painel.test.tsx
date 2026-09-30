/**
 * A tela do painel monta com dados de verdade do `montarPainel`, abre a lista
 * detalhada só no clique e leva o filtro de cliente para a URL.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ObraRow } from '../../_lib/tipos'
import { montarPainel, type ObraPainel } from '../_calculos'
import PainelGerencial from '../_painel'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const HOJE = '2026-09-29'

function obra(over: Partial<ObraRow> & { cliente?: string | null }): ObraPainel {
  return {
    id: Math.random().toString(36).slice(2),
    os: 'OS-1',
    loja: 'Loja',
    descricao: null,
    tipo: null,
    valor: 1000,
    origem: null,
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: null,
    pcm: null,
    equipe: 'Alfa',
    os_aprovada: true,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
    bloqueio: null,
    mau_uso: false,
    prioridade: null,
    aprovacao: null,
    inicio_plan: '2026-09-10',
    inicio_real: '2026-09-10',
    duracao: 5,
    fim_real: null,
    desde_etapa: '2026-09-10',
    marco_exec_fim: null,
    marco_relatorio: null,
    marco_os_aprov: null,
    marco_fechou_os: null,
    marco_liberou_fat: null,
    marco_faturou: null,
    pendencia: null,
    pend_resp: null,
    pend_prazo: null,
    prox_acao: null,
    atualizacao: null,
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-06-01T12:00:00Z',
    updated_at: null,
    ...over,
  }
}

function montar() {
  const obras = [
    obra({ os: 'OS-PARADA', loja: 'Loja Parada', etapa: 'paralisado', bloqueio: 'Clima', cliente: 'DPSP' }),
    obra({ os: 'OS-FAT', etapa: 'faturado', marco_liberou_fat: '2026-09-01', marco_faturou: '2026-09-05', cliente: 'DPSP' }),
    obra({ os: 'OS-PEND', etapa: 'pendFat', marco_liberou_fat: '2026-09-20', valor: null, cliente: 'D1000' }),
  ]
  const painel = montarPainel(
    { obras, diario: [], tarefas: [], remarcacoes: [], hoje: HOJE },
    { cliente: null, mes: '2026-09', cmp: 'prev' }
  )
  return render(<PainelGerencial painel={painel} meses={[{ v: '2026-09', nome: 'Setembro 2026 (atual)' }]} />)
}

describe('PainelGerencial', () => {
  beforeEach(() => push.mockClear())

  it('monta todas as seções sem o botão "Como a planilha"', () => {
    montar()
    for (const t of [
      'Metas: carteira e faturamento',
      'Resumo por status',
      'Prazos de resposta (SLA)',
      'Equipes: receita, dias e produtividade',
      'Obras paradas e atrasadas',
      'Ritmo do campo e respostas',
      'Cronograma obra a obra',
      'Histórico de faturamento',
    ]) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
    }
    expect(screen.queryByText('Como a planilha')).not.toBeInTheDocument()
  })

  it('a lista de obras da etapa só abre no clique', async () => {
    montar()
    expect(screen.queryByRole('link', { name: 'OS-PEND' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Pendente faturamento', { selector: 'td' }))
    expect(screen.getByRole('link', { name: 'OS-PEND' })).toHaveAttribute('href', expect.stringContaining('/obras/obra/'))
  })

  it('paradas por motivo abrem as obras', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: /Clima/ }))
    expect(screen.getAllByText('Loja Parada').length).toBeGreaterThan(0)
  })

  it('clicar num cliente leva o filtro para a URL', async () => {
    montar()
    const grupo = screen.getByRole('group', { name: 'Cliente' })
    await userEvent.click(within(grupo).getByRole('button', { name: 'D1000' }))
    expect(push).toHaveBeenCalledWith('/obras/painel?cliente=d1000&mes=2026-09', { scroll: false })
  })
})
