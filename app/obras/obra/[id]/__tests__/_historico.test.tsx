import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Historico from '../_historico'
import type { LinhaHistorico } from '../../../_lib/historico'

describe('Historico', () => {
  it('sem linhas, mostra o estado vazio e ainda assim a linha de entrada', () => {
    render(<Historico linhas={[]} entrada={{ data: '2026-09-09', fonte: 'field' }} />)
    expect(screen.getByText(/nenhuma alteração/i)).toBeInTheDocument()
    expect(screen.getByText(/09\/09\/2026/)).toBeInTheDocument()
    // Regex mais específica que "/field/i": o texto do estado vazio também contém a
    // palavra "Field" ("...pelo Field."), então "/field/i" batia em dois elementos.
    // "· Field" só aparece na linha de entrada.
    expect(screen.getByText(/· Field/)).toBeInTheDocument()
  })

  it('mostra as linhas e filtra por bloco ao clicar no chip', async () => {
    const user = userEvent.setup()
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Autorização' as const, campo: 'liberado_por' as const,
        de: null, para: 'JUAN', motivo: null, quem: 'amanda@manfac.com.br', created_at: '2026-07-02T14:30:00Z',
      },
      {
        id: '2', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'prioridade' as const,
        de: 'Normal', para: 'Urgente', motivo: null, quem: 'yuri@manfac.com.br', created_at: '2026-08-01T09:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)

    expect(screen.getByText(/Liberado por/)).toBeInTheDocument()
    expect(screen.getByText(/Prioridade/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Autorização' }))

    expect(screen.getByText(/Liberado por/)).toBeInTheDocument()
    expect(screen.queryByText(/^Prioridade/)).not.toBeInTheDocument()
  })

  it('mostra o motivo só quando a linha tem motivo (remarcação)', () => {
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'inicio_plan' as const,
        de: '10/09/2026', para: '16/09/2026', motivo: 'Loja pediu para adiar',
        quem: 'yuri@manfac.com.br', created_at: '2026-09-14T10:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)
    expect(screen.getByText(/Motivo: Loja pediu para adiar/)).toBeInTheDocument()
  })

  it('mostra a hora no fuso de São Paulo, não no fuso do executor (I1)', () => {
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Autorização' as const, campo: 'liberado_por' as const,
        de: null, para: 'JUAN', motivo: null, quem: 'a@manfac.com.br', created_at: '2026-07-02T14:30:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)
    // 14:30 UTC = 11:30 em America/Sao_Paulo (UTC-3, o Brasil não tem mais
    // horário de verão desde 2019 — não precisa condicional de estação).
    expect(screen.getByText(/11:30/)).toBeInTheDocument()
  })

  it('sem fonte Field, o rodapé não mostra "· Field" e o estado vazio usa o texto genérico', () => {
    render(<Historico linhas={[]} entrada={{ data: '2026-09-09', fonte: null }} />)
    expect(screen.getByText(/nenhuma alteração registrada/i)).toBeInTheDocument()
    expect(screen.queryByText(/· Field/)).not.toBeInTheDocument()
  })

  it('a linha de Entrada some ao trocar o filtro para um bloco específico', async () => {
    const user = userEvent.setup()
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'prioridade' as const,
        de: 'Normal', para: 'Urgente', motivo: null, quem: 'yuri@manfac.com.br', created_at: '2026-08-01T09:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)
    expect(screen.getByText(/Obra criada pela sincronização/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cronograma' }))

    expect(screen.queryByText(/Obra criada pela sincronização/)).not.toBeInTheDocument()
  })

  it('o contador do cabeçalho reflete a lista filtrada, não o total (M8)', async () => {
    const user = userEvent.setup()
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Autorização' as const, campo: 'liberado_por' as const,
        de: null, para: 'JUAN', motivo: null, quem: 'a@manfac.com.br', created_at: '2026-07-02T14:30:00Z',
      },
      {
        id: '2', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'prioridade' as const,
        de: 'Normal', para: 'Urgente', motivo: null, quem: 'y@manfac.com.br', created_at: '2026-08-01T09:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)
    expect(screen.getByText('2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Autorização' }))
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('filtro "Cancelamento" mostra só as linhas do cancelamento, com o motivo', async () => {
    const user = userEvent.setup()
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'prioridade' as const,
        de: 'Normal', para: 'Urgente', motivo: null, quem: 'y@manfac.com.br', created_at: '2026-08-01T09:00:00Z',
      },
      {
        id: '2', obra_id: 'o1', bloco: 'Cancelamento' as const, campo: 'etapa' as const,
        de: 'Em andamento', para: 'Cancelada', motivo: 'Cancelado pelo Cliente — loja suspensa',
        quem: 'r@manfac.com.br', created_at: '2026-09-23T13:42:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)

    await user.click(screen.getByRole('button', { name: 'Cancelamento' }))

    expect(screen.queryByText('Urgente')).not.toBeInTheDocument()
    expect(screen.getByText('Cancelada')).toBeInTheDocument()
    expect(screen.getByText(/Motivo: Cancelado pelo Cliente — loja suspensa/)).toBeInTheDocument()
  })

  it('rótulo ausente no dicionário cai para a própria chave, não "undefined" (M10)', () => {
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Cronograma' as const,
        campo: 'campo_novo_sem_rotulo' as unknown as LinhaHistorico['campo'],
        de: 'a', para: 'b', motivo: null, quem: 'y@manfac.com.br', created_at: '2026-08-01T09:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)
    expect(screen.getByText(/campo_novo_sem_rotulo/)).toBeInTheDocument()
  })
})
