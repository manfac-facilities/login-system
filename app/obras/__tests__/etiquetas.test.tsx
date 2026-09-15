/**
 * Render do selo de dias. `hoje` fixo em 2026-09-14 (exemplos do mockup J4 v01).
 */
import { render, screen } from '@testing-library/react'
import { derivar, type ObraRow } from '../_lib/tipos'
import { BadgeDias } from '../base/_etiquetas'

const H = '2026-09-14'

function linha(over: Partial<ObraRow> = {}): ObraRow {
  return {
    id: 'o1',
    os: '0526-008102',
    loja: 'DP TESTE',
    descricao: null,
    tipo: null,
    valor: null,
    origem: null,
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: null,
    pcm: 'LUANA',
    equipe: 'MANFAC-7',
    os_aprovada: false,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
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
    created_at: '2026-05-29T12:00:00+00:00',
    updated_at: null,
    ...over,
  }
}

describe('BadgeDias', () => {
  it('liberada há 104 dias e aprovada hoje: 104, vermelho, "desde a liberação"', () => {
    const o = derivar(
      linha({ liberado_por: 'JUAN', liberado_em: '2026-06-02', aprovacao: '2026-09-14' }),
      H
    )
    render(<BadgeDias obra={o} />)
    expect(screen.getByText('104')).toHaveStyle({ color: '#ff4d6d' })
    expect(screen.getByText('dias desde a liberação')).toBeInTheDocument()
  })

  it('25 dias desde a liberação: âmbar', () => {
    const o = derivar(
      linha({ liberado_por: 'LEANDRO', liberado_em: '2026-08-20', aprovacao: '2026-09-01' }),
      H
    )
    render(<BadgeDias obra={o} />)
    expect(screen.getByText('25')).toHaveStyle({ color: '#f4b73f' })
  })

  it('sem autorização conta da entrada', () => {
    const o = derivar(linha({ created_at: '2026-07-01T13:00:00+00:00' }), H)
    render(<BadgeDias obra={o} />)
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('dias desde a entrada')).toBeInTheDocument()
  })

  it('forma curta só diz "dias"', () => {
    const o = derivar(linha({ aprovacao: '2026-08-14' }), H)
    render(<BadgeDias obra={o} curto />)
    expect(screen.getByText('31')).toBeInTheDocument()
    expect(screen.getByText('dias')).toBeInTheDocument()
  })

  it('sem âncora mostra travessão', () => {
    const o = derivar(linha({ created_at: '' }), H)
    render(<BadgeDias obra={o} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
