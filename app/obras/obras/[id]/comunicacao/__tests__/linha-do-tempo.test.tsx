jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock('../_actions', () => ({
  apagarRegistroAction: jest.fn(),
  criarRegistroAction: jest.fn(),
  editarRegistroAction: jest.fn(),
  enviarAtaAction: jest.fn(),
}))

import { fireEvent, render, screen } from '@testing-library/react'
import LinhaDoTempo from '../_linha-do-tempo'
import type { Envio, ItemLinha, Registro } from '../_tipos'

const envio: Envio = {
  id: 'd1', tipo: 'diario', referencia: '2026-10-29', lado: 'cliente', enviadoPor: 'eng@manfac.com.br',
  enviadoEm: '2026-10-29T21:00:00Z', destinatarios: ['c@cli.com'], resultado: 'ok', detalhe: null, registroId: null,
}
const reuniao: Registro = {
  id: 'r1', tipo: 'reuniao', data: '2026-10-29', participantes: 'Ana', texto: null,
  ata: { pauta: 'Andamento', decisoes: ['Liberar área'], pendencias: [{ oque: 'Projeto', responsavel: 'Ana', prazo: '2026-11-05' }] },
  nivel: null, impedimentoId: null, atividadeNumero: null, criadoPor: 'a@manfac.com.br', criadoEm: '2026-10-29T18:00:00Z', editadoEm: null,
}
const itens = (podeEditar: boolean): ItemLinha[] => [
  { tipo: 'envio', chave: 'e-d1', quando: envio.enviadoEm, envio },
  { tipo: 'registro', chave: 'r-r1', quando: reuniao.criadoEm, registro: reuniao, envios: [], podeEditar },
]
const dest = [
  { email: 'c@cli.com', nome: 'Carla', lado: 'cliente' as const, tipos: ['diario'] },
  { email: 'g@cli.com', nome: null, lado: 'cliente' as const, tipos: ['mensal'] },
]

describe('linha do tempo', () => {
  it('diário com Abrir PDF; reunião com Baixar PDF; sem editar fora da janela; sem enviar sem permissão', () => {
    render(<LinhaDoTempo itens={itens(false)} obraId="o1" hoje="2026-10-30" podeEnviar={false} destinatarios={dest} />)
    expect(screen.getByRole('link', { name: 'Abrir PDF' })).toHaveAttribute('href', '/obras/obras/o1/diario/pdf/2026-10-29')
    expect(screen.getByRole('link', { name: 'Baixar PDF' })).toHaveAttribute('href', '/obras/obras/o1/comunicacao/ata/r1')
    expect(screen.getByText('Liberar área')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apagar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Enviar por e-mail' })).toBeNull()
  })

  it('envio da ata: padrão = cliente com tipo diário; confirmação lista quem recebe', () => {
    render(<LinhaDoTempo itens={itens(true)} obraId="o1" hoje="2026-10-30" podeEnviar destinatarios={dest} />)
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por e-mail' }))
    expect(screen.getByRole('checkbox', { name: /Carla/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'g@cli.com' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar envio' }))
    expect(screen.getByText(/Carla <c@cli.com> · cliente/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar a 1' })).toBeInTheDocument()
  })
})
