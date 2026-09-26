import { render, screen } from '@testing-library/react'
import HistoricoSincronizacao, { type ExecucaoSyncRow } from '../_historico'

function execucao(over: Partial<ExecucaoSyncRow> = {}): ExecucaoSyncRow {
  return {
    id: 'exec-1',
    iniciada_em: '2026-09-26T20:30:00Z',
    finalizada_em: '2026-09-26T20:30:10Z',
    tipo: 'incremental',
    origem: 'agendada',
    status: 'sucesso',
    erro: null,
    total_field: 1,
    novas: 0,
    atualizadas: 0,
    ignoradas: 1,
    marca_dagua_nova: '2026-09-26T20:29:00Z',
    ...over,
  }
}

test('mostra a marca d’água de cada execução no histórico', () => {
  render(<HistoricoSincronizacao execucoes={[execucao()]} />)

  expect(screen.getByRole('columnheader', { name: 'Marca d’água' })).toBeInTheDocument()
  expect(screen.getByText('26/09/2026, 17:29')).toBeInTheDocument()
})

test('mostra traço quando a execução não avançou a marca d’água', () => {
  render(
    <HistoricoSincronizacao
      execucoes={[execucao({ status: 'falhou', erro: 'Falha de teste', marca_dagua_nova: null })]}
    />
  )

  expect(screen.getByText('—')).toBeInTheDocument()
})
