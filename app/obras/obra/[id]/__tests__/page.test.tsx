/**
 * Testes de `../page.tsx` — item 6 da revisão de 20/09: nenhuma das 8
 * consultas conferia erro, e uma falha momentânea do banco terminava
 * indistinguível de "obra não encontrada".
 *
 * Padrão de `app/crm/__tests__/page.test.tsx`: mocka `next/navigation`,
 * `@/lib/supabase/server` e `@/lib/auth/systemAccess`, chama a Server
 * Component como função e confere o que ela faz (lança vs. `notFound()`).
 */

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
// `page.tsx` importa `_ficha.tsx` → `_etapa.tsx` → `_actions.ts`, que importa
// `next/cache` de verdade — isso puxa internals do servidor Next que pedem
// `TextEncoder`, ausente no jsdom do Jest. Mesmo mock de
// `app/obras/__tests__/ficha.test.ts`.
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import FichaDaObraPage from '../page'

const OK = { data: [], error: null }

/** Uma "obra" completa o bastante para `derivar()` não estourar. */
function linhaObra(over: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    os: '0826-001',
    loja: 'Loja 1',
    descricao: 'Piso',
    tipo: 'CIVIL',
    valor: 1000,
    origem: 'Sistema DPSP',
    fonte: 'field',
    field_id: null,
    field_ausente_desde: null,
    field_ausente_em: null,
    analista_cliente: 'LEANDRO',
    pcm: 'YURI',
    equipe: 'MANFAC-7',
    os_aprovada: false,
    liberado_por: null,
    liberado_em: null,
    etapa: 'andamento',
    bloqueio: 'Sem bloqueio',
    mau_uso: false,
    prioridade: 'Normal',
    aprovacao: null,
    inicio_plan: '2026-09-01',
    inicio_real: '2026-09-01',
    duracao: 7,
    fim_real: null,
    desde_etapa: null,
    marco_exec_fim: null,
    marco_relatorio: null,
    marco_os_aprov: null,
    marco_fechou_os: null,
    marco_liberou_fat: null,
    marco_faturou: null,
    pendencia: null,
    pend_resp: null,
    pend_prazo: null,
    prox_acao: null,
    atualizacao: '2026-09-01',
    nao_andou_seguidos: 0,
    bloqueada_dias: 0,
    criado_por: null,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: null,
    ...over,
  }
}

/** Cada tabela responde por duas vias: `.maybeSingle()` OU `await` direto do
 * builder (via `.then`). `obras_obra` é a única consultada das duas formas
 * (a linha principal e, depois, só `equipe, analista_cliente`) — como cada
 * `from()` devolve um builder novo, os dois caminhos convivem sem conflito. */
function mockRespostas(respostas: {
  obra?: { data: unknown; error: unknown }
  diario?: { data: unknown; error: unknown }
  remarcacoes?: { data: unknown; error: unknown }
  tarefas?: { data: unknown; error: unknown }
  pessoas?: { data: unknown; error: unknown }
  outras?: { data: unknown; error: unknown }
  motivos?: { data: unknown; error: unknown }
  historico?: { data: unknown; error: unknown }
}) {
  const porTabela: Record<string, { data: unknown; error: unknown }> = {
    obras_obra: respostas.outras ?? OK,
    obras_diario: respostas.diario ?? OK,
    obras_remarcacao: respostas.remarcacoes ?? OK,
    obras_tarefa: respostas.tarefas ?? OK,
    obras_pessoa: respostas.pessoas ?? OK,
    obras_motivo_remarcacao: respostas.motivos ?? OK,
    obras_historico: respostas.historico ?? OK,
  }
  const respostaObraPrincipal = respostas.obra ?? { data: linhaObra(), error: null }

  const fromMock = jest.fn((tabela: string) => {
    const chain: Record<string, unknown> = {}
    chain.select = jest.fn(() => chain)
    chain.eq = jest.fn(() => chain)
    chain.order = jest.fn(() => chain)
    chain.maybeSingle = jest.fn(async () => respostaObraPrincipal)
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(porTabela[tabela] ?? OK).then(resolve)
    return chain
  })

  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { email: 'yuri@manfac.com.br' } } })) },
    from: fromMock,
    storage: { from: jest.fn(() => ({ createSignedUrls: jest.fn(async () => ({ data: [] })) })) },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
})

const params = Promise.resolve({ id: 'o1' })

describe('FichaDaObraPage — item 6: erro de consulta não vira "obra não encontrada"', () => {
  it('erro na consulta PRINCIPAL (obras_obra) lança, nunca chama notFound()', async () => {
    mockRespostas({ obra: { data: null, error: { message: 'timeout' } } })
    await expect(FichaDaObraPage({ params })).rejects.toThrow(/Falha ao carregar a ficha/)
    expect(notFound).not.toHaveBeenCalled()
  })

  it('ausência REAL da linha (sem erro) continua chamando notFound()', async () => {
    mockRespostas({ obra: { data: null, error: null } })
    await expect(FichaDaObraPage({ params })).rejects.toThrow('NOT_FOUND')
  })

  it('erro numa consulta SECUNDÁRIA (ex.: obras_diario) também lança', async () => {
    mockRespostas({ diario: { data: null, error: { message: 'conexão perdida' } } })
    await expect(FichaDaObraPage({ params })).rejects.toThrow(/Falha ao carregar a ficha/)
    expect(notFound).not.toHaveBeenCalled()
  })

  it('erro no histórico (obras_historico) também lança — não é mais engolido em silêncio', async () => {
    mockRespostas({ historico: { data: null, error: { message: 'RLS' } } })
    await expect(FichaDaObraPage({ params })).rejects.toThrow(/Falha ao carregar a ficha/)
  })

  it('tudo respondendo sem erro, a página não lança nem chama notFound()', async () => {
    mockRespostas({})
    await expect(FichaDaObraPage({ params })).resolves.toBeDefined()
    expect(notFound).not.toHaveBeenCalled()
  })
})
