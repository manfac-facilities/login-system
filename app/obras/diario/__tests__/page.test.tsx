/**
 * `../page.tsx` — pacote 3 de performance (06/10/2026): as obras em campo são
 * lidas em páginas (corte de 1.000 do PostgREST), `obras_pessoa`/chave saem em
 * paralelo e a lista de responsáveis do admin sai das próprias obras lidas.
 */

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('../_pessoa', () => ({
  resolverChave: jest.fn(async () => 'YURI'),
  chaveDoUsuario: jest.requireActual('../_pessoa').chaveDoUsuario,
}))
jest.mock('../_cartoes', () => ({
  __esModule: true,
  default: (props: CartoesProps) => {
    cartoes = props
    return null
  },
}))

import { render, screen } from '@testing-library/react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { resolverChave } from '../_pessoa'
import DiarioPage from '../page'

type CartoesProps = {
  obras: { id: string }[]
  agendadas: { id: string }[]
  pessoasPorEmail: { email: string; nome: string }[]
  responsaveis: string[]
  analistaSelecionado: string
  minhaChave: string
  respostas: Record<string, { autoria?: unknown }>
}
let cartoes: CartoesProps | null = null

/** Chamadas de `select` em `obras_obra`, na ordem. */
const selecoesObra: string[] = []
const eqPcm = jest.fn()
const order = jest.fn()
const selecoesOutras: { tabela: string; cols: string }[] = []
const inOutras: { tabela: string; ids: unknown }[] = []
let pessoasNoBanco: { chave: string; nome: string; area: string | null; email: string | null }[] = []
let diarioNoBanco: Record<string, unknown>[] = []
let obrasNoBanco: { id: string; pcm: string | null; etapa: string; diario_agendado_ate?: string | null }[] = []

function mockBanco() {
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { email: 'a@manfac.com.br' } } })) },
    from: jest.fn((tabela: string) => {
      const q: Record<string, unknown> = {}
      if (tabela === 'obras_obra') {
        let pcm: string | null = null
        q.select = jest.fn((cols: string) => {
          selecoesObra.push(cols)
          return q
        })
        q.in = jest.fn(() => q)
        q.eq = jest.fn((_c: string, v: string) => {
          eqPcm(v)
          pcm = v
          return q
        })
        q.order = jest.fn((...a: unknown[]) => {
          order(...a)
          return q
        })
        q.range = jest.fn((de: number, ate: number) => {
          const base = pcm ? obrasNoBanco.filter((o) => o.pcm === pcm) : obrasNoBanco
          return Promise.resolve({ data: base.slice(de, ate + 1), error: null })
        })
        return q
      }
      // obras_pessoa, obras_diario, obras_tarefa: vazias
      q.select = jest.fn((cols: string) => {
        selecoesOutras.push({ tabela, cols })
        return q
      })
      q.eq = jest.fn(() => q)
      q.in = jest.fn((_c: string, ids: unknown) => {
        inOutras.push({ tabela, ids })
        return Promise.resolve({ data: tabela === 'obras_diario' ? diarioNoBanco : [], error: null })
      })
      q.then = (r: (v: unknown) => unknown) =>
        Promise.resolve({ data: tabela === 'obras_pessoa' ? pessoasNoBanco : [], error: null }).then(r)
      return q
    }),
  })
}

const obra = (i: number, pcm: string | null) => ({ id: `o${i}`, pcm, etapa: 'andamento' })

beforeEach(() => {
  cartoes = null
  selecoesObra.length = 0
  selecoesOutras.length = 0
  inOutras.length = 0
  pessoasNoBanco = []
  diarioNoBanco = []
  ;(resolverChave as jest.Mock).mockResolvedValue('YURI')
  eqPcm.mockClear()
  order.mockClear()
  ;(isAdmin as jest.Mock).mockResolvedValue(true)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  mockBanco()
})

test('admin sem filtro: responsáveis saem das obras lidas, sem consulta extra de pcm', async () => {
  obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA'), obra(3, null), obra(4, 'YURI')]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(cartoes!.obras).toHaveLength(4)
  expect(cartoes!.responsaveis).toEqual(['AMANDA', 'YURI'])
  expect(selecoesObra).toEqual(['*'])
})

test('admin com filtro: lista de responsáveis continua completa (consulta à parte de pcm)', async () => {
  obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA')]
  render(await DiarioPage({ searchParams: Promise.resolve({ analista: 'YURI' }) }))
  expect(cartoes!.obras.map((o) => o.id)).toEqual(['o1'])
  expect(cartoes!.responsaveis).toEqual(['AMANDA', 'YURI'])
  expect([...selecoesObra].sort()).toEqual(['*', 'pcm'])
})

test('mais de 1000 obras em campo: nenhuma é cortada', async () => {
  obrasNoBanco = Array.from({ length: 1500 }, (_, i) => obra(i, 'YURI'))
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(cartoes!.obras).toHaveLength(1500)
  expect(order).toHaveBeenCalledWith('id', { ascending: true })
})

test('pcm (não-admin) abre nas suas, filtradas no banco, e tem o seletor', async () => {
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA')]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(eqPcm).toHaveBeenCalledWith('YURI')
  expect(cartoes!.obras.map((o) => o.id)).toEqual(['o1'])
  expect(cartoes!.analistaSelecionado).toBe('YURI')
  expect(cartoes!.responsaveis).toEqual(['AMANDA', 'YURI'])
  expect(cartoes!.minhaChave).toBe('YURI')
})

// ---- agendamento (spec 16/10/2026 §7) ----
const emDoisDias = () => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 2)
  return d.toISOString().slice(0, 10)
}
const agendada = (i: number, pcm: string) => ({ ...obra(i, pcm), diario_agendado_ate: emDoisDias() })

test('obra agendada vai para "agendadas", o resto para "obras"', async () => {
  obrasNoBanco = [obra(1, 'YURI'), obra(2, 'YURI'), agendada(3, 'YURI')]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(cartoes!.obras.map((o) => o.id)).toEqual(['o1', 'o2'])
  expect(cartoes!.agendadas.map((o) => o.id)).toEqual(['o3'])
})

test('obra com data de volta = hoje está na fila', async () => {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  obrasNoBanco = [{ ...obra(1, 'YURI'), diario_agendado_ate: hoje }]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(cartoes!.obras.map((o) => o.id)).toEqual(['o1'])
  expect(cartoes!.agendadas).toEqual([])
})

test('analista com todas as obras agendadas não cai em SemPermissao', async () => {
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  obrasNoBanco = [agendada(1, 'YURI')]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(cartoes).not.toBeNull()
  expect(cartoes!.obras).toEqual([])
  expect(cartoes!.agendadas.map((o) => o.id)).toEqual(['o1'])
})

test('respostas e tarefas são lidas só para os ids da fila', async () => {
  obrasNoBanco = [obra(1, 'YURI'), agendada(2, 'YURI')]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  const lidos = inOutras.filter((c) => c.tabela === 'obras_diario' || c.tabela === 'obras_tarefa')
  expect(lidos).toHaveLength(2)
  for (const c of lidos) expect(c.ids).toEqual(['o1'])
})

test('obras_pessoa pede o e-mail e Cartoes recebe as pessoas com e-mail', async () => {
  pessoasNoBanco = [
    { chave: 'YURI', nome: 'Yuri Moreira', area: null, email: 'yuri.moreira@manfac.com.br' },
    { chave: 'EQ_1', nome: 'Equipe 1', area: null, email: null },
  ]
  obrasNoBanco = [obra(1, 'YURI')]
  render(await DiarioPage({ searchParams: Promise.resolve({}) }))
  expect(selecoesOutras.find((s) => s.tabela === 'obras_pessoa')!.cols).toContain('email')
  expect(cartoes!.pessoasPorEmail).toEqual([{ email: 'yuri.moreira@manfac.com.br', nome: 'Yuri Moreira' }])
})

// ---- diário liberado para todos (spec 27/10/2026) ----
describe('diário para todos', () => {
  beforeEach(() => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
  })

  test('não-pcm com acesso vê as obras de todos', async () => {
    ;(resolverChave as jest.Mock).mockResolvedValue('MARCOS')
    obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA')]
    render(await DiarioPage({ searchParams: Promise.resolve({}) }))
    expect(eqPcm).not.toHaveBeenCalled()
    expect(cartoes!.obras.map((o) => o.id)).toEqual(['o1', 'o2'])
    expect(cartoes!.analistaSelecionado).toBe('')
    expect(cartoes!.responsaveis).toEqual(['AMANDA', 'YURI'])
  })

  test('não-admin sem chave nenhuma também vê todas (o porteiro é o acesso ao módulo)', async () => {
    ;(resolverChave as jest.Mock).mockResolvedValue('')
    obrasNoBanco = [obra(1, 'YURI'), obra(2, null)]
    render(await DiarioPage({ searchParams: Promise.resolve({}) }))
    expect(eqPcm).not.toHaveBeenCalled()
    expect(cartoes!.obras).toHaveLength(2)
  })

  test('pcm com ?analista=todos vê todas', async () => {
    obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA')]
    render(await DiarioPage({ searchParams: Promise.resolve({ analista: 'todos' }) }))
    expect(eqPcm).not.toHaveBeenCalled()
    expect(cartoes!.obras.map((o) => o.id)).toEqual(['o1', 'o2'])
    expect(cartoes!.analistaSelecionado).toBe('')
  })

  test('?analista=AMANDA filtra pela Amanda, mesmo para quem não é ela', async () => {
    obrasNoBanco = [obra(1, 'YURI'), obra(2, 'AMANDA')]
    render(await DiarioPage({ searchParams: Promise.resolve({ analista: 'AMANDA' }) }))
    expect(eqPcm).toHaveBeenCalledWith('AMANDA')
    expect(cartoes!.obras.map((o) => o.id)).toEqual(['o2'])
    expect(cartoes!.responsaveis).toEqual(['AMANDA', 'YURI'])
  })

  test('sem acesso ao módulo: SemPermissao novo, sem o botão da base', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    obrasNoBanco = [obra(1, 'YURI')]
    render(await DiarioPage({ searchParams: Promise.resolve({}) }))
    expect(cartoes).toBeNull()
    expect(screen.getByText('Você não tem acesso a Gestão de Obras')).toBeTruthy()
    expect(screen.queryByText('Ver a base de obras')).toBeNull()
  })

  test('filtro sem obra nenhuma: a tela do diário (estado vazio), não SemPermissao', async () => {
    obrasNoBanco = [obra(1, 'YURI')]
    render(await DiarioPage({ searchParams: Promise.resolve({ analista: 'LUANA' }) }))
    expect(cartoes).not.toBeNull()
    expect(cartoes!.obras).toEqual([])
    expect(cartoes!.agendadas).toEqual([])
  })

  test('não-admin sem obra nenhuma em campo também cai no estado vazio', async () => {
    ;(resolverChave as jest.Mock).mockResolvedValue('MARCOS')
    obrasNoBanco = []
    render(await DiarioPage({ searchParams: Promise.resolve({}) }))
    expect(cartoes).not.toBeNull()
    expect(cartoes!.obras).toEqual([])
  })

  test('o diário pede autoria e hora', async () => {
    obrasNoBanco = [obra(1, 'YURI')]
    render(await DiarioPage({ searchParams: Promise.resolve({}) }))
    const cols = selecoesOutras.find((s) => s.tabela === 'obras_diario')!.cols
    for (const c of ['registrado_por_email', 'atualizado_em', 'created_at']) expect(cols).toContain(c)
  })

  const resposta = (over: Record<string, unknown>) => ({
    obra_id: 'o1',
    andou: true,
    motivo: null,
    item: 'Não faltou',
    obs: null,
    foto_path: null,
    registrado_por_email: null,
    atualizado_em: null,
    created_at: '2026-10-27T11:00:00Z',
    ...over,
  })

  test('rótulo "em nome de" quando outra pessoa respondeu (nome sem cadastro sai do e-mail)', async () => {
    pessoasNoBanco = [{ chave: 'YURI', nome: 'Yuri Moreira', area: null, email: 'yuri.moreira@manfac.com.br' }]
    obrasNoBanco = [obra(1, 'YURI')]
    diarioNoBanco = [resposta({ registrado_por_email: 'marcos.silva@manfac.com.br', atualizado_em: '2026-10-27T13:02:00Z' })]
    render(await DiarioPage({ searchParams: Promise.resolve({ analista: 'todos' }) }))
    expect(cartoes!.respostas.o1.autoria).toEqual({ por: 'Marcos', emNomeDe: 'Yuri', hora: '10:02' })
  })

  test('rótulo sem "em nome de" quando o próprio responsável respondeu (cadastro por e-mail)', async () => {
    pessoasNoBanco = [{ chave: 'YURI', nome: 'Yuri Moreira', area: null, email: 'yuri.moreira@manfac.com.br' }]
    obrasNoBanco = [obra(1, 'YURI')]
    diarioNoBanco = [resposta({ registrado_por_email: 'Yuri.Moreira@manfac.com.br', atualizado_em: '2026-10-27T12:14:00Z' })]
    render(await DiarioPage({ searchParams: Promise.resolve({}) }))
    expect(cartoes!.respostas.o1.autoria).toEqual({ por: 'Yuri', emNomeDe: null, hora: '09:14' })
  })

  test('responsável sem cadastro: compara pela convenção do e-mail e o nome é a chave capitalizada', async () => {
    obrasNoBanco = [obra(1, 'AMANDA'), obra(2, 'YURI')]
    diarioNoBanco = [
      resposta({ registrado_por_email: 'amanda@manfac.com.br', atualizado_em: null, created_at: '2026-10-27T11:30:00Z' }),
      resposta({ obra_id: 'o2', registrado_por_email: 'amanda@manfac.com.br', atualizado_em: '2026-10-27T11:31:00Z' }),
    ]
    render(await DiarioPage({ searchParams: Promise.resolve({ analista: 'todos' }) }))
    expect(cartoes!.respostas.o1.autoria).toEqual({ por: 'Amanda', emNomeDe: null, hora: '08:30' })
    expect(cartoes!.respostas.o2.autoria).toEqual({ por: 'Amanda', emNomeDe: 'Yuri', hora: '08:31' })
  })

  test('resposta antiga, sem e-mail: sem rótulo', async () => {
    obrasNoBanco = [obra(1, 'YURI')]
    diarioNoBanco = [resposta({})]
    render(await DiarioPage({ searchParams: Promise.resolve({}) }))
    expect(cartoes!.respostas.o1.autoria).toBeNull()
  })
})
