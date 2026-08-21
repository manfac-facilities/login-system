import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

  it('pede e-mail corporativo — regressão de copy: "corporativo" precisa estar na label', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await user.click(screen.getByRole('button', { name: /obra ou reforma/i }))
    // Regex frouxo (/E-mail/) casaria com "E-mail" sozinho e não pegaria a
    // regressão que já aconteceu uma vez. Precisa exigir "corporativo".
    expect(screen.getByLabelText(/^E-mail corporativo/)).toBeInTheDocument()
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
    // O botão precisa sair do estado de carregando — senão a pessoa vê o erro
    // mas não consegue tentar de novo.
    expect(screen.getByRole('button', { name: /^continuar$/i })).not.toBeDisabled()
  })

  it('não trava em "enviando" quando a action rejeita em vez de devolver { ok: false }', async () => {
    ;(registrarLeadAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente')
    )
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(await screen.findByRole('button', { name: /^continuar$/i })).not.toBeDisabled()
    expect((screen.getByLabelText(/Nome/) as HTMLInputElement).value).toBe('Maria Souza')
  })

  it('clicar num outro box durante a etapa 2 não volta para a etapa 1 nem registra outro lead', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user, 'Obra ou reforma')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByLabelText(/Empresa/)
    expect(registrarLeadAction).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /avaliação técnica/i }))

    // Ainda na etapa 2: os campos da etapa 2 continuam visíveis, os da etapa
    // 1 não voltaram, e nenhum segundo lead foi criado.
    expect(screen.getByLabelText(/Empresa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continuar/i })).not.toBeInTheDocument()
    expect(registrarLeadAction).toHaveBeenCalledTimes(1)
  })

  it('clicar no MESMO box já selecionado durante a etapa 2 também não volta para a etapa 1', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user, 'Obra ou reforma')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByLabelText(/Empresa/)
    expect(registrarLeadAction).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /obra ou reforma/i }))

    expect(screen.getByLabelText(/Empresa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continuar/i })).not.toBeInTheDocument()
    expect(registrarLeadAction).toHaveBeenCalledTimes(1)
  })

  it('os boxes ganham aria-disabled na etapa 2, sem mudar aparência nem copy', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user, 'Obra ou reforma')
    expect(screen.getByRole('button', { name: /obra ou reforma/i })).toHaveAttribute('aria-disabled', 'false')

    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByLabelText(/Empresa/)

    expect(screen.getByRole('button', { name: /obra ou reforma/i })).toHaveAttribute('aria-disabled', 'true')
  })

  it('mostra fora dos boxes o caminho para trocar de demanda na etapa 2', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user, 'Obra ou reforma')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByLabelText(/Empresa/)

    // Texto quebrado entre nó de texto e o <a> do link — checar o
    // textContent inteiro evita ambiguidade de getByText casando com
    // ancestrais.
    expect(document.body.textContent).toMatch(/trocar o tipo de demanda/i)
  })
})

describe('ContactForm — campo-armadilha', () => {
  it('é renderizado e seu valor chega em registrarLeadAction', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await user.click(screen.getByText('Obra ou reforma'))

    // Sem label nem role acessível de propósito — é invisível para gente.
    // Localizado pelo name do input, como um robô que varre o DOM faria.
    const armadilha = document.querySelector('input[name="armadilha"]') as HTMLInputElement
    expect(armadilha).toBeInTheDocument()
    expect(armadilha).toHaveAttribute('aria-hidden', 'true')

    fireEvent.change(armadilha, { target: { value: 'http://spam.example' } })
    await user.type(screen.getByLabelText(/Nome/), 'Maria Souza')
    await user.type(screen.getByLabelText(/E-mail/), 'maria@empresa.com.br')
    await user.type(screen.getByLabelText(/Telefone/), '21999990000')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(registrarLeadAction).toHaveBeenCalledWith(
      expect.objectContaining({ armadilha: 'http://spam.example' })
    )
  })
})

describe('ContactForm — falha de infra na etapa 1 (achado crítico #1)', () => {
  it('falha de infra oferece link para o WhatsApp', async () => {
    ;(registrarLeadAction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      erro: 'Não conseguimos registrar agora. Fale com a gente no WhatsApp.',
      falha: 'infra',
    })
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(await screen.findByText(/não conseguimos registrar agora/i)).toBeTruthy()
    const link = screen.getByRole('link', { name: /whatsapp/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('wa.me'))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('falha de validação NÃO oferece link — a pessoa deve corrigir o campo', async () => {
    ;(registrarLeadAction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      erro: 'Informe um e-mail válido.',
      falha: 'validacao',
    })
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    expect(await screen.findByText(/informe um e-mail válido/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /whatsapp/i })).not.toBeInTheDocument()
  })
})

describe('ContactForm — etapa 2, concluir() (achado #2)', () => {
  it('"Pular e falar agora" abre o wa.me e NÃO chama completarLeadAction', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByRole('button', { name: /pular/i })

    await user.click(screen.getByRole('button', { name: /pular/i }))

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank',
      'noopener,noreferrer'
    )
    expect(completarLeadAction).not.toHaveBeenCalled()
  })

  it('"Enviar e falar no WhatsApp" grava a etapa 2 antes de abrir o wa.me', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByLabelText(/Empresa/)

    await user.click(screen.getByRole('button', { name: /enviar e falar no whatsapp/i }))

    expect(completarLeadAction).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalled()
  })

  it('quando completarLeadAction rejeita, o WhatsApp abre mesmo assim', async () => {
    ;(completarLeadAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('falhou'))
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByLabelText(/Empresa/)

    await user.click(screen.getByRole('button', { name: /enviar e falar no whatsapp/i }))

    expect(window.open).toHaveBeenCalled()
  })

  it('popup bloqueado (window.open devolve null): mostra erro com link visível', async () => {
    ;(window.open as ReturnType<typeof vi.fn>).mockReturnValueOnce(null)
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByRole('button', { name: /pular/i })

    await user.click(screen.getByRole('button', { name: /pular/i }))

    const link = await screen.findByRole('link', { name: /abrir whatsapp/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('wa.me'))
  })

  it('desabilita os dois botões da etapa 2 enquanto enviando — duplo clique não dispara duas chamadas', async () => {
    let resolveCompletar: (v: { ok: boolean }) => void = () => {}
    ;(completarLeadAction as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCompletar = resolve
      })
    )
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await screen.findByLabelText(/Empresa/)

    const enviar = screen.getByRole('button', { name: /enviar e falar no whatsapp/i })
    const pular = screen.getByRole('button', { name: /pular/i })

    await user.click(enviar)
    expect(enviar).toBeDisabled()
    expect(pular).toBeDisabled()

    resolveCompletar({ ok: true })
    await waitFor(() => expect(enviar).not.toBeDisabled())
    expect(completarLeadAction).toHaveBeenCalledTimes(1)
  })
})
