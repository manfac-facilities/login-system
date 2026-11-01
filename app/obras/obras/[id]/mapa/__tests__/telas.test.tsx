import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

jest.mock('../_actions', () => ({
  salvarModoAction: jest.fn(async () => ({ ok: true })),
  salvarPlantaAction: jest.fn(async () => ({ ok: true })),
  criarAmbienteAction: jest.fn(async () => ({ ok: true, id: 'novo' })),
  atualizarAmbienteAction: jest.fn(async () => ({ ok: true })),
  apagarAmbienteAction: jest.fn(async () => ({
    ok: false,
    erro: 'Este ambiente tem fotos no diário e não pode ser apagado. Desative os pontos dele em vez de apagar.',
  })),
  definirAtividadesAction: jest.fn(async () => ({ ok: true })),
  criarPontoAction: jest.fn(async () => ({ ok: true, id: 'pn', numero: 3 })),
  atualizarPontoAction: jest.fn(async () => ({ ok: true })),
  definirPontoAtivoAction: jest.fn(async () => ({ ok: true })),
}))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

import TelaMapa from '../_tela'
import EditorMapa from '../montar/_editor'
import CompararPonto, { type FotoPonto } from '../ponto/[pontoId]/_comparar'
import { apagarAmbienteAction, criarAmbienteAction, definirAtividadesAction, definirPontoAtivoAction, salvarModoAction } from '../_actions'
import type { AmbienteTela, MapaTela } from '../_tipos'

const amb = (over: Partial<AmbienteTela>): AmbienteTela => ({
  id: 'A', nome: 'Salão', areaM2: 412, x: 0, y: 0, w: 0.5, h: 0.5, pct: 0.64, previsto: 0.71, faixa: 3,
  atividades: [{ numero: 4, descricao: 'Drywall do salão', pct: 0.7, atrasada: true, concluida: false }],
  impedimentos: [], fotos: [], ...over,
})
const mapa: MapaTela = {
  modo: 'croqui', plantaUrl: null, plantaLargura: null, plantaAltura: null,
  ambientes: [
    amb({}),
    amb({ id: 'B', nome: 'Banheiros', areaM2: null, pct: null, previsto: null, faixa: null, atividades: [], impedimentos: [{ id: 'i1', descricao: 'Falta louça' }] }),
  ],
  pontos: [{ id: 'p1', numero: 1, nome: 'Entrada', ambienteId: 'A', x: 0.1, y: 0.1 }],
}

beforeEach(() => jest.clearAllMocks())

describe('TelaMapa', () => {
  it('painel do ambiente: avanço, previsto, atividades e link da linha do tempo do ponto', () => {
    render(<TelaMapa obraId="o1" mapa={mapa} podeMontar={false} />)
    const painel = screen.getByRole('complementary', { name: 'Ambiente escolhido' })
    expect(within(painel).getByText('412 m² · avanço 64% · previsto 71%')).toBeTruthy()
    expect(within(painel).getByText('70% · atrasada')).toBeTruthy()
    expect(within(painel).getByRole('link', { name: /Ponto 1/ })).toHaveAttribute('href', '/obras/obras/o1/mapa/ponto/p1')
    expect(screen.queryByRole('link', { name: 'Montar o mapa' })).toBeNull()
  })

  it('ambiente sem atividade mostra "—" e o impedimento aberto', () => {
    render(<TelaMapa obraId="o1" mapa={mapa} podeMontar />)
    fireEvent.click(screen.getAllByRole('button', { name: /^Banheiros/ })[0])
    const painel = screen.getByRole('complementary', { name: 'Ambiente escolhido' })
    expect(within(painel).getByText('avanço —')).toBeTruthy()
    expect(within(painel).getByText(/Nenhuma atividade ligada/)).toBeTruthy()
    expect(within(painel).getByText('Falta louça')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Montar o mapa' })).toHaveAttribute('href', '/obras/obras/o1/mapa/montar')
  })

  it('troca de modo: planta só existe com planta; ambientes mostra os cartões', () => {
    render(<TelaMapa obraId="o1" mapa={mapa} podeMontar={false} />)
    expect(screen.queryByRole('button', { name: 'Planta' })).toBeNull()
    expect(screen.getByRole('img', { name: /Croqui/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ambientes' }))
    expect(screen.queryByRole('img', { name: /Croqui/ })).toBeNull()
    expect(screen.getByText('▲ 1 impedimento(s)')).toBeTruthy()
  })

  it('com planta: imagem por URL assinada + ambientes por cima', () => {
    render(<TelaMapa obraId="o1" mapa={{ ...mapa, modo: 'planta', plantaUrl: 'https://s/planta?token=1', plantaLargura: 1600, plantaAltura: 900 }} podeMontar={false} />)
    const svg = screen.getByRole('img', { name: /Planta/ })
    expect(svg.getAttribute('viewBox')).toBe('0 0 1600 900')
    expect(svg.querySelector('image')?.getAttribute('href')).toBe('https://s/planta?token=1')
    expect(svg.querySelector('[data-ambiente="A"] rect')?.getAttribute('width')).toBe('800')
  })
})

describe('EditorMapa', () => {
  const base = {
    obraId: 'o1',
    planta: { url: null, largura: null, altura: null },
    pontos: [{ id: 'p1', numero: 1, nome: 'Entrada', ambienteId: 'A', x: 0.1, y: 0.1, ativo: true }],
    atividades: [
      { numero: 3, etapa: 'Demolição', descricao: 'Demolição de forro' },
      { numero: 4, etapa: 'Drywall', descricao: 'Drywall do salão' },
    ],
  }
  const ambientes = [{ id: 'A', nome: 'Salão', areaM2: null, x: 0.1, y: 0.1, w: 0.4, h: 0.4, ordem: 1, atividades: [3] }]

  it('sem mapa: pede o modo; escolher croqui salva', async () => {
    render(<EditorMapa {...base} configurado={false} modo="ambientes" ambientes={[]} pontos={[]} />)
    expect(screen.getByText('Escolha o modo para começar.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Croqui (desenhar retângulos)' }))
    await waitFor(() => expect(salvarModoAction).toHaveBeenCalledWith('o1', 'croqui'))
    expect(await screen.findByRole('application')).toBeTruthy()
  })

  it('+ Ambiente cria um retângulo no meio do quadro', async () => {
    render(<EditorMapa {...base} configurado modo="croqui" ambientes={ambientes} />)
    fireEvent.click(screen.getByRole('button', { name: '+ Ambiente' }))
    await waitFor(() =>
      expect(criarAmbienteAction).toHaveBeenCalledWith('o1', { nome: 'Ambiente 2', areaM2: null, retangulo: { x: 0.35, y: 0.35, w: 0.3, h: 0.3 } }),
    )
  })

  it('atividades do ambiente: checkbox por número e salvar', async () => {
    render(<EditorMapa {...base} configurado modo="ambientes" ambientes={ambientes} />)
    const quatro = screen.getByText('Drywall do salão').closest('label')!.querySelector('input')!
    expect((screen.getByText('Demolição de forro').closest('label')!.querySelector('input') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(quatro)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar atividades' }))
    await waitFor(() => expect(definirAtividadesAction).toHaveBeenCalledWith('A', [3, 4]))
  })

  it('apagar ambiente com foto: mostra a recusa do banco em pt-BR e mantém o ambiente', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    render(<EditorMapa {...base} configurado modo="ambientes" ambientes={ambientes} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar ambiente' }))
    await waitFor(() => expect(apagarAmbienteAction).toHaveBeenCalledWith('A'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/tem fotos no diário e não pode ser apagado/)
    expect(screen.getByRole('button', { name: 'Salão' })).toBeTruthy()
  })

  it('desativar ponto', async () => {
    render(<EditorMapa {...base} configurado modo="ambientes" ambientes={ambientes} />)
    fireEvent.click(screen.getByRole('button', { name: 'Desativar ponto' }))
    await waitFor(() => expect(definirPontoAtivoAction).toHaveBeenCalledWith('p1', false))
    expect(await screen.findByRole('button', { name: 'Reativar ponto' })).toBeTruthy()
  })

  it('planta em PDF: avisa que só imagem nesta leva', async () => {
    render(<EditorMapa {...base} configurado modo="planta" ambientes={ambientes} />)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'layout.pdf', { type: 'application/pdf' })] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/PDF ainda não é aceito/)
  })
})

describe('CompararPonto', () => {
  const f = (id: string, data: string): FotoPonto => ({
    id, rdoId: 'r', path: `o/${id}.jpg`, legenda: null, ordem: 1, data, estado: 'validado', ambienteId: 'A', pontoId: 'p1', atividadeNumero: null, url: `https://x/${id}`,
  })
  const fotos = [f('a', '2026-10-06'), f('b', '2026-10-31'), f('c', '2026-11-01')]

  it('início × hoje: primeira × última; arrastar move o corte', () => {
    render(<CompararPonto fotos={fotos} hoje="2026-11-01" />)
    expect(screen.getByText('06/10 · antes')).toBeTruthy()
    expect(screen.getByText('01/11 · depois')).toBeTruthy()
    const corte = screen.getByRole('slider', { name: /comparar/ })
    fireEvent.change(corte, { target: { value: '30' } })
    expect(screen.getByAltText('Depois, 01/11').parentElement!.style.clipPath).toBe('inset(0 0 0 30%)')
  })

  it('ontem × hoje e escolher datas', () => {
    render(<CompararPonto fotos={fotos} hoje="2026-11-01" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ontem × hoje' }))
    expect(screen.getByText('31/10 · antes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Escolher datas' }))
    fireEvent.change(screen.getByLabelText('Depois'), { target: { value: 'b' } })
    expect(screen.getByText('31/10 · depois')).toBeTruthy()
  })

  it('sem par possível: explica', () => {
    render(<CompararPonto fotos={[fotos[0]]} hoje="2026-11-01" />)
    expect(screen.getByText(/pelo menos duas fotos/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ontem × hoje' }))
    expect(screen.getByText(/foto de hoje e de um dia anterior/)).toBeTruthy()
  })
})
