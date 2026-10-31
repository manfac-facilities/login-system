import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { obraPeriodo } from '../../../_pdf/__tests__/fixtures/periodo'
import { BLOCOS, montarApresentacao } from '../../../_lib/apresentacao'
import TelaCheia from '../_tela-cheia'

const hoje = '2026-11-10'
const conteudo = (blocos: (typeof BLOCOS)[number][] = ['capa', 'resumo', 'cronograma', 'marcos']) =>
  montarApresentacao({
    obra: obraPeriodo(), inicio: '2026-11-01', fim: hoje, ref: hoje, hoje, planos: [], restricoes: [],
    destaques: ['Etapa 1 concluída antes do previsto'], blocos,
  })

describe('TelaCheia', () => {
  it('abre no slide 1 com contador, navega por setas e botões, e Esc sai', async () => {
    render(<TelaCheia conteudo={conteudo()} fotos={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Apresentar em tela cheia/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 4')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'End' })
    expect(screen.getByText('4 / 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('tecla F pede tela cheia ao elemento', async () => {
    const pedir = jest.fn().mockResolvedValue(undefined)
    HTMLElement.prototype.requestFullscreen = pedir
    render(<TelaCheia conteudo={conteudo()} fotos={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Apresentar em tela cheia/ }))
    fireEvent.keyDown(window, { key: 'f' })
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it('deslizar o dedo troca de slide', async () => {
    render(<TelaCheia conteudo={conteudo()} fotos={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Apresentar em tela cheia/ }))
    const d = screen.getByRole('dialog')
    fireEvent.touchStart(d, { touches: [{ clientX: 300, clientY: 100 }] })
    fireEvent.touchEnd(d, { changedTouches: [{ clientX: 100, clientY: 110 }] })
    expect(screen.getByText('2 / 4')).toBeInTheDocument()
    fireEvent.touchStart(d, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchEnd(d, { changedTouches: [{ clientX: 300, clientY: 100 }] })
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
  })

  it('só os blocos com conteúdo viram slide e a tela não mostra NaN nem R$', async () => {
    const og = obraPeriodo()
    og.calc = null
    og.calcBase = null
    og.etapas = []
    og.impedimentos = []
    const vazio = montarApresentacao({ obra: og, inicio: '2026-11-01', fim: hoje, ref: hoje, hoje, planos: [], restricoes: [], destaques: [], blocos: [...BLOCOS] })
    render(<TelaCheia conteudo={vazio} fotos={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Apresentar em tela cheia/ }))
    expect(screen.getByText('1 / 1')).toBeInTheDocument()

  })

  it('percorrendo todos os slides com dado: sem NaN, R$ nem Infinity', async () => {
    render(<TelaCheia conteudo={conteudo()} fotos={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Apresentar em tela cheia/ }))
    for (let k = 0; k < 4; k++) {
      expect(screen.getByRole('dialog').textContent).not.toMatch(/NaN|R\$|Infinity|undefined/)
      fireEvent.keyDown(window, { key: 'ArrowRight' })
    }
    expect(screen.getByRole('status')).toHaveTextContent('4 / 4')
  })

  it('Espaço no botão em foco ativa o botão, não avança o slide', async () => {
    render(<TelaCheia conteudo={conteudo()} fotos={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /Apresentar em tela cheia/ }))
    const sair = screen.getByRole('button', { name: /Sair/ })
    sair.focus()
    fireEvent.keyDown(sair, { key: ' ', bubbles: true })
    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: ' ', bubbles: true })
    expect(screen.getByText('2 / 4')).toBeInTheDocument()
  })

  it('Tab fica preso no diálogo e Esc devolve o foco ao botão Apresentar', async () => {
    jest.useFakeTimers()
    render(<TelaCheia conteudo={conteudo()} fotos={[]} />)
    const abrir = screen.getByRole('button', { name: /Apresentar em tela cheia/ })
    fireEvent.click(abrir)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveFocus()
    const proximo = screen.getByRole('button', { name: 'Próximo' })
    proximo.focus()
    fireEvent.keyDown(proximo, { key: 'Tab' })
    expect(screen.getByRole('button', { name: /Tela cheia/ })).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })
    act(() => {
      jest.runAllTimers()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(abrir).toHaveFocus()
    jest.useRealTimers()
  })

  it('fotos viram um slide extra', async () => {
    render(<TelaCheia conteudo={conteudo(['capa'])} fotos={[{ url: 'https://x/a.jpg', legenda: 'Piso', data: '2026-11-03' }]} />)
    await userEvent.click(screen.getByRole('button', { name: /Apresentar em tela cheia/ }))
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('img', { name: 'Piso' })).toBeInTheDocument()
  })
})
