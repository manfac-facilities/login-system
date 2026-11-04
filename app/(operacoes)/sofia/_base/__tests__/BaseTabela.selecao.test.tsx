import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import BaseTabela from '../BaseTabela'
import { FILTROS_VAZIOS, type MultaLinha } from '@/lib/sofia/bases/tipos'

jest.mock('../DetalheNovas', () => ({ __esModule: true, default: () => null }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
jest.mock('@/lib/sofia/bases/exportar', () => ({ baixarExcel: jest.fn() }))
jest.mock('../../abastecimento/_corrigir', () => ({ __esModule: true, default: () => null }))
jest.mock('../../abastecimento/_actions', () => ({ deletarAbastecimentoAction: jest.fn() }))
jest.mock('../../km/_corrigir', () => ({ __esModule: true, default: () => null }))
jest.mock('../../km/_actions', () => ({ deletarKmAction: jest.fn() }))
jest.mock('../../motoristas/_actions', () => ({ desativarMotoristaAction: jest.fn() }))
jest.mock('@/components/sofia/DeleteConfirmButton', () => ({ __esModule: true, default: () => null }))

const multa = (i: number, sit: MultaLinha['sit']): MultaLinha => ({
  id: `m${i}`, data: '2026-10-01', placa: `AAA000${i}`, motorista: null, infracao: 'x', valor: 10,
  desc: null, sit, prazo: null, aut: 'nenhuma' as MultaLinha['aut'], autSolicitadoEm: null,
})

function Harness() {
  const [marcados, setMarcados] = useState<string[]>([])
  return (
    <>
      <span data-testid="n">{marcados.length}</span>
      <BaseTabela
        base="multa" nome="Multas" hoje="2026-11-04" podeGerir
        linhas={[multa(1, 'registrada'), multa(2, 'registrada'), multa(3, 'validada')]}
        filtrosIniciais={{ ...FILTROS_VAZIOS }}
        equipes={[]} placas={[]} motoristas={[]} vazio="vazio" placeholderBusca="Buscar"
        selecao={{ marcados, onChange: setMarcados }}
      />
    </>
  )
}

describe('BaseTabela: seleção em massa', () => {
  it('zera a seleção ao mudar a busca', () => {
    render(<Harness />)
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    expect(screen.getByTestId('n').textContent).toBe('1')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'AAA0003' } })
    expect(screen.getByTestId('n').textContent).toBe('0')
  })
})
