/** Passo "Vem aí" do diário (material antecipado, spec §5.1). */
import { fireEvent, render, screen, within } from '@testing-library/react'

jest.mock('../../lookahead/_actions', () => ({
  responderNaoPrecisaAction: jest.fn(async () => ({ ok: true })),
  responderPrecisaAction: jest.fn(async () => ({ ok: true, id: 'r-novo' })),
}))

import VemAi from '../_vem-ai'
import { responderNaoPrecisaAction, responderPrecisaAction } from '../../lookahead/_actions'
import { linkPedirMaterial } from '../../../_lib/material'
import type { ItemVemAi } from '../../../_lib/material'

const itens: ItemVemAi[] = [
  { numero: 16, nome: 'Nova laje de piso armada', inicio: '2026-11-10', pedirAte: '2026-11-03' },
  { numero: 18, nome: 'Recuperação do mezanino', inicio: '2026-12-01', pedirAte: '2026-11-24' },
]
const montar = (lista: ItemVemAi[] | null = itens) =>
  render(<VemAi obraId="o1" hoje="2026-11-03" diasCompras={5} itens={lista} />)
const cartao = (n: number) => screen.getByTestId(`vem-ai-${n}`)

beforeEach(() => jest.clearAllMocks())

describe('VemAi', () => {
  it('título, datas do item e selo "Pedir hoje"', () => {
    montar()
    expect(screen.getByText('Vem aí: precisa de material?')).toBeInTheDocument()
    expect(within(cartao(16)).getByText('Começa 10/11 · Pedir até 03/11')).toBeInTheDocument()
    expect(within(cartao(16)).getByText('Pedir hoje')).toBeInTheDocument()
    expect(within(cartao(18)).getByText('Sem resposta')).toBeInTheDocument()
  })

  it('"Não precisa" chama a action e o item some', async () => {
    montar()
    fireEvent.click(within(cartao(16)).getByRole('button', { name: 'Não precisa' }))
    expect(responderNaoPrecisaAction).toHaveBeenCalledWith('o1', 16)
    await screen.findByText(/não precisa de material/)
    expect(screen.queryByTestId('vem-ai-16')).not.toBeInTheDocument()
    expect(cartao(18)).toBeInTheDocument()
  })

  it('"Precisa" abre "Qual material?"; Salvar vazio mostra erro e não chama a action', () => {
    montar()
    fireEvent.click(within(cartao(16)).getByRole('button', { name: 'Precisa' }))
    expect(within(cartao(16)).getByLabelText('Qual material?')).toBeInTheDocument()
    fireEvent.click(within(cartao(16)).getByRole('button', { name: 'Salvar' }))
    expect(within(cartao(16)).getByRole('alert')).toHaveTextContent('Diga qual é o material.')
    expect(responderPrecisaAction).not.toHaveBeenCalled()
  })

  it('depois de salvar aparece "Pedir no Compras" com o link já preenchido', async () => {
    montar()
    fireEvent.click(within(cartao(16)).getByRole('button', { name: 'Precisa' }))
    fireEvent.change(within(cartao(16)).getByLabelText('Qual material?'), { target: { value: 'Aço CA-50 10 mm' } })
    fireEvent.click(within(cartao(16)).getByRole('button', { name: 'Salvar' }))
    const link = await within(cartao(16)).findByRole('link', { name: 'Pedir no Compras' })
    expect(responderPrecisaAction).toHaveBeenCalledWith('o1', 16, 'Aço CA-50 10 mm')
    const esperado = linkPedirMaterial({
      obraId: 'o1',
      restricao: { id: 'r-novo', descricao: 'Aço CA-50 10 mm' } as Parameters<typeof linkPedirMaterial>[0]['restricao'],
      atividade: { numero: 16, nome: 'Nova laje de piso armada', inicio: '2026-11-10' },
    })
    expect(link).toHaveAttribute('href', esperado)
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('Salvar fica desabilitado enquanto a action roda (sem duplo clique)', async () => {
    let soltar: (v: { ok: true; id: string }) => void = () => {}
    ;(responderPrecisaAction as jest.Mock).mockImplementationOnce(() => new Promise((r) => (soltar = r)))
    montar()
    fireEvent.click(within(cartao(16)).getByRole('button', { name: 'Precisa' }))
    fireEvent.change(within(cartao(16)).getByLabelText('Qual material?'), { target: { value: 'Aço' } })
    const salvar = within(cartao(16)).getByRole('button', { name: 'Salvar' })
    fireEvent.click(salvar)
    expect(within(cartao(16)).getByRole('button', { name: /salvando/i })).toBeDisabled()
    soltar({ ok: true, id: 'r1' })
    await within(cartao(16)).findByRole('link', { name: 'Pedir no Compras' })
  })

  it('lista vazia → "Tudo respondido nas próximas 4 semanas."', () => {
    montar([])
    expect(screen.getByText('Tudo respondido nas próximas 4 semanas.')).toBeInTheDocument()
  })

  it('respostas não carregadas → aviso e nenhum botão', () => {
    montar(null)
    expect(screen.getByText('Não deu para carregar as respostas agora.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
