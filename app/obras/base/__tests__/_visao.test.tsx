/**
 * O aviso das canceladas na Base (spec-cancelamento-obra-2026-09-23 §7.3).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { derivar, type ObraRow } from '../../_lib/tipos'
import VisaoBase from '../_visao'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

function linha(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: Math.random().toString(36).slice(2),
    os: '0226-000001',
    loja: 'DP TESTE',
    descricao: null,
    tipo: 'CIVIL',
    valor: null,
    origem: null,
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: 'LEANDRO',
    pcm: 'YURI',
    equipe: 'MANFAC-7',
    os_aprovada: true,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: null,
    aprovacao: '2026-08-20',
    inicio_plan: '2026-08-21',
    inicio_real: null,
    duracao: 7,
    fim_real: null,
    desde_etapa: null,
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
    atualizacao: '2026-08-30',
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-08-20T00:00:00Z',
    updated_at: null,
    ...over,
  }
}

const HOJE = '2026-08-31'
const ativa = (loja: string) => derivar(linha({ loja }), HOJE)
const canc = (loja: string, por: 'cliente' | 'manfac') =>
  derivar(
    linha({
      loja,
      etapa: 'cancelado',
      cancelado_por: por,
      cancelado_etapa_anterior: 'andamento',
      cancelado_em: '2026-08-30T12:00:00Z',
      cancelado_quem: 'a@manfac.com.br',
    }),
    HOJE
  )

const presente = (loja: string) => screen.queryAllByText(loja).length > 0

test('em "Todas", avisa quantas canceladas ficaram fora, e "ver canceladas" troca o filtro', async () => {
  const u = userEvent.setup()
  render(
    <VisaoBase
      obras={[ativa('LOJA A1'), ativa('LOJA A2'), ativa('LOJA A3'), canc('LOJA C1', 'cliente'), canc('LOJA C2', 'manfac')]}
    />
  )
  expect(['LOJA A1', 'LOJA A2', 'LOJA A3'].every(presente)).toBe(true)
  expect(presente('LOJA C1') || presente('LOJA C2')).toBe(false)
  expect(screen.getByText(/2 obras canceladas/)).toBeInTheDocument()
  expect(screen.getByText(/fora desta lista/)).toBeInTheDocument()

  await u.click(screen.getByRole('button', { name: 'ver canceladas' }))

  expect(presente('LOJA C1') && presente('LOJA C2')).toBe(true)
  expect(presente('LOJA A1')).toBe(false)
  expect(
    screen.getByText(
      'Canceladas não contam dias, não aparecem no Kanban e não entram em nenhum indicador acima. Abrir a obra mostra quem cancelou, quando e por quê.'
    )
  ).toBeInTheDocument()
  expect(screen.queryByText(/fora desta lista/)).not.toBeInTheDocument()
})

test('singular com 1 cancelada; nada quando não há cancelada', () => {
  const { unmount } = render(<VisaoBase obras={[ativa('LOJA A1'), canc('LOJA C1', 'cliente')]} />)
  expect(screen.getByText(/1 obra cancelada/)).toBeInTheDocument()
  unmount()
  render(<VisaoBase obras={[ativa('LOJA A1')]} />)
  expect(screen.queryByText(/fora desta lista/)).not.toBeInTheDocument()
})
