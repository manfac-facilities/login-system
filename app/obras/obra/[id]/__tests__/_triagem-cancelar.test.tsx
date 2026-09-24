/**
 * A faixa "Esta OS não vai virar obra?" na Triagem
 * (spec-cancelamento-obra-2026-09-23 §6.2).
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))
jest.mock('../_actions', () => ({
  liberarObraAction: jest.fn(),
  salvarDadosTriagemAction: jest.fn(),
  cancelarObraAction: jest.fn(async () => ({ success: true })),
}))

import Triagem from '../_triagem'
import { cancelarObraAction } from '../_actions'
import { derivar, type ObraRow } from '../../../_lib/tipos'

const HOJE = '2026-09-23'

function obraRow(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: 'o1',
    os: '0926-011702',
    loja: 'DP MAGE',
    descricao: null,
    tipo: null,
    valor: null,
    origem: null,
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: null,
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

test('a Triagem tem a faixa "Esta OS não vai virar obra?" e cancela com cancelarObraAction', async () => {
  const u = userEvent.setup()
  render(
    <Triagem
      obra={derivar(obraRow(), HOJE)}
      responsaveis={['YURI']}
      equipes={['MANFAC-7']}
      analistasCliente={['LEANDRO']}
      hoje={HOJE}
    />
  )
  expect(screen.getByText('Esta OS não vai virar obra?')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Cancelar obra' }))
  const janela = within(screen.getByRole('dialog'))
  expect(janela.getByText('OS 0926-011702 · hoje em "Aguardando definição"')).toBeInTheDocument()
  await u.click(janela.getByRole('radio', { name: /Cancelado pela Manfac/ }))
  await u.click(janela.getByRole('button', { name: 'Cancelar obra' }))
  expect(cancelarObraAction).toHaveBeenCalledWith('o1', { por: 'manfac', obs: '' })
}, 20000)
