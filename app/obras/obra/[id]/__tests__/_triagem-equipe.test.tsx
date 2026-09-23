/**
 * Equipe / prestador em texto livre na Triagem (ajuste 3 de 23/09,
 * spec-ajustes-ficha-2026-09-23.md §6). O cliente pediu texto livre "pra não
 * limitar e ficar errado"; as equipes já usadas continuam como sugestão.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('../_actions', () => ({ liberarObraAction: jest.fn(), salvarDadosTriagemAction: jest.fn() }))

import Triagem from '../_triagem'
import { derivar, type ObraRow } from '../../../_lib/tipos'

const HOJE = '2026-09-23'

/** Obra em "Aguardando definição" com os cinco campos do checklist vazios. */
function obraRow(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: 'o1',
    os: '0226-014989',
    loja: 'DP BAIRRO DE FATIMA',
    descricao: 'Forro do estoque caiu',
    tipo: 'TELHADO',
    valor: 28520.46,
    origem: 'Sistema DPSP',
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: 'LEANDRO',
    pcm: null,
    equipe: null,
    os_aprovada: false,
    liberado_por: null,
    liberado_em: null,
    etapa: 'definir',
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: null,
    aprovacao: null,
    inicio_plan: null,
    inicio_real: null,
    duracao: null,
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
    atualizacao: null,
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-09-20T12:00:00Z',
    updated_at: null,
    ...over,
  }
}

function renderTriagem({ equipes }: { equipes: string[] }) {
  return render(
    <Triagem
      obra={derivar(obraRow(), HOJE)}
      responsaveis={['YURI']}
      equipes={equipes}
      analistasCliente={['LEANDRO']}
      hoje={HOJE}
    />
  )
}

test('equipe é campo de texto com as equipes já usadas como sugestão', () => {
  renderTriagem({ equipes: ['ALEX', 'MANFAC-7'] })
  const campo = screen.getByLabelText('Equipe ou prestador')
  expect(campo).toHaveAttribute('type', 'text')
  const lista = document.getElementById(campo.getAttribute('list')!)!
  expect([...lista.querySelectorAll('option')].map((o) => o.getAttribute('value'))).toEqual([
    'ALEX',
    'MANFAC-7',
  ])
  expect(
    screen.getByText('Comece a digitar para ver equipes já usadas. Qualquer texto é aceito.')
  ).toBeInTheDocument()
})

test('texto fora da lista é aceito e conta como preenchido', async () => {
  const u = userEvent.setup()
  renderTriagem({ equipes: ['ALEX'] })
  await u.type(screen.getByLabelText('Equipe ou prestador'), 'GRUPO SERTAO MANUTENCAO')
  expect(screen.getByLabelText('Equipe ou prestador')).toHaveValue('GRUPO SERTAO MANUTENCAO')
  expect(screen.getByText(/Faltam 4 campos/)).toBeInTheDocument()
})

test('só espaço não conta como preenchido', async () => {
  const u = userEvent.setup()
  renderTriagem({ equipes: [] })
  await u.type(screen.getByLabelText('Equipe ou prestador'), '   ')
  expect(screen.getByText(/Faltam 5 campos/)).toBeInTheDocument()
})
