/**
 * Testes da janela `_ui/dialogo.tsx`.
 *
 * ATENÇÃO, FRENTE DA JANELA DE REMARCAÇÃO (§7.5 da spec): **o jsdom desta
 * versão não implementa `HTMLDialogElement`** — `showModal`, `close` e o
 * fechar-no-Esc não existem, `typeof d.showModal` é `undefined`. Verificado em
 * 18/09/2026. O que estes testes exercitam é o caminho de reserva do
 * componente, que existe exatamente por isso; em navegador de verdade quem faz
 * o trabalho é o `<dialog>` nativo. Consequência prática: um teste que chame
 * `showModal` direto, ou que espere o Esc fechar sozinho um `<dialog>` cru,
 * falha por causa do ambiente, não do código.
 *
 * Padrão de `obra/[id]/__tests__/_historico.test.tsx`: @testing-library/react,
 * sem banco e sem mock de rede — a janela não fala com ninguém.
 */

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dialogo, { type BotaoDialogo } from '../dialogo'

function Palco({ botoes }: { botoes: BotaoDialogo[] }) {
  const [aberto, setAberto] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setAberto(true)}>
        Salvar
      </button>
      <Dialogo
        aberto={aberto}
        titulo="Remarcar o início"
        botoes={botoes}
        onFechar={() => setAberto(false)}
      >
        <p>O que vai acontecer ao salvar</p>
      </Dialogo>
    </div>
  )
}

function padrao(onConfirmar: jest.Mock): BotaoDialogo[] {
  return [
    { id: 'b-cancelar', texto: 'Cancelar', ghost: true },
    { id: 'b-ok', texto: 'Remarcar e salvar', onClick: onConfirmar },
  ]
}

test('abre com o título ligado por aria-labelledby e o foco no primeiro ghost', async () => {
  const u = userEvent.setup()
  render(<Palco botoes={padrao(jest.fn())} />)

  expect(screen.queryByText('O que vai acontecer ao salvar')).not.toBeInTheDocument()

  await u.click(screen.getByRole('button', { name: 'Salvar' }))

  expect(screen.getByRole('dialog')).toHaveAccessibleName('Remarcar o início')
  // O foco nasce na saída, não na ação: Enter sem ler não grava nada.
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
})

test('Esc fecha sem confirmar e devolve o foco a quem abriu', async () => {
  const u = userEvent.setup()
  const onConfirmar = jest.fn()
  render(<Palco botoes={padrao(onConfirmar)} />)

  const gatilho = screen.getByRole('button', { name: 'Salvar' })
  await u.click(gatilho)
  await u.keyboard('{Escape}')

  expect(onConfirmar).not.toHaveBeenCalled()
  expect(screen.queryByText('O que vai acontecer ao salvar')).not.toBeInTheDocument()
  expect(gatilho).toHaveFocus()
})

test('clicar num botão fecha a janela e roda o onClick', async () => {
  const u = userEvent.setup()
  const onConfirmar = jest.fn()
  render(<Palco botoes={padrao(onConfirmar)} />)

  const gatilho = screen.getByRole('button', { name: 'Salvar' })
  await u.click(gatilho)
  await u.click(screen.getByRole('button', { name: 'Remarcar e salvar' }))

  expect(onConfirmar).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('O que vai acontecer ao salvar')).not.toBeInTheDocument()
  expect(gatilho).toHaveFocus()
})

test('botão desabilitado não é clicável e não recebe o foco de abertura', async () => {
  const u = userEvent.setup()
  const onConfirmar = jest.fn()
  render(
    <Palco
      botoes={[
        { id: 'b-ok', texto: 'Remarcar e salvar', desabilitado: true, onClick: onConfirmar },
        { id: 'b-cancelar', texto: 'Cancelar', ghost: true },
      ]}
    />
  )

  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()

  await u.click(screen.getByRole('button', { name: 'Remarcar e salvar' }))
  expect(onConfirmar).not.toHaveBeenCalled()
  expect(screen.getByText('O que vai acontecer ao salvar')).toBeInTheDocument()
})

test('sem botão ghost, o foco vai para o primeiro habilitado', async () => {
  const u = userEvent.setup()
  render(
    <Palco
      botoes={[
        { id: 'b-1', texto: 'Entendi' },
        { id: 'b-2', texto: 'Ver a obra' },
      ]}
    />
  )

  await u.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(screen.getByRole('button', { name: 'Entendi' })).toHaveFocus()
})
