import { lerObraGrande } from '../leitura'

type Linhas = Record<string, unknown>
let tabelas: Record<string, { data: unknown; error: unknown }> = {}

function chain(tabela: string) {
  const r = tabelas[tabela] ?? { data: [], error: null }
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'order', 'not', 'limit', 'or']) c[m] = jest.fn(() => c)
  c.maybeSingle = jest.fn(async () => r)
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(r).then(res, rej)
  return c
}
const supabase = { from: jest.fn((t: string) => chain(t)) } as never

const obra = { id: '00000000-0000-4000-8000-00000000000a', modalidade: 'obra', data_base: '2026-10-05', atividade_trava: null }
const ver = (id: string, numero: number, salva: string | null): Linhas => ({
  id, obra_id: '00000000-0000-4000-8000-00000000000a', numero, motivo: numero > 1 ? 'replan' : null, salva_em: salva,
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
    obras_atividade_status_hist: { data: [], error: null },
    obras_rdo: { data: [], error: null },
  }
})

describe('lerObraGrande', () => {
  it('obra sem versão: sem cálculo', async () => {
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
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
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
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
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
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
      id: 'i1', obra_id: '00000000-0000-4000-8000-00000000000a', categoria: 'impedimento', responsavel: 'cliente', atividade_numero: null,
      trava_atividade: false, aberto_em: '2026-10-06', encerrado_em: null, impacto_dias: 0,
    }]
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-05')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.impedimentos[0].abertoEm).toBe('2026-10-06')
    expect(r.dados.sinal).toBe('amarelo')
  })

  it.each([
    'obras_obra', 'obras_cronograma_versao', 'obras_atividade', 'obras_atividade_exec',
    'obras_impedimento', 'obras_feriado', 'obras_atividade_status_hist', 'obras_rdo',
  ])('erro em %s: ok false', async (t) => {
    tabelas.obras_cronograma_versao.data = [ver('v1', 1, '2026-10-01T00:00:00Z')]
    tabelas[t] = { data: t === 'obras_obra' ? obra : [], error: { message: 'boom' } }
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
    expect(r.ok).toBe(false)
  })

  it('lê inicio_fixo e dias_restantes; calcBase e etapas', async () => {
    tabelas.obras_cronograma_versao.data = [
      ver('v1', 1, '2026-10-01T00:00:00Z'), ver('v2', 2, '2026-10-08T00:00:00Z'),
    ]
    tabelas.obras_atividade.data = [
      ativ('v1', 1, 2), { ...ativ('v2', 1, 2), inicio_fixo: '2026-10-07' },
    ]
    tabelas.obras_atividade_exec.data = [
      { obra_id: '00000000-0000-4000-8000-00000000000a', numero: 1, status: 'em_andamento', percentual: 0.5, inicio_real: '2026-10-07', fim_real: null, dias_restantes: '2.0' },
    ]
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
    if (!r.ok) throw new Error(r.erro)
    const d = r.dados
    expect(d.plano[0].inicioFixo).toBe('2026-10-07')
    expect(d.exec[0].diasRestantes).toBe(2)
    expect(d.calc?.atividades[0].inicioPrevisto).toBe('2026-10-07')
    expect(d.calcBase?.atividades[0].inicioPrevisto).toBe('2026-10-05')
    expect(d.etapas).toHaveLength(1)
    expect(d.etapas[0]).toMatchObject({ etapa: 'E', inicio: '2026-10-07', numeros: [1] })
  })

  it('dias restantes ancorados na data de status do histórico mais recente com o mesmo valor', async () => {
    tabelas.obras_cronograma_versao.data = [ver('v1', 1, '2026-10-01T00:00:00Z')]
    tabelas.obras_atividade.data = [ativ('v1', 1, 10), ativ('v1', 2, 3)]
    tabelas.obras_atividade_exec.data = [
      { obra_id: '00000000-0000-4000-8000-00000000000a', numero: 1, status: 'em_andamento', percentual: 0.5, inicio_real: '2026-10-05', fim_real: null, dias_restantes: 2 },
      { obra_id: '00000000-0000-4000-8000-00000000000a', numero: 2, status: 'em_andamento', percentual: 0.1, inicio_real: '2026-10-05', fim_real: null, dias_restantes: 4 },
    ]
    tabelas.obras_atividade_status_hist.data = [
      { numero: 1, data_status: '2026-10-01', percentual: 0.2, dias_restantes: 5, registrado_em: '2026-10-01T12:00:00Z' },
      { numero: 1, data_status: '2026-10-06', percentual: 0.5, dias_restantes: 2, registrado_em: '2026-10-06T12:00:00Z' },
      { numero: 1, data_status: '2026-10-08', percentual: 0.5, dias_restantes: null, registrado_em: '2026-10-08T12:00:00Z' },
      { numero: 2, data_status: '2026-10-06', percentual: 0.1, dias_restantes: 9, registrado_em: '2026-10-06T12:00:00Z' },
    ]
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-14')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.exec[0].diasRestantesEm).toBe('2026-10-06')
    // 2 dias a partir de terça 06/10 → quarta 07/10, mesmo com hoje = 14/10.
    expect(r.dados.calc?.atividades[0].fimProjetado).toBe('2026-10-07')
    // Valor do histórico ≠ exec: sem âncora, conta de hoje (14/10 + 4 dias úteis → 19/10).
    expect(r.dados.exec[1].diasRestantesEm).toBeNull()
    expect(r.dados.calc?.atividades[1].fimProjetado).toBe('2026-10-19')
  })

  it('sem colunas novas: inicioFixo/diasRestantes null; sem base: calcBase null', async () => {
    tabelas.obras_cronograma_versao.data = [ver('r1', 1, null)]
    tabelas.obras_atividade.data = [ativ('r1', 1, 3)]
    tabelas.obras_atividade_exec.data = [{ obra_id: '00000000-0000-4000-8000-00000000000a', numero: 1, status: 'nao_iniciado', percentual: 0, inicio_real: null, fim_real: null }]
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.plano[0].inicioFixo).toBeNull()
    expect(r.dados.exec[0].diasRestantes).toBeNull()
    expect(r.dados.calcBase).toBeNull()
    expect(r.dados.etapas).toHaveLength(1)
  })

  it('obra sem versão: etapas vazias', async () => {
    const r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.etapas).toEqual([])
    expect(r.dados.calcBase).toBeNull()
  })

  it('hist e dadosAte: maior data_status; sem hist, último RDO validado; senão null', async () => {
    tabelas.obras_atividade_status_hist.data = [
      { numero: 1, data_status: '2026-10-08', percentual: '0.5' },
      { numero: 1, data_status: '2026-10-12', percentual: 1 },
    ]
    let r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.hist).toMatchObject([
      { numero: 1, dataStatus: '2026-10-08', percentual: 0.5 },
      { numero: 1, dataStatus: '2026-10-12', percentual: 1 },
    ])
    expect(r.dados.dadosAte).toBe('2026-10-12')

    tabelas.obras_atividade_status_hist.data = []
    tabelas.obras_rdo.data = [{ validado_em: '2026-10-09T18:00:00Z' }]
    r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.dadosAte).toBe('2026-10-09')

    tabelas.obras_rdo.data = []
    r = await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')
    if (!r.ok) throw new Error(r.erro)
    expect(r.dados.dadosAte).toBeNull()
  })

  it('obra inexistente: ok false', async () => {
    tabelas.obras_obra = { data: null, error: null }
    expect((await lerObraGrande(supabase, '00000000-0000-4000-8000-00000000000a', '2026-10-10')).ok).toBe(false)
  })
})
