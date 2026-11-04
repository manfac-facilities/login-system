import { diariosDe, lerCarteira, obrasDoUniverso, type LinhaUniverso } from '../carteira-leitura'
import { atrasoPorResponsavel } from '../cronograma'

const MAE = '11111111-1111-4111-8111-111111111111'
const FILHA = '22222222-2222-4222-8222-222222222222'
const hoje = '2026-11-04'
const F: ReadonlySet<string> = new Set()

const linha = (o: Partial<LinhaUniverso>): LinhaUniverso => ({
  id: MAE, os: '0526-1', loja: 'Macaé 3', modalidade: 'obra', etapa: 'execucao', cancelado_em: null,
  obra_pai_id: null, engenheiro_email: 'eng@manfac.com.br', ...o,
})

describe('obrasDoUniverso', () => {
  it('só OBRA, sem cancelada e sem aditivo (filha); mantém a mãe', () => {
    const rows = [
      linha({ id: 'mae' }),
      linha({ id: 'spot', modalidade: 'spot' }),
      linha({ id: 'canc', etapa: 'cancelado' }),
      linha({ id: 'canc2', cancelado_em: '2026-10-01T00:00:00Z' }),
      linha({ id: 'filha', obra_pai_id: 'mae' }),
    ]
    expect(obrasDoUniverso(rows).map((r) => r.id)).toEqual(['mae'])
  })
})

describe('desvio em dias úteis = atraso.total do painel', () => {
  // A carteira usa `og.dados.atraso?.total` (de `atrasoPorResponsavel`), o mesmo número do painel.
  const desvio = (base: string, projetado: string) =>
    atrasoPorResponsavel({ terminoBase: base, terminoProjetado: projetado, impacto: { cliente: 0, manfac: 0, terceiro: 0, clima: 0 }, feriados: F }).total
  it('dias úteis a mais depois da base; igual ou antes → 0', () => {
    expect(desvio('2026-11-04', '2026-11-04')).toBe(0)
    expect(desvio('2026-11-04', '2026-11-03')).toBe(0)
    expect(desvio('2026-11-04', '2026-11-05')).toBe(1)
    // qua 04 → seg 09: qui, sex, seg = 3
    expect(desvio('2026-11-04', '2026-11-09')).toBe(3)
  })
})

describe('diariosDe', () => {
  const desc = new Map([[1, 'Demolição'], [2, 'Elétrica'], [3, 'Pintura'], [4, 'Forro'], [5, 'Piso']])
  it('sem execução → motivo; com execução → equipe + até 3 atividades que avançaram, depois "e mais N"', () => {
    const rdos = [
      { id: 'a', data: '2026-11-03', sem_execucao: false, motivo_sem_execucao: null, efetivo: 6 },
      { id: 'b', data: '2026-11-02', sem_execucao: true, motivo_sem_execucao: 'chuva', efetivo: 0 },
      { id: 'c', data: '2026-10-31', sem_execucao: false, motivo_sem_execucao: null, efetivo: 3 },
    ]
    const avancos = [
      { rdo_id: 'a', numero: 1, de: 0.1, para: 0.2, concluida: false },
      { rdo_id: 'a', numero: 2, de: 0.5, para: 0.5, concluida: true },
      { rdo_id: 'a', numero: 3, de: 0.3, para: 0.3, concluida: false },
      { rdo_id: 'a', numero: 4, de: 0, para: 0.1, concluida: false },
      { rdo_id: 'a', numero: 5, de: 0, para: 0.1, concluida: false },
      { rdo_id: 'a', numero: 9, de: 0, para: 0.1, concluida: false },
    ]
    expect(diariosDe(rdos, avancos, desc)).toEqual([
      { data: '2026-11-03', texto: 'Equipe de 6. Demolição, Elétrica, Forro e mais 2.' },
      { data: '2026-11-02', texto: 'Sem execução: chuva' },
      { data: '2026-10-31', texto: 'Equipe de 3.' },
    ])
  })
})

// ---------- lerCarteira com supabase fake ----------

type Resp = { data: unknown; error: unknown }
function fake(tabelas: Record<string, Resp>, rpcs: Record<string, Resp>) {
  const from = jest.fn((t: string) => {
    let single = false
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'or', 'order', 'limit', 'not', 'gt'] as const) q[m] = () => q
    q.maybeSingle = () => { single = true; return q }
    q.then = (ok: (v: unknown) => unknown) => {
      const r = tabelas[t] ?? { data: [], error: null }
      const v = single && Array.isArray(r.data) ? { ...r, data: r.data[0] ?? null } : r
      return Promise.resolve(v).then(ok)
    }
    return q
  })
  const rpc = jest.fn(async (nome: string) => rpcs[nome] ?? { data: [], error: null })
  return { supabase: { from, rpc } as never, from, rpc }
}

describe('lerCarteira', () => {
  const obras = [
    { ...linha({ id: MAE }), data_base: '2026-10-01' },
    { ...linha({ id: FILHA, os: '0526-2', obra_pai_id: MAE }), data_base: null },
  ]

  it('mensagens com erro → indisponível; sem permissão de valores → sem_permissao; filha não vira obra', async () => {
    const f = fake(
      { obras_obra: { data: obras, error: null }, obras_mensagem: { data: null, error: { message: 'x' } } },
      { obras_pode_ver_valores: { data: false, error: null } },
    )
    const r = await lerCarteira(f.supabase, hoje)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.obras).toHaveLength(1)
    const o = r.obras[0]
    expect(o.id).toBe(MAE)
    expect(o.engenheiro).toBe('eng@manfac.com.br')
    expect(o.sinais.find((s) => s.chave === 'mensagens')?.tom).toBe('indisponivel')
    expect(o.sinais.find((s) => s.chave === 'pendencias')?.tom).toBe('ok')
    expect(o.dinheiro).toEqual({ ok: false, motivo: 'sem_permissao' })
    expect(f.rpc.mock.calls.map((c) => c[0]).filter((n: string) => n.startsWith('obras_fin_'))).toEqual([])
  })

  it('leitura do universo com erro → ok:false', async () => {
    const f = fake({ obras_obra: { data: null, error: { message: 'x' } } }, {})
    expect(await lerCarteira(f.supabase, hoje)).toEqual({ ok: false })
  })

  it('restrições com erro → pendências indisponível; lerObraGrande com erro → sem_cronograma', async () => {
    const f = fake(
      {
        obras_obra: { data: obras, error: null },
        obras_restricao: { data: null, error: { message: 'x' } },
        obras_cronograma_versao: { data: null, error: { message: 'x' } },
        obras_rdo: { data: [{ id: 'a', data: '2026-11-03', estado: 'validado', sem_execucao: false, motivo_sem_execucao: null, efetivo: 4 }], error: null },
      },
      { obras_pode_ver_valores: { data: false, error: null } },
    )
    const r = await lerCarteira(f.supabase, hoje)
    if (!r.ok) throw new Error('esperava ok')
    const o = r.obras[0]
    expect(o.estado).toEqual({ tipo: 'sem_cronograma' })
    expect(o.sinal).toBeNull()
    expect(o.desvioDiasUteis).toBeNull()
    expect(o.etapas).toEqual([])
    expect(o.semana).toBeNull()
    expect(o.diarios).toEqual([])
    expect(o.travas).toEqual([])
    expect(o.sinais.find((s) => s.chave === 'pendencias')?.tom).toBe('indisponivel')
    expect(o.sinais.find((s) => s.chave === 'semanal')?.tom).toBe('indisponivel')
  })

  it('diários: só validado/enviado, 3 últimos por data desc, com os avanços desses rdos', async () => {
    const f = fake(
      {
        obras_obra: { data: obras, error: null },
        obras_rdo: { data: [{ id: 'a', data: '2026-11-03', estado: 'validado', sem_execucao: false, motivo_sem_execucao: null, efetivo: 4 }], error: null },
        obras_rdo_avanco: { data: [{ rdo_id: 'a', numero: 7, de: 0, para: 0.2, concluida: false }], error: null },
      },
      { obras_pode_ver_valores: { data: false, error: null } },
    )
    const r = await lerCarteira(f.supabase, hoje)
    if (!r.ok) throw new Error('esperava ok')
    // Sem cronograma, a atividade não tem descrição: entra como "atividade 7".
    expect(r.obras[0].diarios).toEqual([{ data: '2026-11-03', texto: 'Equipe de 4. atividade 7.' }])
  })
})
