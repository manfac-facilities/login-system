/**
 * Histórico das execuções na tela Sincronizar. A execução com sucesso pode
 * trazer avisos em `erro` (ex.: troca do número da OS recusada por colisão,
 * decisão do João de 13/10/2026) — eles aparecem junto da contagem, sem
 * esconder o resultado.
 */
import { render, screen } from '@testing-library/react'
import HistoricoSincronizacao, { type ExecucaoSyncRow } from '../_historico'

const base: ExecucaoSyncRow = {
  id: 'e1',
  iniciada_em: '2026-10-13T12:00:00Z',
  finalizada_em: '2026-10-13T12:01:00Z',
  tipo: 'incremental',
  origem: 'agendada',
  status: 'sucesso',
  erro: null,
  total_field: 3,
  novas: 1,
  atualizadas: 1,
  ignoradas: 0,
  marca_dagua_nova: null,
}

describe('HistoricoSincronizacao', () => {
  it('execução com sucesso e aviso mostra a contagem E o aviso', () => {
    render(
      <HistoricoSincronizacao
        execucoes={[{ ...base, erro: 'OS 123-TESTE: número 0926-017378 já é de outra obra, não trocado' }]}
      />,
    )

    expect(screen.getByText(/3 lidas · 1 novas · 1 atualizadas · 0 ignoradas/)).toBeTruthy()
    expect(screen.getByText('OS 123-TESTE: número 0926-017378 já é de outra obra, não trocado')).toBeTruthy()
  })

  it('vários avisos aparecem um por linha', () => {
    render(<HistoricoSincronizacao execucoes={[{ ...base, erro: 'aviso A\naviso B' }]} />)

    expect(screen.getByText('aviso A')).toBeTruthy()
    expect(screen.getByText('aviso B')).toBeTruthy()
  })

  it('execução que falhou continua mostrando só o erro', () => {
    render(<HistoricoSincronizacao execucoes={[{ ...base, status: 'falhou', erro: 'Não deu para puxar' }]} />)

    expect(screen.getByText('Não deu para puxar')).toBeTruthy()
    expect(screen.queryByText(/lidas/)).toBeNull()
  })
})
