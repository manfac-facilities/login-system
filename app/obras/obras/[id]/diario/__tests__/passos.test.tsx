import { fireEvent, render, screen, within } from '@testing-library/react'

jest.mock('../_actions', () => ({
  salvarRascunhoAction: jest.fn(async () => ({ ok: true, rdoId: 'r1' })),
  registrarFotoAction: jest.fn(),
  removerFotoAction: jest.fn(),
  validarEEnviarAction: jest.fn(async () => ({ ok: true, enviados: 2 })),
}))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

import PassosDiario from '../_passos'
import { salvarRascunhoAction, validarEEnviarAction } from '../_actions'
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

  it('item do plano da semana fora da lista do dia entra já listado, com selo, e salva sem avanço', async () => {
    const outra: AtividadeDiario = { numero: 20, etapa: 'Acabamento', descricao: 'Pintura do depósito', atual: 0.3, travada: false, motivoTrava: null }
    montar({ outras: [outra], noPlano: [20] })
    abrirPasso(/O que andou/)
    const item = screen.getByTestId('atividade-20')
    expect(within(item).getByText('no plano')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await screen.findByRole('button', { name: 'Salvar rascunho' })
    const corpo = (salvarRascunhoAction as jest.Mock).mock.calls.at(-1)[2] as RascunhoRdo
    expect(corpo.avancos).toContainEqual({ numero: 20, de: 0.3, para: 0.3, concluida: false, causa: null })
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

  describe('Validar e enviar salva antes o que está na tela (item 10)', () => {
    beforeEach(() => jest.clearAllMocks())

    it('sem ter salvo o rascunho: salva o estado atual e só então valida', async () => {
      const ordem: string[] = []
      ;(salvarRascunhoAction as jest.Mock).mockImplementationOnce(async () => (ordem.push('salvar'), { ok: true, rdoId: 'r1' }))
      ;(validarEEnviarAction as jest.Mock).mockImplementationOnce(async () => (ordem.push('validar'), { ok: true, enviados: 2 }))
      montar({ validacao: { previaHtml: null, pendentes: null } })
      abrirPasso(/O que andou/)
      fireEvent.change(within(screen.getByTestId('atividade-6')).getByRole('spinbutton'), { target: { value: '70' } })
      fireEvent.click(screen.getByRole('button', { name: 'Validar e enviar' }))
      await screen.findByText(/Diário enviado para 2/)
      expect(ordem).toEqual(['salvar', 'validar'])
      expect(salvarRascunhoAction).toHaveBeenCalledWith(
        'o1', '2026-10-29',
        expect.objectContaining({ avancos: expect.arrayContaining([expect.objectContaining({ numero: 6, para: 0.7 })]) }),
      )
      expect(validarEEnviarAction).toHaveBeenCalledWith('o1', '2026-10-29')
    })

    it('se salvar falhar (validação ou servidor), não valida nem envia', async () => {
      ;(salvarRascunhoAction as jest.Mock).mockImplementationOnce(async () => ({ ok: false, erro: 'Atividade 6: travada' }))
      montar({ validacao: { previaHtml: null, pendentes: null } })
      fireEvent.click(screen.getByRole('button', { name: 'Validar e enviar' }))
      expect(await screen.findByText('Atividade 6: travada')).toBeInTheDocument()
      expect(validarEEnviarAction).not.toHaveBeenCalled()
    })

    it('já validado (reenvio): não tenta salvar', async () => {
      montar({ estado: 'validado', rdoId: 'r1', validacao: { previaHtml: '<p>x</p>', pendentes: null } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar de novo' }))
      await screen.findByText(/Diário enviado para 2/)
      expect(salvarRascunhoAction).not.toHaveBeenCalled()
    })
  })

  describe('Incluir outra atividade (itens 6/11)', () => {
    const outras: AtividadeDiario[] = [
      { numero: 20, etapa: 'Acabamento', descricao: 'Pintura da fachada', atual: 0.1, travada: false, motivoTrava: null },
      { numero: 21, etapa: 'Acabamento', descricao: 'Forro de gesso', atual: 0, travada: false, motivoTrava: null },
      { numero: 30, etapa: 'Elétrica', descricao: 'Quadro geral', atual: 0, travada: true, motivoTrava: 'Travada até a atividade 6 ser concluída' },
    ]
    beforeEach(() => jest.clearAllMocks())

    it('lista agrupada por etapa, com busca; a incluída entra com de = % atual e vai no rascunho', async () => {
      montar({ outras })
      abrirPasso(/O que andou/)
      fireEvent.click(screen.getByRole('button', { name: 'Incluir outra atividade' }))
      const lista = screen.getByRole('region', { name: 'Incluir outra atividade' })
      expect(within(lista).getByRole('group', { name: 'Acabamento' })).toBeInTheDocument()
      expect(within(lista).getByRole('group', { name: 'Elétrica' })).toBeInTheDocument()
      fireEvent.change(within(lista).getByRole('searchbox', { name: /Buscar/ }), { target: { value: 'fachada' } })
      expect(within(lista).queryByText(/Forro de gesso/)).not.toBeInTheDocument()
      fireEvent.click(within(lista).getByRole('button', { name: /20 · Pintura da fachada/ }))

      const cartao = screen.getByTestId('atividade-20')
      expect(within(cartao).getByText(/antes 10%/)).toBeInTheDocument()
      fireEvent.change(within(cartao).getByRole('spinbutton'), { target: { value: '30' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
      await screen.findByText(/Rascunho salvo/)
      expect(salvarRascunhoAction).toHaveBeenLastCalledWith(
        'o1', '2026-10-29',
        expect.objectContaining({
          avancos: expect.arrayContaining([{ numero: 20, de: 0.1, para: 0.3, concluida: false, causa: null }]),
        }),
      )
    })

    it('a incluída some da lista; atividade travada entra com cadeado (trava respeitada)', () => {
      montar({ outras })
      abrirPasso(/O que andou/)
      fireEvent.click(screen.getByRole('button', { name: 'Incluir outra atividade' }))
      fireEvent.click(screen.getByRole('button', { name: /30 · Quadro geral/ }))
      expect(within(screen.getByTestId('atividade-30')).getByRole('slider')).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Incluir outra atividade' }))
      expect(screen.queryByRole('button', { name: /30 · Quadro geral/ })).not.toBeInTheDocument()
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
