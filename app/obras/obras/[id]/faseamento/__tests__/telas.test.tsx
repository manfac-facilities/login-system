/**
 * Tela e editor da planta de faseamento (Leva 6b): o editor cria e move uma zona
 * (coordenadas relativas 0–1), linha ponto a ponto com Enter/Esc, porta num
 * clique; revisão emitida fica em leitura; obra sem planta mostra o aviso;
 * emitir pede confirmação dentro da página.
 */
const salvarMock = jest.fn()
const emitirMock = jest.fn()
jest.mock('../_actions', () => ({
  criarFaseAction: jest.fn(),
  salvarRascunhoAction: (...a: unknown[]) => salvarMock(...a),
  emitirRevisaoAction: (...a: unknown[]) => emitirMock(...a),
  novaRevisaoAction: jest.fn(),
  enviarFaseamentoAction: jest.fn(),
}))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: mockPush }) }))

import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import EditorCamadas from '../_editor'
import TelaFaseamento from '../_tela'
import type { Camada } from '../_lib/camadas'
import type { BaseDesenho, FaseTela, RevisaoTela } from '../_tipos'

const OBRA = '11111111-2222-4333-8444-555555555555'
const PLANTA: BaseDesenho = { url: 'https://assinada/planta.png', largura: 2000, altura: 1000 }
const SEM_PLANTA: BaseDesenho = { url: null, largura: null, altura: null }

/** Editor com estado de verdade (como na tela), expondo as camadas para o teste. */
let ultimas: Camada[] = []
function Editor({ inicial = [] as Camada[], base = PLANTA, somenteLeitura = false }) {
  const [c, setC] = useState<Camada[]>(inicial)
  const mudar = (n: Camada[]) => {
    ultimas = n
    setC(n)
  }
  return <EditorCamadas camadas={c} onChange={mudar} base={base} somenteLeitura={somenteLeitura} />
}
/** O svg ocupa 1000 x 500 px na tela (planta 2:1): clientX/1000 e clientY/500 são as coordenadas relativas. */
function svgDoEditor() {
  const svg = screen.getByRole('application', { name: 'Editor de camadas da fase' })
  jest.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) })
  return svg
}
const ferramenta = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }))

describe('editor de camadas', () => {
  beforeAll(() => {
    // jsdom sem PointerEvent: usa MouseEvent (clientX/clientY) no lugar
    if (!('PointerEvent' in window)) Object.assign(window, { PointerEvent: MouseEvent })
  })

  it('cria uma zona arrastando e depois move a zona com "Selecionar e mover"', () => {
    render(<Editor />)
    const svg = svgDoEditor()
    ferramenta('Zona de obra')
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50 })
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 250 })
    fireEvent.pointerUp(svg, { clientX: 400, clientY: 250 })
    expect(ultimas).toEqual([{ id: 'c1', t: 'zona_obra', r: [0.1, 0.1, 0.3, 0.4] }])

    ferramenta('Selecionar e mover')
    const zona = svg.querySelector('[data-camada="c1"] rect')!
    fireEvent.pointerDown(zona, { clientX: 200, clientY: 100 })
    fireEvent.pointerMove(svg, { clientX: 300, clientY: 150 })
    fireEvent.pointerUp(svg, { clientX: 300, clientY: 150 })
    expect(ultimas[0].t).toBe('zona_obra')
    expect((ultimas[0] as { r: number[] }).r).toEqual([0.2, 0.2, 0.3, 0.4])

    // Arrastar além da borda: a zona para no limite do quadro (x + w ≤ 1).
    fireEvent.pointerDown(svg.querySelector('[data-camada="c1"] rect')!, { clientX: 300, clientY: 150 })
    fireEvent.pointerMove(svg, { clientX: 5000, clientY: 5000 })
    fireEvent.pointerUp(svg)
    expect((ultimas[0] as { r: number[] }).r).toEqual([0.7, 0.6, 0.3, 0.4])
  })

  it('linha ponto a ponto termina com Enter; Esc cancela; porta num clique; ids únicos', () => {
    render(<Editor inicial={[{ id: 'c7', t: 'extintor', at: [0.5, 0.5] }]} />)
    const svg = svgDoEditor()
    ferramenta('Drywall piso a teto')
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.pointerDown(svg, { clientX: 500, clientY: 100 })
    fireEvent.pointerDown(svg, { clientX: 500, clientY: 400 })
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(ultimas[1]).toEqual({ id: 'c8', t: 'drywall', p: [[0.1, 0.2], [0.5, 0.2], [0.5, 0.8]] })

    ferramenta('Fluxo de clientes e equipe da loja')
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.pointerDown(svg, { clientX: 300, clientY: 100 })
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(ultimas).toHaveLength(2)

    ferramenta('Entrada existente')
    fireEvent.pointerDown(svg, { clientX: 980, clientY: 250 })
    expect(ultimas[2]).toEqual({ id: 'c9', t: 'porta_exist', at: [0.98, 0.5] })
    expect(new Set(ultimas.map((c) => c.id)).size).toBe(3)
  })

  it('duplo clique termina a linha sem ponto repetido; ocultar e apagar pela lista', () => {
    render(<Editor />)
    const svg = svgDoEditor()
    ferramenta('Balcão fechado')
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.pointerDown(svg, { clientX: 600, clientY: 100 })
    fireEvent.pointerDown(svg, { clientX: 600, clientY: 100 })
    fireEvent.doubleClick(svg)
    expect(ultimas).toEqual([{ id: 'c1', t: 'balcao', p: [[0.1, 0.2], [0.6, 0.2]] }])

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar Balcão fechado' }))
    expect(ultimas[0].oculta).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Apagar selecionada' }))
    expect(ultimas).toEqual([])
  })

  it('rótulo da zona escolhida é editável', () => {
    render(<Editor inicial={[{ id: 'c1', t: 'zona_salao', r: [0.1, 0.1, 0.5, 0.5] }]} />)
    fireEvent.click(within(screen.getByRole('list', { name: 'Camadas' })).getByRole('button', { name: /Salão em operação/ }))
    fireEvent.change(screen.getByLabelText('Rótulo da zona'), { target: { value: 'SALÃO EM OPERAÇÃO' } })
    expect(ultimas[0]).toMatchObject({ rot: 'SALÃO EM OPERAÇÃO' })
  })
})

const fases = (status: 'rascunho' | 'emitida'): FaseTela[] => [
  { id: 'f1', numero: 1, nome: 'Demolição e reforço', revisoes: [{ id: 'r0', revisao: 0, status, emitidaEm: status === 'emitida' ? '2026-10-30T15:00:00Z' : null, enviadaEm: null }] },
]
const revisao = (status: 'rascunho' | 'emitida'): RevisaoTela => ({
  id: 'r0',
  faseId: 'f1',
  revisao: 0,
  status,
  camadas: [{ id: 'c1', t: 'zona_obra', r: [0.1, 0.1, 0.3, 0.3], rot: 'ZONA DE OBRA' }],
  regras: ['Nenhuma demolição antes do escoramento.'],
  carimbo: { titulo: 'Planta de faseamento · Fase 1', cliente: 'DPSP', desenho: 'FAS-01', base: 'Layout', rt: '' },
  usaTrava: false,
  emitidaEm: status === 'emitida' ? '2026-10-30T15:00:00Z' : null,
  emitidaPor: null,
  travaTexto: null,
  ilegivel: null,
})
const tela = (p: { status?: 'rascunho' | 'emitida'; base?: BaseDesenho; podeEditar?: boolean } = {}) =>
  render(
    <TelaFaseamento
      obraId={OBRA}
      obra={{ nome: 'Macaé 3', os: '24.0871' }}
      fases={fases(p.status ?? 'rascunho')}
      faseId="f1"
      revisao={revisao(p.status ?? 'rascunho')}
      base={p.base ?? PLANTA}
      podeEditar={p.podeEditar ?? true}
      temTrava
    />,
  )

describe('tela da fase', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rascunho: revisão atual e status, ferramentas, Salvar e Emitir; PDF da revisão', () => {
    tela()
    expect(screen.getByTestId('revisao-atual').textContent).toContain('Revisão R0 · rascunho')
    expect(screen.getByRole('button', { name: 'Zona de obra' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Emitir revisão' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Gerar PDF' }).getAttribute('href')).toBe(`/obras/obras/${OBRA}/faseamento/r0/pdf`)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('revisão emitida fica em leitura: sem ferramentas, sem Salvar/Emitir, campos da prancha desabilitados', () => {
    tela({ status: 'emitida' })
    expect(screen.getByTestId('revisao-atual').textContent).toContain('Revisão R0 · emitida')
    expect(screen.queryByRole('button', { name: 'Zona de obra' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Emitir revisão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Apagar selecionada' })).toBeNull()
    expect((screen.getByRole('checkbox', { name: 'Mostrar Zona de obra ZONA DE OBRA' }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Nova revisão' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Enviar ao cliente' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Prancha A3' }))
    expect((screen.getByLabelText('Título da prancha') as HTMLInputElement).disabled).toBe(true)
    const previa = screen.getByRole('img', { name: 'Prévia da prancha A3' })
    expect(previa.textContent).toContain('Nenhuma demolição antes do escoramento.')
    expect(previa.textContent).toContain('R0')
    expect(previa.textContent).not.toContain('RASCUNHO')
  })

  it('quem não pode fasear vê em leitura e sem botões de escrita', () => {
    tela({ podeEditar: false })
    expect(screen.queryByRole('button', { name: '+ Nova fase' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Emitir revisão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Zona de obra' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Gerar PDF' })).toBeTruthy()
  })

  it('obra sem planta: aviso e quadro branco (sem imagem)', () => {
    const { container } = tela({ base: SEM_PLANTA })
    expect(screen.getByRole('note').textContent).toContain('não tem planta no Mapa')
    expect(container.querySelector('image')).toBeNull()
    expect(screen.getByRole('application').getAttribute('viewBox')).toBe('0 0 1000 700')
  })

  it('Emitir pede confirmação na página (sem confirm do navegador) e só então emite', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm')
    emitirMock.mockResolvedValue({ ok: true })
    tela()
    fireEvent.click(screen.getByRole('button', { name: 'Emitir revisão' }))
    expect(emitirMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: 'Confirmar emissão' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar emissão' }))
    })
    expect(emitirMock).toHaveBeenCalledWith('r0')
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('Salvar rascunho manda as regras uma por linha, validadas', async () => {
    salvarMock.mockResolvedValue({ ok: true })
    tela()
    fireEvent.click(screen.getByRole('button', { name: 'Prancha A3' }))
    fireEvent.change(screen.getByLabelText(/Regras impressas/), { target: { value: ' Regra A \n\nRegra B' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    })
    expect(salvarMock).toHaveBeenCalledWith('r0', expect.objectContaining({ regras: ['Regra A', 'Regra B'], usaTrava: false }))
  })
})

describe('prévia da prancha (sem iframe: o hub manda X-Frame-Options DENY)', () => {
  it('rascunho: marca RASCUNHO e reflete a regra digitada antes de salvar', () => {
    tela()
    fireEvent.click(screen.getByRole('button', { name: 'Prancha A3' }))
    fireEvent.change(screen.getByLabelText(/Regras impressas/), { target: { value: 'Regra nova ainda não salva' } })
    const previa = screen.getByRole('img', { name: 'Prévia da prancha A3' })
    expect(previa.textContent).toContain('Regra nova ainda não salva')
    expect(previa.textContent).toContain('RASCUNHO')
    expect(previa.textContent).toContain('Macaé 3 · OS 24.0871')
  })
})

describe('rodada de correções da revisão', () => {
  beforeEach(() => jest.clearAllMocks())

  it('M3: gravado ilegível mostra o aviso e deixa o rascunho em leitura', () => {
    render(
      <TelaFaseamento
        obraId={OBRA}
        obra={{ nome: 'Macaé 3', os: '24.0871' }}
        fases={fases('rascunho')}
        faseId="f1"
        revisao={{ ...revisao('rascunho'), ilegivel: 'Há camadas que não puderam ser lidas. A revisão fica em leitura até um administrador corrigir.' }}
        base={PLANTA}
        podeEditar
        temTrava
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('Há camadas que não puderam ser lidas')
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Emitir revisão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Zona de obra' })).toBeNull()
  })

  const duasFases = (): FaseTela[] => [
    ...fases('rascunho'),
    { id: 'f2', numero: 2, nome: 'Piso do salão', revisoes: [{ id: 'r9', revisao: 0, status: 'rascunho', emitidaEm: null, enviadaEm: null }] },
  ]
  const telaDuas = () =>
    render(<TelaFaseamento obraId={OBRA} obra={{ nome: 'Macaé 3', os: '24.0871' }} fases={duasFases()} faseId="f1" revisao={revisao('rascunho')} base={PLANTA} podeEditar temTrava />)
  const sujar = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Prancha A3' }))
    fireEvent.change(screen.getByLabelText(/Regras impressas/), { target: { value: 'Regra mudada' } })
  }

  it('M1: trocar de fase com alteração não salva pede confirmação (Voltar mantém, Descartar navega)', () => {
    telaDuas()
    fireEvent.click(screen.getByRole('link', { name: /Fase 2 · Piso do salão/ }))
    expect(screen.queryByRole('alertdialog')).toBeNull() // sem alteração: navega direto (o Link cuida)
    sujar()
    fireEvent.click(screen.getByRole('link', { name: /Fase 2 · Piso do salão/ }))
    expect(screen.getByRole('alertdialog', { name: 'Alterações não salvas' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: /Fase 2 · Piso do salão/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }))
    expect(mockPush).toHaveBeenCalledWith(`/obras/obras/${OBRA}/faseamento?fase=f2`)
  })

  it('M1: Gerar PDF com alteração não salva salva antes e só então abre o PDF', async () => {
    const janela = { location: { href: '' }, close: jest.fn() }
    const abrir = jest.spyOn(window, 'open').mockReturnValue(janela as unknown as Window)
    salvarMock.mockResolvedValue({ ok: true })
    tela()
    sujar()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' }))
    })
    expect(salvarMock).toHaveBeenCalledWith('r0', expect.objectContaining({ regras: ['Regra mudada'] }))
    expect(janela.location.href).toBe(`/obras/obras/${OBRA}/faseamento/r0/pdf`)
    expect(janela.close).not.toHaveBeenCalled()
    abrir.mockRestore()
  })

  it('M1: se o salvar falha, mostra o erro e não abre o PDF', async () => {
    const janela = { location: { href: '' }, close: jest.fn() }
    const abrir = jest.spyOn(window, 'open').mockReturnValue(janela as unknown as Window)
    salvarMock.mockResolvedValue({ ok: false, erro: 'Não deu para salvar' })
    tela()
    sujar()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar PDF' }))
    })
    expect(janela.close).toHaveBeenCalled()
    expect(janela.location.href).toBe('')
    expect(screen.getByRole('alert').textContent).toContain('Não deu para salvar')
    abrir.mockRestore()
  })

  it('M6: Enter e Esc digitados num campo não terminam nem cancelam a linha', () => {
    ultimas = []
    render(
      <>
        <input aria-label="campo" />
        <Editor />
      </>,
    )
    const svg = svgDoEditor()
    ferramenta('Drywall piso a teto')
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100 })
    fireEvent.pointerDown(svg, { clientX: 500, clientY: 100 })
    const campo = screen.getByLabelText('campo')
    act(() => {
      fireEvent.keyDown(campo, { key: 'Enter' })
      fireEvent.keyDown(campo, { key: 'Escape' })
    })
    expect(ultimas).toEqual([])
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(ultimas).toEqual([{ id: 'c1', t: 'drywall', p: [[0.1, 0.2], [0.5, 0.2]] }])
  })
})
