/**
 * Testes da janela de remarcação (§7.5 da spec da ficha editável).
 *
 * ATENÇÃO AO AMBIENTE, medido em 18/09/2026: o jsdom desta versão implementa a
 * propriedade `open` do `<dialog>` (reflexo do atributo) mas **não**
 * `showModal()` nem `close()`, e por isso não fecha sozinho no Esc. Quem roda
 * aqui é o caminho de reserva de `_ui/dialogo.tsx`, que existe exatamente para
 * isso. Consequência prática: estes testes exercitam o COMPORTAMENTO do
 * componente — o botão habilitou, o campo apareceu, `onConfirmar` correu ou não
 * — e nunca a API nativa. Um teste que chamasse `showModal()` falharia por
 * causa do ambiente, não do código.
 *
 * Padrão de `_historico.test.tsx`: @testing-library/react, sem banco e sem
 * mock de rede. A action de cadastrar motivo entra por prop, como em produção.
 */

import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DialogoRemarcar, { type CadastrarMotivo, type Remarcacao } from '../_dialogo-remarcar'

/** A lista semeada pela migration, na grafia do código (D2 da spec). */
const MOTIVOS = [
  'Clima',
  'Cliente / loja',
  'Disponibilidade de equipe',
  'Contratação de prestador',
  'Falta de material',
  'Outro',
]

function Palco({
  onConfirmar,
  cadastrarMotivo,
}: {
  onConfirmar: (r: Remarcacao) => void
  cadastrarMotivo?: CadastrarMotivo
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setAberto(true)}>
        Salvar
      </button>
      <DialogoRemarcar
        aberto={aberto}
        de="2026-08-24"
        para="2026-09-01"
        duracao="20"
        motivos={MOTIVOS}
        cadastrarMotivo={cadastrarMotivo}
        onConfirmar={(r) => {
          setAberto(false)
          onConfirmar(r)
        }}
        onFechar={() => setAberto(false)}
      />
    </div>
  )
}

async function abrir(props: Parameters<typeof Palco>[0] = { onConfirmar: jest.fn() }) {
  const u = userEvent.setup()
  render(<Palco {...props} />)
  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  return u
}

const botaoOk = () => screen.getByRole('button', { name: 'Remarcar e salvar' })

describe('DialogoRemarcar', () => {
  it('"Remarcar e salvar" nasce desabilitado, e a lista de motivos tem legenda', async () => {
    await abrir()

    expect(botaoOk()).toBeDisabled()
    // <fieldset> com legenda: o pedido de acessibilidade do briefing.
    expect(screen.getByRole('group', { name: /Motivo da remarcação/ })).toBeInTheDocument()
    expect(screen.getByText('Escolha um motivo para remarcar.')).toBeInTheDocument()
  })

  it('escolher um motivo habilita o botão', async () => {
    const u = await abrir()

    await u.click(screen.getByRole('radio', { name: 'Clima' }))

    expect(botaoOk()).toBeEnabled()
    expect(screen.getByText('Pronto para salvar.')).toBeInTheDocument()
  })

  it('"Outro" revela a descrição e só habilita com 3 letras', async () => {
    const u = await abrir()

    expect(screen.queryByLabelText('Qual é o outro motivo?')).not.toBeInTheDocument()

    await u.click(screen.getByRole('radio', { name: 'Outro' }))

    const det = screen.getByLabelText('Qual é o outro motivo?')
    expect(det).toBeInTheDocument()
    expect(botaoOk()).toBeDisabled()
    expect(screen.getByText('Descreva o outro motivo (pelo menos 3 letras).')).toBeInTheDocument()

    await u.type(det, 'ab')
    expect(botaoOk()).toBeDisabled()

    await u.type(det, 'c')
    expect(botaoOk()).toBeEnabled()
  })

  it('devolve o motivo e a descrição em onConfirmar', async () => {
    const onConfirmar = jest.fn()
    const u = await abrir({ onConfirmar })

    await u.click(screen.getByRole('radio', { name: 'Outro' }))
    await u.type(screen.getByLabelText('Qual é o outro motivo?'), 'laudo do engenheiro')
    await u.click(botaoOk())

    expect(onConfirmar).toHaveBeenCalledWith({
      motivo: 'Outro',
      detalhe: 'laudo do engenheiro',
    })
  })

  it('cadastrar motivo novo acrescenta o rádio e já o deixa marcado', async () => {
    const cadastrarMotivo = jest
      .fn()
      .mockResolvedValue({ motivo: { id: 'm1', nome: 'Aguardando laudo técnico' } })
    const u = await abrir({ onConfirmar: jest.fn(), cadastrarMotivo })

    await u.click(screen.getByRole('button', { name: '+ Cadastrar novo motivo' }))
    await u.type(screen.getByLabelText('Novo motivo'), 'aguardando laudo técnico')
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }))

    const novo = await screen.findByRole('radio', { name: /Aguardando laudo técnico/ })
    expect(novo).toBeChecked()
    expect(botaoOk()).toBeEnabled()
    // Primeira letra maiúscula e espaços colapsados, como o mockup.
    expect(cadastrarMotivo).toHaveBeenCalledWith('Aguardando laudo técnico')
    // "Outro" continua sendo o último da lista.
    const nomes = screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)
    expect(nomes[nomes.length - 1]).toBe('Outro')
  })

  it('item 5b — motivo cadastrado que a lista do servidor passa a incluir não duplica o rádio', async () => {
    // Reproduz o encaixe real: `_ficha.tsx` revalida a página depois de
    // salvar, o `<DialogoRemarcar>` continua montado (não desmonta), e a
    // prop `motivos` chega atualizada — já com o nome que só existia em
    // `extras` até então. Sem o filtro em `montarLista`, o motivo aparecia
    // duas vezes, com os dois rádios marcados ao mesmo tempo.
    const cadastrarMotivo = jest
      .fn()
      .mockResolvedValue({ motivo: { id: 'm1', nome: 'Aguardando laudo técnico' } })
    const u = userEvent.setup()

    function PalcoComLista({ motivos }: { motivos: string[] }) {
      return (
        <DialogoRemarcar
          aberto
          de="2026-08-24"
          para="2026-09-01"
          duracao="20"
          motivos={motivos}
          cadastrarMotivo={cadastrarMotivo}
          onConfirmar={() => {}}
          onFechar={() => {}}
        />
      )
    }

    const { rerender } = render(<PalcoComLista motivos={MOTIVOS} />)

    await u.click(screen.getByRole('button', { name: '+ Cadastrar novo motivo' }))
    await u.type(screen.getByLabelText('Novo motivo'), 'aguardando laudo técnico')
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }))
    await screen.findByRole('radio', { name: /Aguardando laudo técnico/ })

    rerender(
      <PalcoComLista motivos={[...MOTIVOS.slice(0, -1), 'Aguardando laudo técnico', 'Outro']} />
    )

    expect(screen.getAllByRole('radio', { name: /Aguardando laudo técnico/ })).toHaveLength(1)
  })

  it('cadastrar nome que já existe escolhe o existente, avisa e não duplica', async () => {
    const cadastrarMotivo = jest.fn()
    const u = await abrir({ onConfirmar: jest.fn(), cadastrarMotivo })

    await u.click(screen.getByRole('button', { name: '+ Cadastrar novo motivo' }))
    // Sem acento e sem caixa é o MESMO motivo (R15).
    await u.type(screen.getByLabelText('Novo motivo'), '  contratacao   de PRESTADOR ')
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }))

    await waitFor(() =>
      expect(
        screen.getByText('"Contratação de prestador" já está na lista: foi escolhido para você.')
      ).toBeInTheDocument()
    )
    expect(screen.getByRole('radio', { name: 'Contratação de prestador' })).toBeChecked()
    expect(screen.getAllByRole('radio')).toHaveLength(MOTIVOS.length)
    // Nem foi ao servidor: a pré-checagem local é a mesma regra da action.
    expect(cadastrarMotivo).not.toHaveBeenCalled()
  })

  it('recusa nome novo com menos de 3 letras, sem chamar o servidor', async () => {
    const cadastrarMotivo = jest.fn()
    const u = await abrir({ onConfirmar: jest.fn(), cadastrarMotivo })

    await u.click(screen.getByRole('button', { name: '+ Cadastrar novo motivo' }))
    await u.type(screen.getByLabelText('Novo motivo'), 'ab')
    await u.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(screen.getByText('Escreva o motivo com pelo menos 3 letras.')).toBeInTheDocument()
    expect(cadastrarMotivo).not.toHaveBeenCalled()
  })

  it('Esc fecha sem confirmar', async () => {
    const onConfirmar = jest.fn()
    const u = await abrir({ onConfirmar })

    await u.click(screen.getByRole('radio', { name: 'Clima' }))
    await u.keyboard('{Escape}')

    expect(onConfirmar).not.toHaveBeenCalled()
    expect(screen.queryByRole('radio', { name: 'Clima' })).not.toBeInTheDocument()
  })

  it('"Voltar ao formulário" fecha sem confirmar', async () => {
    const onConfirmar = jest.fn()
    const u = await abrir({ onConfirmar })

    await u.click(screen.getByRole('radio', { name: 'Clima' }))
    await u.click(screen.getByRole('button', { name: 'Voltar ao formulário' }))

    expect(onConfirmar).not.toHaveBeenCalled()
    expect(screen.queryByRole('radio', { name: 'Clima' })).not.toBeInTheDocument()
  })

  it('reabrir recomeça a escolha: motivo de uma remarcação não se herda da anterior', async () => {
    const u = await abrir()

    await u.click(screen.getByRole('radio', { name: 'Clima' }))
    await u.click(screen.getByRole('button', { name: 'Voltar ao formulário' }))
    await u.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(screen.getByRole('radio', { name: 'Clima' })).not.toBeChecked()
    expect(botaoOk()).toBeDisabled()
  })
})
