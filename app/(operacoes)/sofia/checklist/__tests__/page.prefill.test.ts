// "Trocar carro → fazer checklist" (editar equipe) abre o checklist com tipo
// "troca" e a equipe de destino; só equipe ATIVA existente é aceita.
jest.mock('@/lib/sofia/queries', () => ({
  getEquipes: jest.fn(async () => [
    { id: 'e-ativa', codigo: 'MANFAC-05', ativo: true },
    { id: 'e-inativa', codigo: 'MANFAC-99', ativo: false },
  ]),
  getVeiculos: jest.fn(async () => []),
  getMotoristas: jest.fn(async () => []),
}))
jest.mock('../novo/_form', () => ({ __esModule: true, default: () => null }))

import NovoChecklistPage from '../novo/page'

type Props = { tipoInicial?: string; equipeDestinoInicial?: { id: string; codigo: string } }
async function render(sp: Record<string, string>) {
  const el = (await NovoChecklistPage({ searchParams: Promise.resolve(sp) })) as { props: Props }
  return el.props
}

describe('checklist/novo — pré-preenchimento vindo da edição de equipe', () => {
  it('tipo=troca + equipe ativa chegam ao form', async () => {
    const p = await render({ tipo: 'troca', equipe_destino: 'e-ativa' })
    expect(p.tipoInicial).toBe('troca')
    expect(p.equipeDestinoInicial).toEqual({ id: 'e-ativa', codigo: 'MANFAC-05' })
  })

  it('equipe inexistente ou inativa é ignorada', async () => {
    expect((await render({ tipo: 'troca', equipe_destino: 'nao-existe' })).equipeDestinoInicial).toBeUndefined()
    expect((await render({ tipo: 'troca', equipe_destino: 'e-inativa' })).equipeDestinoInicial).toBeUndefined()
  })

  it('tipo diferente de troca é ignorado (e leva a equipe junto)', async () => {
    const p = await render({ tipo: 'saida', equipe_destino: 'e-ativa' })
    expect(p.tipoInicial).toBeUndefined()
    expect(p.equipeDestinoInicial).toBeUndefined()
  })

  it('sem parâmetros: form normal', async () => {
    const p = await render({})
    expect(p.tipoInicial).toBeUndefined()
    expect(p.equipeDestinoInicial).toBeUndefined()
  })
})
