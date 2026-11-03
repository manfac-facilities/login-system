import { fireEvent, render, screen, within } from '@testing-library/react'

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('../_actions', () => ({ salvarMedicaoAction: jest.fn(), mudarSituacaoMedicaoAction: jest.fn(), apagarMedicaoAction: jest.fn() }))

import TelaMedicoes from '../_tela'
import { montarMedicoes, type OsMedicao } from '../_tipos'

const os = (over: Partial<OsMedicao> = {}): OsMedicao => ({
  id: 'mae', os: '1026-014683', papel: 'mae', receitaCentavos: 43_777_241, podeGravar: true, avancoCentesimos: 5200, ...over,
})

describe('formulário: % ⇄ valor', () => {
  it('digitar o % calcula o valor e vice-versa', () => {
    render(<TelaMedicoes obraId="o" oss={[os()]} medicoes={[]} admin={false} notasOk />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nova medição' }))
    const pct = screen.getByLabelText('% liberado nesta medição')
    const valor = screen.getByLabelText('Valor liberado (R$)')
    fireEvent.change(pct, { target: { value: '10,00' } })
    expect(valor).toHaveValue('43.777,24')
    fireEvent.change(valor, { target: { value: '52.532,69' } })
    expect(pct).toHaveValue('12,00')
  })
  it('OS sem valor receita: % mostra "—", não edita, e não registra', () => {
    render(<TelaMedicoes obraId="o" oss={[os({ receitaCentavos: null })]} medicoes={[]} admin={false} notasOk />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nova medição' }))
    expect(screen.getByLabelText('% liberado nesta medição')).toHaveValue('—')
    expect(screen.getByLabelText('% liberado nesta medição')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Registrar medição' })).toBeDisabled()
    expect(screen.getByText(/Informe o valor receita em Dados da obra/)).toBeInTheDocument()
  })
  it('quem não grava não vê "+ Nova medição" nem ações', () => {
    const medicoes = montarMedicoes({
      linhas: [{ id: 'm1', obra_id: 'mae', numero: 1, periodo_inicio: '2026-10-01', periodo_fim: '2026-10-20', percentual_centesimos: 1200, valor_centavos: 5_253_269, situacao: 'enviada', enviada_em: '2026-10-20T15:00:00Z' }],
      notas: [], osPorId: new Map([['mae', '1026-014683']]), hoje: '2026-11-01',
    })
    render(<TelaMedicoes obraId="o" oss={[os({ podeGravar: false })]} medicoes={medicoes} admin={false} notasOk />)
    expect(screen.queryByRole('button', { name: '+ Nova medição' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cliente aprovou' })).toBeNull()
    // 12 dias aguardando → alerta
    expect(screen.getByText(/Medição 1 há 12 dias aguardando o cliente/)).toBeInTheDocument()
  })
})

describe('lista', () => {
  it('medição com nota aparece travada com o número da nota', () => {
    const medicoes = montarMedicoes({
      linhas: [{ id: 'm1', obra_id: 'mae', numero: 1, periodo_inicio: '2026-09-01', periodo_fim: '2026-09-30', percentual_centesimos: 2000, valor_centavos: 8_755_448, avanco_centesimos: 2800, situacao: 'aprovada', enviada_em: '2026-10-01T12:00:00Z', aprovada_em: '2026-10-03T12:00:00Z' }],
      notas: [{ nfse_numero: '1398', medicao_ids: ['m1'] }],
      osPorId: new Map([['mae', '1026-014683']]),
      hoje: '2026-11-01',
    })
    render(<TelaMedicoes obraId="o" oss={[os()]} medicoes={medicoes} admin notasOk />)
    const linha = screen.getByText('NFS-e 1398').closest('tr')!
    expect(within(linha).getByText('faturada')).toBeInTheDocument()
    expect(within(linha).getByText('travada pela nota')).toBeInTheDocument()
    expect(within(linha).queryByRole('button')).toBeNull()
    expect(within(linha).getByText('87.554,48')).toBeInTheDocument()
  })
})

describe('restante da OS (fix 1)', () => {
  const linha = (id: string, situacao: string, pct: number, valor: number) => ({
    id, obra_id: 'mae', numero: id.length, periodo_inicio: '2026-10-01', periodo_fim: '2026-10-20', percentual_centesimos: pct, valor_centavos: valor, situacao, enviada_em: '2026-10-30T15:00:00Z',
  })
  const medicoes = montarMedicoes({
    linhas: [linha('a', 'aprovada', 3333, 1_000_000), linha('bb', 'enviada', 3333, 1_000_000), linha('ccc', 'recusada', 2000, 600_000)],
    notas: [], osPorId: new Map([['mae', '1026-014683']]), hoje: '2026-11-01',
  })
  it('mostra o restante e "Usar o restante" preenche os dois campos exatos', () => {
    render(<TelaMedicoes obraId="o" oss={[os({ receitaCentavos: 3_000_000 })]} medicoes={medicoes} admin={false} notasOk />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nova medição' }))
    expect(screen.getByText('R$ 10.000,00 · 33,34%')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Usar o restante' }))
    expect(screen.getByLabelText('% liberado nesta medição')).toHaveValue('33,34')
    expect(screen.getByLabelText('Valor liberado (R$)')).toHaveValue('10.000,00')
  })
  it('digitar o valor restante dá o % restante (não 33,33%)', () => {
    render(<TelaMedicoes obraId="o" oss={[os({ receitaCentavos: 3_000_000 })]} medicoes={medicoes} admin={false} notasOk />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nova medição' }))
    fireEvent.change(screen.getByLabelText('Valor liberado (R$)'), { target: { value: '10.000,00' } })
    expect(screen.getByLabelText('% liberado nesta medição')).toHaveValue('33,34')
  })
  it('editar a recusada recalcula o % do valor sobre a receita atual', () => {
    // receita mudou para R$ 60.000,00: R$ 6.000,00 = 10,00% (era 20,00%)
    render(<TelaMedicoes obraId="o" oss={[os({ receitaCentavos: 6_000_000 })]} medicoes={medicoes} admin={false} notasOk />)
    const tr = screen.getByText('recusada · renegociar').closest('tr')!
    fireEvent.click(within(tr).getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('% liberado nesta medição')).toHaveValue('10,00')
    expect(screen.getByLabelText('Valor liberado (R$)')).toHaveValue('6.000,00')
  })
})
