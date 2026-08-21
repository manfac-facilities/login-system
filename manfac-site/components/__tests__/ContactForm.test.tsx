import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactForm from '../ContactForm'

vi.mock('@/app/contato/_actions', () => ({
  registrarLeadAction: vi.fn(async () => ({ ok: true, id: 'lead-1' })),
  completarLeadAction: vi.fn(async () => ({ ok: true })),
}))

import { registrarLeadAction, completarLeadAction } from '@/app/contato/_actions'

async function preencherEtapa1(user: ReturnType<typeof userEvent.setup>, caminho = 'Obra ou reforma') {
  await user.click(screen.getByText(caminho))
  await user.type(screen.getByLabelText(/Nome/), 'Maria Souza')
  await user.type(screen.getByLabelText(/E-mail/), 'maria@empresa.com.br')
  await user.type(screen.getByLabelText(/Telefone/), '21999990000')
  await user.click(screen.getByRole('checkbox'))
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom não implementa window.open; sem o stub, cada teste que chega na
  // etapa 2 imprime "Not implemented" no console e polui a saída da suíte.
  vi.spyOn(window, 'open').mockImplementation(() => null)
})

describe('ContactForm', () => {
  it('mostra os 3 caminhos e esconde o formulário até escolher', () => {
    render(<ContactForm />)
    expect(screen.getByRole('button', { name: /manutenção recorrente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /obra ou reforma/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /avaliação técnica/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument()
  })

  it('mostra a etapa 1 após escolher caminho; empresa e localidade só aparecem na etapa 2', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await user.click(screen.getByRole('button', { name: /obra ou reforma/i }))
    expect(screen.getByLabelText(/^nome/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/empresa/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/localidade/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/nº de unidades/i)).not.toBeInTheDocument()
  })

  it('nº de unidades aparece na etapa 2 só para manutenção recorrente', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user, 'Manutenção recorrente')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(await screen.findByLabelText(/nº de unidades/i)).toBeInTheDocument()
  })

  it('nº de unidades não aparece na etapa 2 para os outros caminhos', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user, 'Obra ou reforma')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByLabelText(/empresa/i)
    expect(screen.queryByLabelText(/nº de unidades/i)).not.toBeInTheDocument()
  })
})

describe('ContactForm em duas etapas', () => {
  it('a etapa 1 grava o lead antes de qualquer WhatsApp', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(registrarLeadAction).toHaveBeenCalledTimes(1)
  })

  it('o checkbox de consentimento não vem pré-marcado', () => {
    render(<ContactForm />)
    fireEvent.click(screen.getByText('Obra ou reforma'))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('a etapa 2 tem saída explícita para quem não quer preencher', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(await screen.findByRole('button', { name: /pular/i })).toBeTruthy()
  })

  it('a etapa 2 indexa ao mesmo lead, nunca cria outro', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.type(await screen.findByLabelText(/Empresa/), 'Rede X')
    await user.click(screen.getByRole('button', { name: /enviar/i }))
    expect(completarLeadAction).toHaveBeenCalledWith('lead-1', expect.objectContaining({ empresa: 'Rede X' }))
    expect(registrarLeadAction).toHaveBeenCalledTimes(1)
  })

  it('mostra erro da action sem perder o que foi digitado', async () => {
    ;(registrarLeadAction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      erro: 'É preciso autorizar o uso dos seus dados para continuar.',
    })
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(await screen.findByText(/autorizar o uso dos seus dados/i)).toBeTruthy()
    expect((screen.getByLabelText(/Nome/) as HTMLInputElement).value).toBe('Maria Souza')
  })
})
