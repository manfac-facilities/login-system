import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

jest.mock('../_actions', () => ({
  registrarFotoAction: jest.fn(async () => ({ ok: true, fotoId: 'nova' })),
  removerFotoAction: jest.fn(),
}))
const upload = jest.fn(async () => ({ error: null }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ storage: { from: () => ({ upload }) } }) }))
jest.mock('../../../../diario/_foto', () => ({ reduzir: jest.fn(async () => new Blob(['x'], { type: 'image/jpeg' })) }))

import FotosDiario from '../_fotos'
import { registrarFotoAction } from '../_actions'
import type { FotoRdo, MapaDiario } from '../_tipos'

const mapa: MapaDiario = {
  ambientes: [
    { id: 'A', nome: 'Salão', atividades: [4] },
    { id: 'B', nome: 'Farmácia', atividades: [] },
  ],
  pontos: [
    { id: 'p1', numero: 1, nome: 'Salão, entrada', ambienteId: 'A', referenciaUrl: 'https://x/ref1', referenciaData: '2026-10-31' },
    { id: 'p2', numero: 2, nome: 'Salão, fundo', ambienteId: 'A', referenciaUrl: null, referenciaData: null },
    { id: 'p3', numero: 3, nome: 'Farmácia', ambienteId: 'B', referenciaUrl: null, referenciaData: null },
  ],
  atividades: [
    { numero: 4, descricao: 'Drywall do salão' },
    { numero: 5, descricao: 'Pintura' },
  ],
}
const foto = (id: string, pontoId: string | null): FotoRdo => ({ id, path: `o/${id}.jpg`, legenda: null, url: null, ambienteId: 'A', pontoId })

const montar = (over: Partial<Parameters<typeof FotosDiario>[0]> = {}) =>
  render(<FotosDiario obraId="o1" data="2026-11-01" fotos={[]} garantirRdo={async () => 'r1'} {...over} />)

beforeAll(() => {
  // jsdom não tem createObjectURL nem randomUUID
  Object.assign(URL, { createObjectURL: () => 'blob:x' })
  if (!globalThis.crypto?.randomUUID) Object.assign(globalThis, { crypto: { randomUUID: () => '0b6f1c1e-3d4a-4b8e-9a51-2f1c3e4d5a6b' } })
})
beforeEach(() => jest.clearAllMocks())

async function anexar(container: HTMLElement) {
  const input = container.querySelector('input[type=file]') as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } })
  })
}

describe('obra SEM mapa (Review Focus 3)', () => {
  it('tela de sempre: botão único, sem modos nem ronda, e a foto sobe sem vínculo', async () => {
    const { container } = montar()
    expect(screen.getByRole('button', { name: 'Tirar ou escolher fotos' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Por ponto (ronda)' })).toBeNull()
    expect(screen.queryByText(/ronda/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tirar ou escolher fotos' }))
    await anexar(container)
    await waitFor(() => expect(registrarFotoAction).toHaveBeenCalledTimes(1))
    // a mesma chamada de antes da Leva 6: 3 argumentos, sem vínculo
    expect((registrarFotoAction as jest.Mock).mock.calls[0]).toHaveLength(3)
  })
})

describe('obra COM mapa', () => {
  it('por ponto: lista a ronda com a referência de ângulo e mostra "ronda incompleta (x de y)"', () => {
    const onRonda = jest.fn()
    montar({ mapa, fotos: [foto('f1', 'p1')], onRonda })
    const ronda = screen.getByRole('list', { name: 'Pontos da ronda' })
    expect(within(ronda).getAllByRole('listitem')).toHaveLength(3)
    expect(within(ronda).getByRole('img', { name: 'Última foto do ponto 1' })).toHaveAttribute('src', 'https://x/ref1')
    expect(screen.getByText(/Ronda incompleta \(1 de 3\)/)).toBeTruthy()
    expect(onRonda).toHaveBeenLastCalledWith({ feitos: 1, total: 3 })
    expect(screen.queryByRole('button', { name: 'Tirar ou escolher fotos' })).toBeNull()
  })

  it('foto do ponto vai com o ponto e o ambiente dele', async () => {
    const { container } = montar({ mapa })
    const linha = screen.getByText(/Salão, fundo/).closest('li')!
    fireEvent.click(within(linha).getByRole('button', { name: 'Tirar foto' }))
    await anexar(container)
    await waitFor(() => expect(registrarFotoAction).toHaveBeenCalled())
    expect(registrarFotoAction).toHaveBeenCalledWith('r1', expect.stringMatching(/^o1\/rdo\/2026-11-01\/.+\.jpg$/), null, {
      pontoId: 'p2',
      ambienteId: 'A',
      atividadeNumero: null,
    })
    await waitFor(() => expect(screen.getByText(/Ronda incompleta \(1 de 3\)/)).toBeTruthy())
  })

  it('por atividade: escolhe a atividade e aparecem o(s) ambiente(s) dela e seus pontos', () => {
    montar({ mapa })
    fireEvent.click(screen.getByRole('button', { name: 'Por atividade' }))
    fireEvent.change(screen.getByLabelText('Atividade'), { target: { value: '4' } })
    expect(screen.getByText('Salão', { selector: 'span' })).toBeTruthy()
    expect(screen.getByText('Ponto 1')).toBeTruthy()
    expect(screen.getByText('Ponto 2')).toBeTruthy()
    expect(screen.queryByText('Ponto 3')).toBeNull()
    fireEvent.change(screen.getByLabelText('Atividade'), { target: { value: '5' } })
    expect(screen.getByText(/não está ligada a nenhum ambiente/)).toBeTruthy()
  })

  it('foto avulsa exige o ambiente', async () => {
    const { container } = montar({ mapa })
    fireEvent.click(screen.getByRole('button', { name: '+ Foto avulsa' }))
    expect(screen.getByRole('alert').textContent).toBe('Escolha o ambiente da foto avulsa.')
    fireEvent.change(screen.getByLabelText('Ambiente da foto avulsa'), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Foto avulsa' }))
    await anexar(container)
    await waitFor(() => expect(registrarFotoAction).toHaveBeenCalled())
    expect((registrarFotoAction as jest.Mock).mock.calls[0][3]).toEqual({ ambienteId: 'B', atividadeNumero: null })
  })

  it('diário validado: sem botões de foto, ronda continua visível', () => {
    montar({ mapa, desabilitado: true, fotos: [foto('f1', 'p1')] })
    expect(screen.queryByRole('button', { name: 'Tirar foto' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ Foto avulsa' })).toBeNull()
    expect(screen.getByText(/Ronda incompleta \(1 de 3\)/)).toBeTruthy()
  })
})
