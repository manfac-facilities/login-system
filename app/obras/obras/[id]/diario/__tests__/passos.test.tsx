import { fireEvent, render, screen, within } from '@testing-library/react'

jest.mock('../_actions', () => ({
  salvarRascunhoAction: jest.fn(async () => ({ ok: true, rdoId: 'r1' })),
  registrarFotoAction: jest.fn(),
  removerFotoAction: jest.fn(),
}))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

import PassosDiario from '../_passos'
import { salvarRascunhoAction } from '../_actions'
import type { AtividadeDiario, RascunhoRdo } from '../_tipos'

const atividades: AtividadeDiario[] = [
  { numero: 6, etapa: 'Estrutura', descricao: 'Escoramento sob a treliça', atual: 0.5, travada: false, motivoTrava: null },
  { numero: 11, etapa: 'Estrutura', descricao: 'Abertura de porta', atual: 0, travada: true, motivoTrava: 'Travada até a atividade 6 ser concluída' },
]

const inicial: RascunhoRdo = {
  semExecucao: false,
  motivoSemExecucao: null,
  efetivo: 6,
  equipeTexto: null,
  clima: null,
  climaManha: null,
  climaTarde: null,
  programacaoAmanha: null,
  semImpedimento: false,
  avancos: [
    { numero: 6, de: 0.5, para: 0.5, concluida: false, causa: null },
    { numero: 11, de: 0, para: 0, concluida: false, causa: null },
  ],
}

const montar = (over: Partial<Parameters<typeof PassosDiario>[0]> = {}) =>
  render(
    <PassosDiario
      obraId="o1"
      data="2026-10-29"
      rdoId={null}
      estado={null}
      inicial={inicial}
      atividades={atividades}
      fotos={[]}
      {...over}
    />,
  )

function abrirPasso(nome: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: nome }))
}

describe('PassosDiario', () => {
  it('atividade travada aparece com cadeado e os controles desabilitados', () => {
    montar()
    abrirPasso(/O que andou/)
    const travada = screen.getByTestId('atividade-11')
    expect(within(travada).getByRole('img', { name: 'Travada' })).toBeInTheDocument()
    expect(within(travada).getByText('Travada até a atividade 6 ser concluída')).toBeInTheDocument()
    expect(within(travada).getByRole('slider')).toBeDisabled()
    expect(within(travada).getByRole('spinbutton')).toBeDisabled()
    expect(within(travada).getByRole('checkbox', { name: /Concluída/ })).toBeDisabled()

    const livre = screen.getByTestId('atividade-6')
    expect(within(livre).queryByRole('img', { name: 'Travada' })).not.toBeInTheDocument()
    expect(within(livre).getByRole('slider')).not.toBeDisabled()
    expect(within(livre).getByRole('checkbox', { name: /Concluída/ })).not.toBeDisabled()
  })

  it('atividade que não andou mostra os chips de causa; escolher marca o chip', () => {
    montar()
    abrirPasso(/O que andou/)
    const livre = screen.getByTestId('atividade-6')
    const chip = within(livre).getByRole('button', { name: 'Cliente / loja' })
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('avançou: some o "por quê"', () => {
    montar()
    abrirPasso(/O que andou/)
    const livre = screen.getByTestId('atividade-6')
    fireEvent.change(within(livre).getByRole('spinbutton'), { target: { value: '70' } })
    expect(within(livre).queryByRole('button', { name: 'Material' })).not.toBeInTheDocument()
  })

  it('sem execução esconde equipe e avanço e exige o motivo', () => {
    montar()
    fireEvent.click(screen.getByRole('checkbox', { name: /Sem execução hoje/ }))
    expect(screen.queryByRole('button', { name: /O que andou/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Equipe/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Impedimentos/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Diga o motivo de não ter tido execução hoje')
    expect(salvarRascunhoAction).not.toHaveBeenCalled()
  })

  it('o passo 4 renderiza o slot de impedimentos recebido', () => {
    montar({ impedimentos: <p>formulário de impedimento</p> })
    abrirPasso(/Impedimentos/)
    expect(screen.getByText('formulário de impedimento')).toBeInTheDocument()
  })

  describe('"Sem impedimentos hoje" (item 7)', () => {
    it('marcar deixa o passo 4 preenchido e vai no rascunho', async () => {
      montar({ impedimentos: <p>form</p> })
      expect(screen.getByRole('button', { name: /Impedimentos/ })).not.toHaveAccessibleName(/preenchido/)
      abrirPasso(/Impedimentos/)
      fireEvent.click(screen.getByRole('checkbox', { name: /Sem impedimentos hoje/ }))
      expect(screen.getByRole('button', { name: /Impedimentos/ })).toHaveAccessibleName(/preenchido/)
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
      await screen.findByText(/Rascunho salvo/)
      expect(salvarRascunhoAction).toHaveBeenLastCalledWith('o1', '2026-10-29', expect.objectContaining({ semImpedimento: true }))
    })

    it('com impedimento registrado no dia: passo preenchido, opção some e o flag não vai', async () => {
      montar({ inicial: { ...inicial, semImpedimento: true }, impedimentosHoje: 1 })
      expect(screen.getByRole('button', { name: /Impedimentos/ })).toHaveAccessibleName(/preenchido/)
      abrirPasso(/Impedimentos/)
      expect(screen.queryByRole('checkbox', { name: /Sem impedimentos hoje/ })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
      await screen.findByText(/Rascunho salvo/)
      expect(salvarRascunhoAction).toHaveBeenLastCalledWith('o1', '2026-10-29', expect.objectContaining({ semImpedimento: false }))
    })
  })

  it('diário validado: só leitura', () => {
    montar({ estado: 'validado', rdoId: 'r1' })
    expect(screen.getByText(/Diário já validado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument()
    abrirPasso(/O que andou/)
    expect(within(screen.getByTestId('atividade-6')).getByRole('slider')).toBeDisabled()
  })
})
