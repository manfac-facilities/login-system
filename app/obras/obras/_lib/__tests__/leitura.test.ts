import { lerObraGrande } from '../leitura'

type Linhas = Record<string, unknown>
let tabelas: Record<string, { data: unknown; error: unknown }> = {}

function chain(tabela: string) {
  const r = tabelas[tabela] ?? { data: [], error: null }
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order']) c[m] = jest.fn(() => c)
  c.maybeSingle = jest.fn(async () => r)
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(r).then(res, rej)
  return c
}
const supabase = { from: jest.fn((t: string) => chain(t)) } as never

const obra = { id: 'o1', modalidade: 'obra', data_base: '2026-10-05', atividade_trava: null }
const ver = (id: string, numero: number, salva: string | null): Linhas => ({
  id, obra_id: 'o1', numero, motivo: numero > 1 ? 'replan' : null, salva_em: salva,
})
const ativ = (versao_id: string, numero: number, duracao: number): Linhas => ({
  versao_id, numero, etapa: 'E', descricao: `a${numero}`, pred1: numero > 1 ? numero - 1 : null, pred2: null,
  duracao, bloqueia_por_trava: false, peso_valor: 10,
})

beforeEach(() => {
  tabelas = {
    obras_obra: { data: obra, error: null },
    obras_cronograma_versao: { data: [], error: null },
    obras_atividade: { data: [], error: null },
    obras_atividade_exec: { data: [], error: null },
    obras_impedimento: { data: [], error: null },
    obras_feriado: { data: [], error: null },
  }
})

describe('lerObraGrande', () => {
  it('obra sem versão: sem cálculo', async () => {
    const r = await lerObraGrande(supabase, 'o1', '2026-10-10')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.dados.calc).toBeNull()
    expect(r.dados.sinal).toBeNull()
    expect(r.dados.atraso).toBeNull()
    expect(r.dados.plano).toEqual([])
    expect(r.dados.terminoBase).toBeNull()
  })

  it('v1 e v2 salvas: plano da v2, terminoBase da v1', async () => {
    tabelas.obras_cronograma_versao.data = [
      ver('v1', 1, '2026-10-01T00:00:00Z'), ver('v2', 2, '2026-10-08T00:00:00Z'),
    ]
    tabelas.obras_atividade.data = [ativ('v1', 1, 2), ativ('v2', 1, 5)]
    const r = await lerObraGrande(supabase, 'o1', '2026-10-10')
    if (!r.ok) throw new Error(r.erro)
    const d = r.dados
    expect(d.versaoVigente?.numero).toBe(2)
    expect(d.versaoBase?.numero).toBe(1)
    expect(d.rascunho).toBeNull()
    expect(d.plano).toHaveLength(1)
    expect(d.plano[0].duracao).toBe(5)
    expect(d.terminoBase).toBe('2026-10-06') // 2 dias úteis a partir de 05/10
    expect(d.calc?.terminoPrevisto).toBe('2026-10-09')
    expect(d.atraso).not.toBeNull()
    expect(d.sinal).not.toBeNull()
  })

  it('só rascunho: calcula pelo rascunho, sem base', async () => {
    tabelas.obras_cronograma_versao.data = [ver('r1', 1, null)]
    tabelas.obras_atividade.data = [ativ('r1', 1, 3)]
    const r = await lerObraGrande(supabase, 'o1', '2026-10-10')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.rascunho?.id).toBe('r1')
    expect(r.dados.versaoVigente).toBeNull()
    expect(r.dados.versaoBase).toBeNull()
    expect(r.dados.terminoBase).toBeNull()
    expect(r.dados.calc).not.toBeNull()
    expect(r.dados.atraso).toBeNull()
  })

  it('impedimento aberto do cliente deixa o sinal amarelo', async () => {
    tabelas.obras_cronograma_versao.data = [ver('v1', 1, '2026-10-01T00:00:00Z')]
    tabelas.obras_atividade.data = [ativ('v1', 1, 20)]
    tabelas.obras_impedimento.data = [{
      id: 'i1', obra_id: 'o1', categoria: 'impedimento', responsavel: 'cliente', atividade_numero: null,
      trava_atividade: false, aberto_em: '2026-10-06', encerrado_em: null, impacto_dias: 0,
    }]
    const r = await lerObraGrande(supabase, 'o1', '2026-10-05')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.impedimentos[0].abertoEm).toBe('2026-10-06')
    expect(r.dados.sinal).toBe('amarelo')
  })

  it.each([
    'obras_obra', 'obras_cronograma_versao', 'obras_atividade', 'obras_atividade_exec',
    'obras_impedimento', 'obras_feriado',
  ])('erro em %s: ok false', async (t) => {
    tabelas.obras_cronograma_versao.data = [ver('v1', 1, '2026-10-01T00:00:00Z')]
    tabelas[t] = { data: t === 'obras_obra' ? obra : [], error: { message: 'boom' } }
    const r = await lerObraGrande(supabase, 'o1', '2026-10-10')
    expect(r.ok).toBe(false)
  })

  it('obra inexistente: ok false', async () => {
    tabelas.obras_obra = { data: null, error: null }
    expect((await lerObraGrande(supabase, 'o1', '2026-10-10')).ok).toBe(false)
  })
})
