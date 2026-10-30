import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import AtualizarStatus from '../_atualizar-status'
import type { AtividadeStatus } from '../_tipos'

jest.mock('../_actions', () => ({ atualizarStatusAction: jest.fn() }))

const atividade: AtividadeStatus = {
  numero: 6, etapa: 'Estabilização', descricao: 'Escoramento', status: 'em_andamento', percentual: 0.5,
  inicioPrevisto: '2026-10-27', inicioReal: '2026-10-27', fimReal: null, diasRestantes: null, travada: false,
}

function Tela() {
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAberta(true)}>Atualizar status</button>
      {aberta ? (
        <AtualizarStatus
          obraId="o1" hoje="2026-10-30" atividades={[atividade]} cores={{}} atividadeTrava={null}
          onFechar={() => setAberta(false)} onSalvo={() => setAberta(false)}
        />
      ) : null}
    </>
  )
}

const abrir = () => {
  render(<Tela />)
  const gatilho = screen.getByRole('button', { name: 'Atualizar status' })
  gatilho.focus()
  fireEvent.click(gatilho)
  return gatilho
}

describe('gaveta "Atualizar status": foco', () => {
  it('abre com o foco dentro e Esc fecha devolvendo o foco ao botão', () => {
    const gatilho = abrir()
    const dialogo = screen.getByRole('dialog')
    expect(dialogo.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(gatilho)
  })

  it('Tab no último volta ao primeiro; Shift+Tab no primeiro vai ao último', () => {
    abrir()
    const dialogo = screen.getByRole('dialog')
    const focaveis = [...dialogo.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    ultimo.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(primeiro)
    primeiro.focus()
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(ultimo)
  })
})
